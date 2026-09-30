import {
  PROVIDER_SECRET_FIELDS,
  ProviderCredentialEnvelopeSchema,
  type AuthType,
  type ChannelProviderType,
  type ProviderCredentialEnvelope,
  type ProviderType,
} from '@vynor/contracts';
import { CredentialCipherError, type CredentialCipher } from '@vynor/shared';
import type { GeneratedChannelSecrets } from '../interfaces/channel-adapter.interface.js';

/**
 * Seals and opens channel credentials as a `ProviderCredentialEnvelope`
 * (docs/secret-management-and-rotation.md). The plaintext holds the admin-entered credentials
 * plus server-generated secrets; the ciphertext is bound to the provider account ID.
 */

export interface ChannelSecrets<TCredentials = unknown> {
  credentials: TCredentials;
  generated: GeneratedChannelSecrets;
}

const ENVELOPE_PROVIDERS: Record<ChannelProviderType, ProviderType> = {
  WHATSAPP_CLOUD: 'meta_whatsapp',
  META_MESSENGER: 'facebook_messenger',
  META_INSTAGRAM: 'instagram',
  TELEGRAM_BOT: 'telegram',
  EMAIL_SMTP_IMAP: 'email_smtp',
  LINE_MESSAGING: 'line_messaging',
  WEBCHAT_EMBED: 'webchat',
  CUSTOM_WEBHOOK: 'custom_webhook',
};

const ENVELOPE_AUTH_TYPES: Record<ChannelProviderType, AuthType> = {
  WHATSAPP_CLOUD: 'bearer_token',
  META_MESSENGER: 'bearer_token',
  META_INSTAGRAM: 'bearer_token',
  TELEGRAM_BOT: 'bearer_token',
  EMAIL_SMTP_IMAP: 'basic_auth',
  LINE_MESSAGING: 'bearer_token',
  WEBCHAT_EMBED: 'hmac_key',
  CUSTOM_WEBHOOK: 'hmac_key',
};

function aadFor(providerAccountId: string): string {
  return `vynor:provider-account:${providerAccountId}`;
}

export function sealChannelSecrets<TCredentials>(
  cipher: CredentialCipher,
  params: {
    provider: ChannelProviderType;
    providerAccountId: string;
    secrets: ChannelSecrets<TCredentials>;
    createdAt?: Date;
    rotatedAt?: Date;
  },
): ProviderCredentialEnvelope {
  const sealed = cipher.encryptJson(params.secrets, aadFor(params.providerAccountId));
  return {
    provider: ENVELOPE_PROVIDERS[params.provider],
    accountId: params.providerAccountId,
    authType: ENVELOPE_AUTH_TYPES[params.provider],
    encryptedPayload: sealed.ciphertext,
    keyId: sealed.keyId,
    iv: sealed.iv,
    tag: sealed.tag,
    createdAt: (params.createdAt ?? new Date()).toISOString(),
    ...(params.rotatedAt ? { rotatedAt: params.rotatedAt.toISOString() } : {}),
  };
}

export function openChannelSecrets<TCredentials = unknown>(
  cipher: CredentialCipher,
  envelope: unknown,
  providerAccountId: string,
): ChannelSecrets<TCredentials> {
  const parsed = ProviderCredentialEnvelopeSchema.safeParse(envelope);
  if (!parsed.success) {
    throw new CredentialCipherError(
      'Stored channel credentials are not an encrypted envelope. Reconnect the channel.',
    );
  }
  if (parsed.data.accountId !== providerAccountId) {
    throw new CredentialCipherError('Stored channel credentials belong to another channel.');
  }
  return cipher.decryptJson<ChannelSecrets<TCredentials>>(
    {
      keyId: parsed.data.keyId,
      iv: parsed.data.iv,
      tag: parsed.data.tag,
      ciphertext: parsed.data.encryptedPayload,
    },
    aadFor(providerAccountId),
  );
}

/** Masks a secret for display: keeps the last four characters. */
export function maskSecret(value: string): string {
  if (value.length <= 8) return '••••';
  return `••••${value.slice(-4)}`;
}

function getPath(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => {
    if (node && typeof node === 'object') return (node as Record<string, unknown>)[key];
    return undefined;
  }, source);
}

function withoutPath(source: Record<string, unknown>, path: string): Record<string, unknown> {
  const [head, ...rest] = path.split('.');
  if (!head || !(head in source)) return source;
  const copy = { ...source };
  if (rest.length === 0) {
    delete copy[head];
    return copy;
  }
  const child = copy[head];
  if (child && typeof child === 'object') {
    copy[head] = withoutPath(child as Record<string, unknown>, rest.join('.'));
  }
  return copy;
}

/**
 * Splits credentials into the non-secret fields (safe to return, used to prefill forms) and
 * masked hints of the secrets.
 */
export function presentCredentials(
  provider: ChannelProviderType,
  credentials: Record<string, unknown>,
): { details: Record<string, unknown>; hints: Record<string, string> } {
  let details = credentials;
  const hints: Record<string, string> = {};
  for (const path of PROVIDER_SECRET_FIELDS[provider]) {
    const value = getPath(credentials, path);
    if (typeof value === 'string' && value.length > 0) {
      if (path.endsWith('password')) {
        // Unlike tokens, no part of a password is ever shown.
        hints[path] = '••••••••';
      } else if (provider === 'TELEGRAM_BOT' && path === 'botToken') {
        // The numeric bot ID before the colon is public; only the secret part is masked.
        hints[path] = `${value.split(':')[0]}:${maskSecret(value.split(':')[1] ?? '')}`;
      } else {
        hints[path] = maskSecret(value);
      }
    }
    details = withoutPath(details, path);
  }
  return { details, hints };
}
