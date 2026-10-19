/**
 * Local provider stub for the E2E stack (VYN-03-01). It stands in for every provider base URL
 * the API and the worker are given, so a run never reaches a live provider:
 *
 * - `/meta/<version>/…` emulates the WhatsApp Cloud API calls VYNOR makes: phone number lookup,
 *   WABA phone list, app subscription, and `/messages`, whose outcome (success, transient or
 *   permanent failure) can be queued per recipient.
 * - `/supabase/…` answers the JWKS lookup and refuses password sign-ins.
 * - Anything else is answered 404 and still logged.
 *
 * It also plays Meta's side of webhooks: it signs inbound messages and delivery receipts with
 * the channel's app secret and posts them to the channel's webhook URL, and it can replay a
 * delivery byte for byte. Every provider call and every delivery is logged (stdout and
 * `GET /__stub/calls`, `GET /__stub/deliveries`) as the provider request trace of a run.
 */
import { createHmac } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { E2E_PORTS, STUB_PHONES, STUB_WABA_ID } from './e2e-env';

export type SendOutcome = 'success' | 'transient' | 'permanent';
export type ReceiptStatus = 'sent' | 'delivered' | 'read';

export interface ProviderCall {
  seq: number;
  at: string;
  method: string;
  path: string;
  provider: string;
  status: number;
  /** For `/messages`: the recipient and the outcome the stub applied. */
  to?: string;
  outcome?: SendOutcome;
  wamid?: string;
}

export interface WebhookDelivery {
  id: number;
  at: string;
  kind: 'inbound' | 'status' | 'replay';
  phoneNumberId: string;
  url: string;
  body: string;
  signature: string;
  status: number;
  response: unknown;
  replayOf?: number;
}

const phones = Object.values(STUB_PHONES);
const calls: ProviderCall[] = [];
const deliveries: WebhookDelivery[] = [];
const queuedOutcomes = new Map<string, SendOutcome[]>();
const callbacks = new Map<string, { url: string; appSecret: string }>();
const sentMessages = new Map<string, { phoneNumberId: string; to: string }>();
let seq = 0;
let messageSeq = 0;

function log(kind: string, entry: object): void {
  console.info(`[graph-stub] ${kind} ${JSON.stringify(entry)}`);
}

function send(res: ServerResponse, status: number, body: unknown): number {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
  return status;
}

function graphError(
  res: ServerResponse,
  status: number,
  code: number,
  message: string,
  subcode?: number,
): number {
  return send(res, status, {
    error: {
      message,
      type: 'OAuthException',
      code,
      ...(subcode !== undefined ? { error_subcode: subcode } : {}),
      fbtrace_id: 'E2E_STUB',
    },
  });
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 1_000_000) throw new Error('Request body too large for the stub.');
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseJson(raw: string): Record<string, unknown> {
  if (!raw) return {};
  const parsed: unknown = JSON.parse(raw);
  return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
}

// ---------------------------------------------------------------------------
// Meta Graph API (WhatsApp Cloud)
// ---------------------------------------------------------------------------

function handleGraph(
  method: string,
  segments: string[],
  body: Record<string, unknown>,
  res: ServerResponse,
  call: ProviderCall,
): number {
  const [node, edge] = segments;
  const phone = phones.find((p) => p.id === node);

  if (method === 'GET' && phone && !edge) {
    return send(res, 200, {
      id: phone.id,
      display_phone_number: phone.display,
      verified_name: phone.name,
      quality_rating: 'GREEN',
      code_verification_status: 'VERIFIED',
      platform_type: 'CLOUD_API',
    });
  }
  if (method === 'GET' && node === STUB_WABA_ID && edge === 'phone_numbers') {
    return send(res, 200, { data: phones.map((p) => ({ id: p.id })) });
  }
  if (method === 'POST' && node === STUB_WABA_ID && edge === 'subscribed_apps') {
    return send(res, 200, { success: true });
  }
  if (method === 'POST' && phone && !edge) {
    return send(res, 200, { success: true });
  }
  if (method === 'POST' && phone && edge === 'messages') {
    const to = String(body.to ?? '');
    const outcome = queuedOutcomes.get(to)?.shift() ?? 'success';
    call.to = to;
    call.outcome = outcome;
    if (outcome === 'transient') {
      return graphError(res, 500, 2, 'Service temporarily unavailable');
    }
    if (outcome === 'permanent') {
      return graphError(res, 400, 131026, 'Message undeliverable');
    }
    const wamid = `wamid.E2E${String(++messageSeq).padStart(5, '0')}`;
    call.wamid = wamid;
    sentMessages.set(wamid, { phoneNumberId: phone.id, to });
    return send(res, 200, {
      messaging_product: 'whatsapp',
      contacts: [{ input: to, wa_id: to }],
      messages: [{ id: wamid }],
    });
  }
  return graphError(res, 400, 100, `Unsupported request: ${method} ${segments.join('/')}`, 33);
}

// ---------------------------------------------------------------------------
// Webhooks the stub delivers on Meta's behalf
// ---------------------------------------------------------------------------

function whatsappEnvelope(phoneNumberId: string, value: Record<string, unknown>): object {
  const phone = phones.find((p) => p.id === phoneNumberId);
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: STUB_WABA_ID,
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: (phone?.display ?? '').replace(/\D/g, ''),
                phone_number_id: phoneNumberId,
              },
              ...value,
            },
          },
        ],
      },
    ],
  };
}

async function deliver(
  kind: WebhookDelivery['kind'],
  phoneNumberId: string,
  body: string,
  replayOf?: WebhookDelivery,
): Promise<WebhookDelivery> {
  const target = callbacks.get(phoneNumberId);
  if (!target) throw new Error(`No webhook registered for phone number ${phoneNumberId}.`);
  const signature =
    replayOf?.signature ??
    `sha256=${createHmac('sha256', target.appSecret).update(body).digest('hex')}`;
  const response = await fetch(replayOf?.url ?? target.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hub-signature-256': signature },
    body,
  });
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Keep the raw text.
  }
  const delivery: WebhookDelivery = {
    id: deliveries.length + 1,
    at: new Date().toISOString(),
    kind,
    phoneNumberId,
    url: replayOf?.url ?? target.url,
    body,
    signature,
    status: response.status,
    response: parsed,
    ...(replayOf ? { replayOf: replayOf.id } : {}),
  };
  deliveries.push(delivery);
  log('delivery', { id: delivery.id, kind, phoneNumberId, status: response.status });
  return delivery;
}

const unixNow = () => String(Math.floor(Date.now() / 1000));

async function handleControl(
  method: string,
  path: string,
  body: Record<string, unknown>,
  res: ServerResponse,
): Promise<void> {
  if (method === 'GET' && path === '/__stub/health') {
    send(res, 200, { ok: true });
    return;
  }
  if (method === 'GET' && path === '/__stub/calls') {
    send(res, 200, { calls });
    return;
  }
  if (method === 'GET' && path === '/__stub/deliveries') {
    send(res, 200, { deliveries });
    return;
  }
  if (method === 'POST' && path === '/__stub/channels') {
    const phoneNumberId = String(body.phoneNumberId);
    callbacks.set(phoneNumberId, {
      url: String(body.callbackUrl),
      appSecret: String(body.appSecret),
    });
    log('channel', { phoneNumberId, callbackUrl: body.callbackUrl });
    send(res, 200, { registered: phoneNumberId });
    return;
  }
  if (method === 'POST' && path === '/__stub/outcomes') {
    const to = String(body.to);
    const outcomes = (body.outcomes as SendOutcome[]) ?? [];
    queuedOutcomes.set(to, [...(queuedOutcomes.get(to) ?? []), ...outcomes]);
    log('outcomes', { to, outcomes });
    send(res, 200, { to, queued: queuedOutcomes.get(to) });
    return;
  }
  if (method === 'POST' && path === '/__stub/webhooks/inbound') {
    const phoneNumberId = String(body.phoneNumberId);
    const from = String(body.from);
    const payload = whatsappEnvelope(phoneNumberId, {
      contacts: [{ profile: { name: String(body.name) }, wa_id: from }],
      messages: [
        {
          from,
          id: String(body.wamid),
          timestamp: typeof body.timestamp === 'string' ? body.timestamp : unixNow(),
          type: 'text',
          text: { body: String(body.text) },
        },
      ],
    });
    // Meta pretty-prints its deliveries; signatures cover those exact bytes.
    send(res, 200, await deliver('inbound', phoneNumberId, JSON.stringify(payload, null, 2)));
    return;
  }
  if (method === 'POST' && path === '/__stub/webhooks/status') {
    const wamid = String(body.wamid);
    const sent = sentMessages.get(wamid);
    if (!sent) {
      send(res, 404, { error: `The stub never sent ${wamid}.` });
      return;
    }
    const payload = whatsappEnvelope(sent.phoneNumberId, {
      statuses: [
        {
          id: wamid,
          status: String(body.status) as ReceiptStatus,
          timestamp: typeof body.timestamp === 'string' ? body.timestamp : unixNow(),
          recipient_id: sent.to,
        },
      ],
    });
    send(res, 200, await deliver('status', sent.phoneNumberId, JSON.stringify(payload, null, 2)));
    return;
  }
  const replay = /^\/__stub\/deliveries\/(\d+)\/replay$/.exec(path);
  if (method === 'POST' && replay) {
    const original = deliveries.find((d) => d.id === Number(replay[1]));
    if (!original) {
      send(res, 404, { error: `Unknown delivery ${replay[1]}.` });
      return;
    }
    send(res, 200, await deliver('replay', original.phoneNumberId, original.body, original));
    return;
  }
  send(res, 404, { error: `Unknown stub control route ${method} ${path}` });
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = createServer((req, res) => {
  void (async () => {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', 'http://stub.local');
    const path = url.pathname;
    try {
      const raw = await readBody(req);
      if (path.startsWith('/__stub/')) {
        await handleControl(method, path, parseJson(raw), res);
        return;
      }

      const [, provider = '', ...rest] = path.split('/');
      const call: ProviderCall = {
        seq: ++seq,
        at: new Date().toISOString(),
        method,
        path,
        provider,
        status: 0,
      };
      if (provider === 'meta') {
        // /meta/<version>/<node>[/<edge>]
        const segments = rest.slice(1);
        call.status = handleGraph(method, segments, parseJson(raw), res, call);
      } else if (provider === 'supabase' && path.endsWith('/.well-known/jwks.json')) {
        call.status = send(res, 200, { keys: [] });
      } else if (provider === 'supabase' && path.endsWith('/auth/v1/token')) {
        call.status = send(res, 400, {
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
        });
      } else {
        call.status = send(res, 404, { error: `The E2E stub does not emulate ${path}.` });
      }
      calls.push(call);
      log('call', call);
    } catch (error) {
      log('error', { method, path, message: (error as Error).message });
      if (!res.headersSent) send(res, 500, { error: (error as Error).message });
    }
  })();
});

const port = Number(process.env.E2E_STUB_PORT ?? E2E_PORTS.stub);
server.listen(port, '127.0.0.1', () => {
  log('ready', { port });
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
