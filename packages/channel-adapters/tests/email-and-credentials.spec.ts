import { randomBytes } from 'node:crypto';
import { simpleParser } from 'mailparser';
import { CredentialCipher } from '@vynor/shared';
import { describe, expect, it } from 'vitest';
import {
  EmailAdapter,
  emailToJournalPayload,
  mapMailError,
  openChannelSecrets,
  presentCredentials,
  sealChannelSecrets,
  stripQuotedReply,
} from '../src/index.js';
import { accountFor, normalizeContext, runtimeWith, createMockFetch } from './helpers.js';

const emailCredentials = {
  emailAddress: 'support@toko.example',
  senderName: 'Toko Support',
  imap: {
    host: 'imap.toko.example',
    port: 993,
    secure: true,
    username: 'support@toko.example',
    password: 'imap-pass',
  },
  smtp: {
    host: 'smtp.toko.example',
    port: 465,
    secure: true,
    username: 'support@toko.example',
    password: 'smtp-pass',
  },
};

const RAW_EMAIL = [
  'From: Budi Santoso <Budi@Customer.example>',
  'To: Toko Support <support@toko.example>',
  'Subject: Re: Pesanan #1234',
  'Message-ID: <reply-2@customer.example>',
  'In-Reply-To: <out-1@toko.example>',
  'References: <root-0@customer.example> <out-1@toko.example>',
  'Date: Tue, 29 Sep 2026 10:15:00 +0700',
  'Content-Type: multipart/mixed; boundary="b1"',
  'MIME-Version: 1.0',
  '',
  '--b1',
  'Content-Type: text/plain; charset=utf-8',
  '',
  'Terima kasih, barangnya sudah sampai.',
  '',
  'On Mon, 28 Sep 2026 at 09:00, Toko Support <support@toko.example> wrote:',
  '> Pesanan Anda sudah dikirim.',
  '',
  '--b1',
  'Content-Type: application/pdf; name="bukti.pdf"',
  'Content-Disposition: attachment; filename="bukti.pdf"',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from('%PDF-1.4 test').toString('base64'),
  '--b1--',
  '',
].join('\r\n');

describe('EmailAdapter', () => {
  it('journals parsed emails without attachment bodies and threads them by References', async () => {
    const parsed = await simpleParser(Buffer.from(RAW_EMAIL));
    const payload = emailToJournalPayload(parsed, 17, '1700000000');
    expect(payload).toMatchObject({
      uid: 17,
      uidValidity: '1700000000',
      messageId: '<reply-2@customer.example>',
      inReplyTo: '<out-1@toko.example>',
      references: ['<root-0@customer.example>', '<out-1@toko.example>'],
      subject: 'Re: Pesanan #1234',
      from: { address: 'budi@customer.example', name: 'Budi Santoso' },
      attachments: [{ filename: 'bukti.pdf', contentType: 'application/pdf' }],
    });
    expect(JSON.stringify(payload)).not.toContain('JVBERi0'); // no base64 attachment body

    const adapter = new EmailAdapter(runtimeWith(createMockFetch([]).fetchImpl));
    const account = accountFor(emailCredentials, {
      accountIdentifier: emailCredentials.emailAddress,
    });
    const [result] = await adapter.normalizeInbound(payload, normalizeContext, account);
    expect(result).toMatchObject({
      type: 'MESSAGE',
      data: {
        channelType: 'EMAIL',
        providerMessageId: '<reply-2@customer.example>',
        sender: { identifier: 'budi@customer.example', displayName: 'Budi Santoso' },
        content: { type: 'TEXT', text: 'Terima kasih, barangnya sudah sampai.' },
        replyContext: { targetProviderMessageId: '<out-1@toko.example>' },
        metadata: { subject: 'Re: Pesanan #1234', threadId: '<root-0@customer.example>' },
      },
    });
  });

  it('ignores mail sent by the mailbox itself and automatic replies', async () => {
    const adapter = new EmailAdapter(runtimeWith(createMockFetch([]).fetchImpl));
    const account = accountFor(emailCredentials);
    const [own] = await adapter.normalizeInbound(
      { messageId: '<a@x>', from: { address: 'support@toko.example' }, text: 'hi' },
      normalizeContext,
      account,
    );
    expect(own).toMatchObject({ type: 'IGNORED' });
    const [auto] = await adapter.normalizeInbound(
      {
        messageId: '<b@x>',
        from: { address: 'x@y.example' },
        text: 'Out of office',
        autoSubmitted: 'auto-replied',
      },
      normalizeContext,
      account,
    );
    expect(auto).toMatchObject({ type: 'IGNORED' });
  });

  it('classifies login, TLS and network failures with actionable messages', () => {
    const auth = mapMailError(
      Object.assign(new Error('Invalid credentials'), { authenticationFailed: true }),
      'IMAP',
      emailCredentials.imap,
      'verify',
    );
    expect(auth.category).toBe('AUTHENTICATION');
    expect(auth.message).toContain('app password');
    expect(auth.message).not.toContain('imap-pass');

    const tls = mapMailError(
      Object.assign(new Error('wrong version number'), { code: 'ERR_SSL_WRONG_VERSION_NUMBER' }),
      'SMTP',
      emailCredentials.smtp,
      'verify',
    );
    expect(tls.category).toBe('CONFIGURATION');

    const dnsVerify = mapMailError(
      Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }),
      'IMAP',
      emailCredentials.imap,
      'verify',
    );
    expect(dnsVerify.category).toBe('CONFIGURATION');
    const dnsRuntime = mapMailError(
      Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }),
      'IMAP',
      emailCredentials.imap,
      'runtime',
    );
    expect(dnsRuntime.retryable).toBe(true);

    const rejected = mapMailError(
      Object.assign(new Error('550 no such user'), { code: 'EENVELOPE', responseCode: 550 }),
      'SMTP',
      emailCredentials.smtp,
      'runtime',
    );
    expect(rejected.category).toBe('RECIPIENT_UNAVAILABLE');
  });

  it('strips quoted history from English, Indonesian and Outlook replies', () => {
    expect(stripQuotedReply('Oke siap\n\nOn Mon, 1 Sep 2026, A <a@x.com> wrote:\n> lama')).toBe(
      'Oke siap',
    );
    expect(
      stripQuotedReply(
        'Baik\n\nPada tanggal Sen, 1 Sep 2026 pukul 10.00 A <a@x.com> menulis:\n> lama',
      ),
    ).toBe('Baik');
    expect(stripQuotedReply('Noted\n\nFrom: A\nSent: Monday\nTo: B\nSubject: x\n\nold')).toBe(
      'Noted',
    );
    expect(stripQuotedReply('From: my shop in Bandung, we ship daily.')).toBe(
      'From: my shop in Bandung, we ship daily.',
    );
    expect(stripQuotedReply('Just text')).toBe('Just text');
  });
});

describe('Channel credential envelopes', () => {
  const cipher = new CredentialCipher('v1', randomBytes(32));

  it('seals credentials into a ProviderCredentialEnvelope bound to the channel', () => {
    const envelope = sealChannelSecrets(cipher, {
      provider: 'EMAIL_SMTP_IMAP',
      providerAccountId: 'ch_1',
      secrets: { credentials: emailCredentials, generated: {} },
    });
    expect(envelope).toMatchObject({
      provider: 'email_smtp',
      accountId: 'ch_1',
      authType: 'basic_auth',
      keyId: 'v1',
    });
    expect(JSON.stringify(envelope)).not.toContain('imap-pass');

    expect(openChannelSecrets(cipher, envelope, 'ch_1').credentials).toEqual(emailCredentials);
    expect(() => openChannelSecrets(cipher, envelope, 'ch_2')).toThrow(/another channel/);
    expect(() => openChannelSecrets(cipher, { plain: 'json' }, 'ch_1')).toThrow(/Reconnect/);
  });

  it('presents non-secret fields and masked hints only', () => {
    const email = presentCredentials('EMAIL_SMTP_IMAP', emailCredentials);
    expect(email.details).toEqual({
      emailAddress: 'support@toko.example',
      senderName: 'Toko Support',
      imap: {
        host: 'imap.toko.example',
        port: 993,
        secure: true,
        username: 'support@toko.example',
      },
      smtp: {
        host: 'smtp.toko.example',
        port: 465,
        secure: true,
        username: 'support@toko.example',
      },
    });
    expect(email.hints).toEqual({ 'imap.password': '••••••••', 'smtp.password': '••••••••' });

    const telegram = presentCredentials('TELEGRAM_BOT', {
      botToken: '7234567890:AAEexampleTOKENexampleTOKENexample12',
    });
    expect(telegram.details).toEqual({});
    expect(telegram.hints.botToken).toBe('7234567890:••••le12');
  });
});
