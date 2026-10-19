import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ApiEnv } from '@vynor/contracts';
import { sealChannelSecrets } from '@vynor/channel-adapters';
import {
  createTestPrismaClient,
  generateId,
  type Prisma,
  type PrismaClient,
} from '@vynor/database';
import { CredentialCipher } from '@vynor/shared';
import { ChannelRuntimeService } from '../src/channels/channel-runtime.service.js';
import { MediaController } from '../src/conversations/media.controller.js';
import { MediaUrlService } from '../src/conversations/media-url.service.js';
import {
  createChannel,
  createConversation,
  createMessage,
  createTenant,
  removeTenants,
  type Tenant,
} from './support/fixtures.js';
import { startHttpApp, testApiEnv, type HttpApp } from './support/http-app.js';

/**
 * WU-03 / VYN-03-03: `GET /media/:messageId?exp&sig` streams inbound media from the provider
 * behind an HMAC-signed, expiring link (no bearer token). The WhatsApp Cloud API is a local
 * fake Graph server; the database is the test database.
 */

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

function fakeGraph(): Promise<{ server: Server; origin: string }> {
  const server = createServer((req, res) => {
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const reply = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    switch (req.url) {
      case '/v26.0/media-jpeg':
        return reply(200, { url: `${origin}/files/photo`, mime_type: 'image/jpeg' });
      case '/v26.0/media-zip':
        return reply(200, { url: `${origin}/files/archive`, mime_type: 'application/zip' });
      case '/v26.0/media-gone':
        return reply(400, {
          error: { message: 'Unsupported get request', code: 100, error_subcode: 33 },
        });
      case '/v26.0/media-down':
        return reply(500, { error: { message: 'Service temporarily unavailable', code: 2 } });
      case '/files/photo':
      case '/files/archive':
        res.writeHead(200, { 'content-type': 'application/octet-stream' });
        return res.end(JPEG);
      default:
        return reply(404, { error: { message: `no fake for ${req.url}` } });
    }
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({ server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }),
    ),
  );
}

describe('Signed media links over HTTP (WU-03 characterization)', () => {
  let db: PrismaClient;
  let graph: Server;
  let env: ApiEnv;
  let app: HttpApp;
  let api: string;
  let signer: MediaUrlService;
  let tenant: Tenant;
  const ids = {} as Record<'jpeg' | 'zip' | 'gone' | 'down' | 'text', string>;

  /** Path and query of a link the API itself would sign for `messageId`. */
  const signedPath = (messageId: string) => {
    const url = new URL(signer.sign(messageId)!);
    return `${url.pathname.replace(/^\/api\/v1/, '')}${url.search}`;
  };
  const signature = (messageId: string, exp: number) =>
    createHmac('sha256', new ChannelRuntimeService(env).requireCipher().deriveKey('media-url-v1'))
      .update(`${messageId}.${exp}`)
      .digest('base64url');
  const fetchMedia = (path: string) => fetch(`${api}${path}`);

  beforeAll(async () => {
    const fake = await fakeGraph();
    graph = fake.server;
    env = testApiEnv({ META_GRAPH_API_BASE_URL: fake.origin });
    signer = new MediaUrlService(new ChannelRuntimeService(env));

    db = createTestPrismaClient();
    tenant = await createTenant(db, 'media');
    // Sealed credentials are bound to their channel ID.
    const channelId = generateId();
    await createChannel(db, tenant, {
      id: channelId,
      accountIdentifier: `media-${tenant.slug}`,
      credentials: sealChannelSecrets(CredentialCipher.fromEnv(env)!, {
        provider: 'WHATSAPP_CLOUD',
        providerAccountId: channelId,
        secrets: {
          credentials: {
            accessToken: 'EAAGcharacterizationMediaToken0123456789',
            phoneNumberId: '106540352242922',
            businessAccountId: '102290129340398',
            appSecret: 'abcdef0123456789abcdef0123456789',
          },
          generated: {},
        },
      }) as unknown as Prisma.InputJsonValue,
    });
    const { conversationId } = await createConversation(db, tenant, channelId, {
      name: 'Media Sender',
      phone: '+6281200000099',
    });
    const media = (providerMediaId: string, mimeType: string, filename: string) =>
      createMessage(db, tenant, channelId, conversationId, {
        text: filename,
        contentType: 'MEDIA',
        content: { type: 'MEDIA', mediaType: 'image', providerMediaId, mimeType, filename },
      });
    ids.jpeg = await media('media-jpeg', 'image/jpeg', 'foto "produk"<1>.jpg');
    ids.zip = await media('media-zip', 'application/zip', 'katalog.zip');
    ids.gone = await media('media-gone', 'image/jpeg', 'lama.jpg');
    ids.down = await media('media-down', 'image/jpeg', 'gagal.jpg');
    ids.text = await createMessage(db, tenant, channelId, conversationId, { text: 'Bukan media' });

    app = await startHttpApp({
      env,
      controllers: [MediaController],
      providers: [MediaUrlService],
    });
    api = app.baseUrl;
  });

  afterAll(async () => {
    await app?.close();
    graph?.close();
    if (!db) return;
    await removeTenants(db, [tenant], []);
    await db.$disconnect();
  });

  it('signs links under APP_URL with a one-hour expiry', () => {
    const url = new URL(signer.sign(ids.jpeg)!);
    expect(url.origin).toBe('https://api.vynor.test');
    expect(url.pathname).toBe(`/api/v1/media/${ids.jpeg}`);
    const exp = Number(url.searchParams.get('exp'));
    expect(exp - Math.floor(Date.now() / 1000)).toBeGreaterThan(3590);
    expect(exp - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(3600);
  });

  it('streams an inline-safe file with hardened headers for a valid signature', async () => {
    const response = await fetchMedia(signedPath(ids.jpeg));
    expect(response.status).toBe(200);
    expect(Object.fromEntries(response.headers)).toMatchObject({
      'content-type': 'image/jpeg',
      'content-length': String(JPEG.length),
      // Each run of characters outside [\w.\- ] becomes one "_".
      'content-disposition': 'inline; filename="foto _produk_1_.jpg"',
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
    });
    expect(Buffer.from(await response.arrayBuffer())).toEqual(JPEG);
  });

  it('forces a download for types browsers should not render', async () => {
    const response = await fetchMedia(signedPath(ids.zip));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="katalog.zip"');
  });

  it('answers 403 MEDIA_LINK_INVALID for missing, tampered, foreign and expired signatures', async () => {
    const valid = new URL(`${api}${signedPath(ids.jpeg)}`);
    const exp = Number(valid.searchParams.get('exp'));
    const sig = valid.searchParams.get('sig')!;
    const expired = Math.floor(Date.now() / 1000) - 60;
    const tamperedSig = `${sig.slice(0, -2)}${sig.endsWith('AA') ? 'BB' : 'AA'}`;

    const cases: [string, string][] = [
      ['no query', `/media/${ids.jpeg}`],
      ['no signature', `/media/${ids.jpeg}?exp=${exp}`],
      ['tampered signature', `/media/${ids.jpeg}?exp=${exp}&sig=${tamperedSig}`],
      ['extended expiry', `/media/${ids.jpeg}?exp=${exp + 3600}&sig=${sig}`],
      ['other message', `/media/${ids.zip}?exp=${exp}&sig=${sig}`],
      ['non-integer expiry', `/media/${ids.jpeg}?exp=${exp}.5&sig=${sig}`],
      ['expired', `/media/${ids.jpeg}?exp=${expired}&sig=${signature(ids.jpeg, expired)}`],
    ];
    for (const [label, path] of cases) {
      const response = await fetchMedia(path);
      expect(response.status, label).toBe(403);
      // The media endpoint answers with a bare { code, message }, not the API error envelope.
      expect(await response.json(), label).toEqual({
        code: 'MEDIA_LINK_INVALID',
        message: 'This media link is invalid or has expired.',
      });
    }
  });

  it('answers 404 for valid links to messages without media', async () => {
    const noMedia = await fetchMedia(signedPath(ids.text));
    expect(noMedia.status).toBe(404);
    expect(await noMedia.json()).toMatchObject({ code: 'MEDIA_NOT_FOUND' });

    const unknown = await fetchMedia(signedPath('no-such-message'));
    expect(unknown.status).toBe(404);
    expect(await unknown.json()).toMatchObject({ code: 'MEDIA_NOT_FOUND' });
  });

  it('maps provider failures: gone → 404 MEDIA_EXPIRED, outage → 502 MEDIA_UNAVAILABLE', async () => {
    const gone = await fetchMedia(signedPath(ids.gone));
    expect(gone.status).toBe(404);
    expect(await gone.json()).toMatchObject({ code: 'MEDIA_EXPIRED' });

    const down = await fetchMedia(signedPath(ids.down));
    expect(down.status).toBe(502);
    expect(await down.json()).toMatchObject({ code: 'MEDIA_UNAVAILABLE' });
  });
});
