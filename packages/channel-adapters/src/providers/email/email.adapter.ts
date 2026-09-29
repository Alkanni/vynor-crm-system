import { createHash } from 'node:crypto';
import {
  EmailCredentialsSchema,
  type ChannelCapabilities,
  type EmailCredentials,
  type MailServerCredentials,
  type OutboundMessageIntent,
  type ProviderSendResult,
} from '@vynor/contracts';
import { ImapFlow } from 'imapflow';
import { simpleParser, type AddressObject, type ParsedMail } from 'mailparser';
import { createTransport } from 'nodemailer';
import { ChannelProviderError, type ProviderErrorCategory } from '../../errors/provider-error.js';
import type {
  AdapterAccount,
  ChannelAdapter,
  ChannelHealthResult,
  ExtractedProviderEvent,
  NormalizeContext,
  NormalizedInboundResult,
  PollResult,
  VerifiedAccount,
} from '../../interfaces/channel-adapter.interface.js';
import type { AdapterRuntimeConfig } from '../../runtime/runtime-config.js';
import { asArray, asNumber, asRecord, asString, compact } from '../../util/payload.js';
import { stripQuotedReply } from './reply-trimmer.js';

const PROVIDER = 'EMAIL_SMTP_IMAP' as const;

/** Messages fetched per poll; the next poll continues where this one stopped. */
const POLL_BATCH_SIZE = 10;
/** Larger messages are journaled from their envelope only (no body download). */
const MAX_PARSE_BYTES = 15 * 1024 * 1024;
/** Journaled plain text is capped to keep provider_events rows small. */
const MAX_TEXT_CHARS = 100_000;
/** Date headers further than this from the receive time come from a wrong sender clock. */
const MAX_DATE_SKEW_MS = 10 * 60_000;

/** Uses the Date header unless the sender's clock is clearly off, then the receive time. */
function receivedTimestamp(dateHeader: string | undefined): string {
  const now = Date.now();
  const parsed = dateHeader ? Date.parse(dateHeader) : Number.NaN;
  return Number.isNaN(parsed) || Math.abs(parsed - now) > MAX_DATE_SKEW_MS
    ? new Date(now).toISOString()
    : new Date(parsed).toISOString();
}

export const EMAIL_CAPABILITIES: ChannelCapabilities = {
  text: true,
  media: {
    images: true,
    audio: true,
    video: true,
    documents: true,
    stickers: false,
    voiceNotes: false,
  },
  location: false,
  contacts: false,
  interactive: { buttons: false, lists: false, quickReplies: false, templates: false },
  reactions: false,
  readReceipts: false,
  deliveryReceipts: false,
  typingIndicators: false,
  replyContext: true,
};

type Phase = 'verify' | 'runtime';

const TLS_ERROR_CODES = new Set([
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_HAS_EXPIRED',
  'ERR_SSL_WRONG_VERSION_NUMBER',
  'ETLS',
]);

/** Translates IMAP/SMTP library errors into categorised provider errors. */
export function mapMailError(
  error: unknown,
  protocol: 'IMAP' | 'SMTP',
  server: MailServerCredentials,
  phase: Phase,
): ChannelProviderError {
  if (error instanceof ChannelProviderError) return error;
  const err = asRecord(error);
  const code = asString(err.code) ?? '';
  const responseCode = asNumber(err.responseCode);
  const where = `${protocol} ${server.host}:${server.port}`;
  const underlying = error instanceof Error ? error.message : String(error);

  let category: ProviderErrorCategory;
  let message: string;
  if (err.authenticationFailed === true || code === 'EAUTH' || code === 'ENOAUTH') {
    category = 'AUTHENTICATION';
    message = `${where} rejected the username or password. For Gmail and Outlook, use an app password instead of your normal password.`;
  } else if (TLS_ERROR_CODES.has(code) || /ssl|tls|certificate/i.test(underlying)) {
    category = 'CONFIGURATION';
    message = `Secure connection to ${where} failed (${underlying}). Check the SSL/TLS setting: port 993/465 usually need SSL on, 143/587 need it off (STARTTLS).`;
  } else if (['ENOTFOUND', 'EAI_AGAIN', 'EDNS'].includes(code)) {
    category = phase === 'verify' ? 'CONFIGURATION' : 'TRANSIENT';
    message = `Could not find the server ${server.host}. Check the ${protocol} host name.`;
  } else if (
    [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'CONNECT_TIMEOUT',
      'GREETING_TIMEOUT',
      'ECONNECTION',
      'ESOCKET',
      'ECONNRESET',
      'EHOSTUNREACH',
    ].includes(code)
  ) {
    category = phase === 'verify' ? 'CONFIGURATION' : 'TRANSIENT';
    message = `Could not connect to ${where} (${code}). Check the host, port and SSL setting.`;
  } else if (code === 'EENVELOPE') {
    category = 'RECIPIENT_UNAVAILABLE';
    message = `The mail server refused the recipient: ${underlying}`;
  } else if (responseCode !== undefined && responseCode >= 400 && responseCode < 500) {
    category = 'TRANSIENT';
    message = `The mail server asked to try again later: ${underlying}`;
  } else if (responseCode !== undefined && responseCode >= 500) {
    category = 'INVALID_REQUEST';
    message = `The mail server rejected the message: ${underlying}`;
  } else {
    category = phase === 'verify' ? 'CONFIGURATION' : 'TRANSIENT';
    message = `${where} failed: ${underlying}`;
  }

  return new ChannelProviderError({
    provider: PROVIDER,
    category,
    code: code || (responseCode !== undefined ? `SMTP_${responseCode}` : 'MAIL_ERROR'),
    message,
    cause: error,
  });
}

function imapClient(server: MailServerCredentials, timeoutMs: number): ImapFlow {
  return new ImapFlow({
    host: server.host,
    port: server.port,
    secure: server.secure,
    auth: { user: server.username, pass: server.password },
    logger: false,
    disableAutoIdle: true,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: Math.max(timeoutMs * 4, 60_000),
    clientInfo: { name: 'VYNOR CRM' },
  });
}

function smtpTransport(server: MailServerCredentials, timeoutMs: number) {
  return createTransport({
    host: server.host,
    port: server.port,
    secure: server.secure,
    auth: { user: server.username, pass: server.password },
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: Math.max(timeoutMs * 2, 30_000),
  });
}

function firstAddress(value: AddressObject | AddressObject[] | undefined): {
  address: string;
  name: string;
} | null {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  for (const group of list) {
    for (const entry of group.value) {
      if (entry.address) return { address: entry.address.toLowerCase(), name: entry.name ?? '' };
    }
  }
  return null;
}

function allAddresses(
  value: AddressObject | AddressObject[] | undefined,
): { address: string; name: string }[] {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.flatMap((group) =>
    group.value
      .filter((entry) => entry.address)
      .map((entry) => ({ address: (entry.address ?? '').toLowerCase(), name: entry.name ?? '' })),
  );
}

function headerText(parsed: ParsedMail, name: string): string | undefined {
  const value = parsed.headers.get(name);
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'value' in value) {
    return String((value as { value: unknown }).value);
  }
  return undefined;
}

function eventKeyFor(messageId: string | undefined, uidValidity: string, uid: number): string {
  if (!messageId) return `uid:${uidValidity}:${uid}`;
  const key = `mid:${messageId}`;
  return key.length <= 255
    ? key
    : `mid-sha256:${createHash('sha256').update(messageId).digest('hex')}`;
}

/** Builds the journal payload for one email (bodies of attachments are not stored). */
export function emailToJournalPayload(
  parsed: ParsedMail,
  uid: number,
  uidValidity: string,
): Record<string, unknown> {
  const references = Array.isArray(parsed.references)
    ? parsed.references
    : parsed.references
      ? parsed.references.split(/\s+/).filter(Boolean)
      : [];
  const text = (parsed.text ?? '').slice(0, MAX_TEXT_CHARS);
  return compact({
    uid,
    uidValidity,
    messageId: parsed.messageId,
    inReplyTo: parsed.inReplyTo,
    references,
    subject: parsed.subject,
    date: parsed.date?.toISOString(),
    from: firstAddress(parsed.from) ?? undefined,
    to: allAddresses(parsed.to),
    cc: allAddresses(parsed.cc),
    replyTo: firstAddress(parsed.replyTo) ?? undefined,
    text,
    autoSubmitted: headerText(parsed, 'auto-submitted'),
    attachments: parsed.attachments.map((a) =>
      compact({
        filename: a.filename,
        contentType: a.contentType,
        size: a.size,
        inline: a.related || a.contentDisposition === 'inline' ? true : undefined,
      }),
    ),
  });
}

/**
 * Email adapter: IMAP polling for inbound mail, SMTP for replies. Each email thread becomes
 * one conversation (threaded through Message-ID / In-Reply-To / References).
 */
export class EmailAdapter implements ChannelAdapter<EmailCredentials> {
  readonly provider = PROVIDER;
  readonly channelType = 'EMAIL' as const;
  readonly capabilities = EMAIL_CAPABILITIES;
  readonly credentialsSchema = EmailCredentialsSchema;
  readonly inbound = 'POLLING' as const;
  readonly generatedSecrets = [] as const;

  constructor(private readonly runtime: AdapterRuntimeConfig) {}

  private async withImap<T>(
    server: MailServerCredentials,
    phase: Phase,
    work: (client: ImapFlow) => Promise<T>,
  ): Promise<T> {
    const client = imapClient(server, this.runtime.httpTimeoutMs);
    // Socket errors after connect are also surfaced through the awaited command.
    client.on('error', () => undefined);
    try {
      await client.connect();
      return await work(client);
    } catch (error) {
      throw mapMailError(error, 'IMAP', server, phase);
    } finally {
      await client.logout().catch(() => client.close());
    }
  }

  private async verifySmtp(server: MailServerCredentials, phase: Phase): Promise<void> {
    const transport = smtpTransport(server, this.runtime.httpTimeoutMs);
    try {
      await transport.verify();
    } catch (error) {
      throw mapMailError(error, 'SMTP', server, phase);
    } finally {
      transport.close();
    }
  }

  async verifyCredentials(credentials: EmailCredentials): Promise<VerifiedAccount> {
    const status = await this.withImap(credentials.imap, 'verify', (client) =>
      client.status('INBOX', { uidNext: true, uidValidity: true, messages: true }),
    );
    await this.verifySmtp(credentials.smtp, 'verify');

    return {
      accountIdentifier: credentials.emailAddress,
      displayIdentifier: credentials.emailAddress,
      ...(credentials.senderName ? { displayName: credentials.senderName } : {}),
      metadata: { mailboxMessages: status.messages ?? 0 },
      // Start after the newest existing email so old mail is not imported.
      initialCursor: {
        uidValidity: String(status.uidValidity ?? ''),
        lastUid: Math.max(0, (status.uidNext ?? 1) - 1),
      },
    };
  }

  async pollInbound(
    account: AdapterAccount<EmailCredentials>,
    cursor: Record<string, unknown> | null,
  ): Promise<PollResult> {
    const { imap } = account.credentials;
    const fetched = await this.withImap(imap, 'runtime', async (client) => {
      const lock = await client.getMailboxLock('INBOX');
      try {
        const mailbox = client.mailbox;
        const uidValidity = mailbox ? String(mailbox.uidValidity) : '';
        const uidNext = mailbox ? mailbox.uidNext : 1;
        const sameMailbox = asString(cursor?.uidValidity) === uidValidity;
        // A changed UIDVALIDITY means the mailbox was rebuilt: restart from its current end.
        const lastUid = sameMailbox ? (asNumber(cursor?.lastUid) ?? uidNext - 1) : uidNext - 1;

        if (uidNext - 1 <= lastUid) {
          return {
            uidValidity,
            lastUid,
            messages: [] as {
              uid: number;
              source?: Buffer;
              oversized: boolean;
              envelope?: unknown;
            }[],
          };
        }

        const found = await client.search({ uid: `${lastUid + 1}:*` }, { uid: true });
        const uids = (Array.isArray(found) ? found : [])
          .filter((uid) => uid > lastUid)
          .sort((a, b) => a - b)
          .slice(0, POLL_BATCH_SIZE);
        if (uids.length === 0) return { uidValidity, lastUid, messages: [] };

        const summaries = await client.fetchAll(uids, { uid: true, size: true }, { uid: true });
        const messages: { uid: number; source?: Buffer; oversized: boolean; envelope?: unknown }[] =
          [];
        for (const summary of summaries.sort((a, b) => a.uid - b.uid)) {
          if ((summary.size ?? 0) > MAX_PARSE_BYTES) {
            // Only the envelope of oversized mail is read, never its body.
            const head = await client.fetchOne(
              String(summary.uid),
              { uid: true, envelope: true },
              { uid: true },
            );
            messages.push({
              uid: summary.uid,
              oversized: true,
              envelope: head ? head.envelope : undefined,
            });
            continue;
          }
          const full = await client.fetchOne(
            String(summary.uid),
            { uid: true, source: true },
            { uid: true },
          );
          messages.push({
            uid: summary.uid,
            oversized: false,
            ...(full && full.source ? { source: full.source } : {}),
          });
        }
        return { uidValidity, lastUid, messages };
      } finally {
        lock.release();
      }
    });

    const events: ExtractedProviderEvent[] = [];
    let lastUid = fetched.lastUid;
    for (const message of fetched.messages) {
      lastUid = Math.max(lastUid, message.uid);
      if (message.oversized || !message.source) {
        const envelope = asRecord(message.envelope);
        const messageId = asString(envelope.messageId);
        events.push({
          providerEventKey: eventKeyFor(messageId, fetched.uidValidity, message.uid),
          isFingerprinted: false,
          payload: compact({
            uid: message.uid,
            uidValidity: fetched.uidValidity,
            messageId,
            subject: asString(envelope.subject),
            from: asArray(envelope.from)
              .map(asRecord)
              .map((f) => ({
                address: (asString(f.address) ?? '').toLowerCase(),
                name: asString(f.name) ?? '',
              }))[0],
            text: 'This email is too large to import. Open it in your mail client.',
            oversized: true,
          }),
        });
        continue;
      }
      const parsed = await simpleParser(message.source);
      events.push({
        providerEventKey: eventKeyFor(parsed.messageId, fetched.uidValidity, message.uid),
        isFingerprinted: false,
        payload: emailToJournalPayload(parsed, message.uid, fetched.uidValidity),
      });
    }

    return { events, cursor: { uidValidity: fetched.uidValidity, lastUid } };
  }

  async normalizeInbound(
    payload: Record<string, unknown>,
    context: NormalizeContext,
    account: AdapterAccount<EmailCredentials>,
  ): Promise<NormalizedInboundResult[]> {
    const from = asRecord(payload.from);
    const address = asString(from.address)?.toLowerCase();
    if (!address) return [{ type: 'IGNORED', reason: 'Email without a sender address.' }];
    if (address === account.credentials.emailAddress.toLowerCase()) {
      return [{ type: 'IGNORED', reason: 'Email sent by this mailbox itself.' }];
    }
    const autoSubmitted = asString(payload.autoSubmitted)?.toLowerCase();
    if (autoSubmitted && autoSubmitted !== 'no') {
      return [{ type: 'IGNORED', reason: 'Automatic reply (out of office or similar).' }];
    }

    const messageId =
      asString(payload.messageId) ??
      `uid:${asString(payload.uidValidity)}:${asString(payload.uid)}`;
    const inReplyTo = asString(payload.inReplyTo);
    const references = asArray(payload.references)
      .map((r) => asString(r))
      .filter((r): r is string => Boolean(r));
    const fullText = asString(payload.text) ?? '';
    const text = stripQuotedReply(fullText) || fullText || '(no text content)';
    const subject = asString(payload.subject);

    return [
      {
        type: 'MESSAGE',
        data: {
          workspaceId: context.workspaceId,
          channelType: 'EMAIL',
          provider: PROVIDER,
          providerAccountId: context.providerAccountId,
          providerMessageId: messageId,
          sender: {
            identifier: address,
            displayName: asString(from.name) || address,
            metadata: { email: address },
          },
          recipient: { identifier: account.credentials.emailAddress },
          timestamp: receivedTimestamp(asString(payload.date)),
          content: { type: 'TEXT', text },
          ...(inReplyTo ? { replyContext: { targetProviderMessageId: inReplyTo } } : {}),
          rawEventRef: {
            providerEventId: context.providerEventId,
            providerEventKey: context.providerEventKey,
          },
          metadata: compact({
            subject,
            threadId: references[0] ?? inReplyTo ?? messageId,
            inReplyTo,
            references,
            cc: payload.cc,
            attachments: asArray(payload.attachments).length ? payload.attachments : undefined,
            fullText: fullText !== text ? fullText : undefined,
          }),
        },
      },
    ];
  }

  async sendMessage(
    intent: OutboundMessageIntent,
    account: AdapterAccount<EmailCredentials>,
  ): Promise<ProviderSendResult> {
    if (intent.content.type !== 'TEXT') {
      throw new ChannelProviderError({
        provider: PROVIDER,
        category: 'INVALID_REQUEST',
        code: 'EMAIL_CONTENT_UNSUPPORTED',
        message: 'Only text replies can be sent by email for now.',
      });
    }
    const { credentials } = account;
    const metadata = asRecord(intent.metadata);
    const subject = asString(metadata.subject);
    const references = asArray(metadata.references)
      .map((r) => asString(r))
      .filter((r): r is string => Boolean(r));
    const inReplyTo = asString(metadata.inReplyTo);
    const domain = credentials.emailAddress.split('@')[1] ?? 'vynor.local';
    const messageId = `<${intent.intentId}@${domain}>`;

    const transport = smtpTransport(credentials.smtp, this.runtime.httpTimeoutMs);
    try {
      const info = await transport.sendMail({
        from: { name: credentials.senderName || account.name, address: credentials.emailAddress },
        to: intent.recipient.destination,
        subject: subject
          ? /^re:/i.test(subject)
            ? subject
            : `Re: ${subject}`
          : `Message from ${account.name}`,
        text: intent.content.text,
        messageId,
        ...(inReplyTo ? { inReplyTo } : {}),
        ...(references.length ? { references } : {}),
      });
      const rejected = asArray(info.rejected).map((r) =>
        typeof r === 'string' ? r : asString(asRecord(r).address),
      );
      if (rejected.includes(intent.recipient.destination)) {
        throw new ChannelProviderError({
          provider: PROVIDER,
          category: 'RECIPIENT_UNAVAILABLE',
          code: 'RECIPIENT_REJECTED',
          message: `The mail server rejected ${intent.recipient.destination}.`,
        });
      }
      return {
        status: 'ACCEPTED',
        providerMessageId: asString(info.messageId) ?? messageId,
        providerTimestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw mapMailError(error, 'SMTP', credentials.smtp, 'runtime');
    } finally {
      transport.close();
    }
  }

  async healthCheck(account: AdapterAccount<EmailCredentials>): Promise<ChannelHealthResult> {
    const started = Date.now();
    const status = await this.withImap(account.credentials.imap, 'verify', (client) =>
      client.status('INBOX', { messages: true, unseen: true }),
    );
    await this.verifySmtp(account.credentials.smtp, 'verify');
    return {
      isHealthy: true,
      provider: PROVIDER,
      channelType: 'EMAIL',
      latencyMs: Date.now() - started,
      message: `Signed in to ${account.credentials.emailAddress} (IMAP and SMTP).`,
      details: compact({ messages: status.messages, unseen: status.unseen }),
    };
  }
}
