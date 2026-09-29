import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM encryption for secrets stored in the database (channel credentials, AI keys).
 * See docs/secret-management-and-rotation.md.
 *
 * Every ciphertext is bound to additional authenticated data (AAD), typically the owning
 * record's ID, so a ciphertext copied onto another row fails to decrypt. The key ID is stored
 * with the ciphertext so retired keys keep decrypting old rows during a rotation.
 *
 * Node-only (node:crypto); do not import from browser bundles.
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface EncryptedValue {
  keyId: string;
  /** Base64 initialisation vector (96 bits, random per encryption). */
  iv: string;
  /** Base64 GCM authentication tag. */
  tag: string;
  /** Base64 ciphertext. */
  ciphertext: string;
}

export class CredentialCipherError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'CredentialCipherError';
  }
}

/** Parses a 256-bit key given as base64 (44 chars) or hex (64 chars). */
export function parseEncryptionKey(raw: string): Buffer {
  const value = raw.trim();
  const key = /^[0-9a-f]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new CredentialCipherError(
      'Encryption key must be 32 bytes, encoded as base64 or hex (generate one with: openssl rand -base64 32).',
    );
  }
  return key;
}

/** Parses `kid:key,kid:key` into a key map. */
export function parsePreviousKeys(raw: string | undefined): Map<string, Buffer> {
  const keys = new Map<string, Buffer>();
  if (!raw) return keys;
  for (const entry of raw.split(',')) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf(':');
    if (separator <= 0) {
      throw new CredentialCipherError(
        'ENCRYPTION_PREVIOUS_KEYS entries must look like kid:base64key',
      );
    }
    keys.set(trimmed.slice(0, separator), parseEncryptionKey(trimmed.slice(separator + 1)));
  }
  return keys;
}

export interface CredentialCipherEnv {
  ENCRYPTION_MASTER_KEY?: string | undefined;
  ENCRYPTION_KEY_ID?: string | undefined;
  ENCRYPTION_PREVIOUS_KEYS?: string | undefined;
}

export class CredentialCipher {
  private readonly keys: Map<string, Buffer>;

  constructor(
    private readonly activeKeyId: string,
    activeKey: Buffer,
    previousKeys: Map<string, Buffer> = new Map(),
  ) {
    if (activeKey.length !== KEY_BYTES) {
      throw new CredentialCipherError('Active encryption key must be 32 bytes.');
    }
    this.keys = new Map(previousKeys);
    this.keys.set(activeKeyId, activeKey);
  }

  /** Builds a cipher from environment variables, or returns null when no key is configured. */
  static fromEnv(env: CredentialCipherEnv): CredentialCipher | null {
    if (!env.ENCRYPTION_MASTER_KEY) return null;
    return new CredentialCipher(
      env.ENCRYPTION_KEY_ID || 'v1',
      parseEncryptionKey(env.ENCRYPTION_MASTER_KEY),
      parsePreviousKeys(env.ENCRYPTION_PREVIOUS_KEYS),
    );
  }

  get keyId(): string {
    return this.activeKeyId;
  }

  encrypt(plaintext: string, aad: string): EncryptedValue {
    const key = this.requireKey(this.activeKeyId);
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return {
      keyId: this.activeKeyId,
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      ciphertext: ciphertext.toString('base64'),
    };
  }

  decrypt(value: EncryptedValue, aad: string): string {
    const key = this.requireKey(value.keyId);
    try {
      const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(value.iv, 'base64'), {
        authTagLength: TAG_BYTES,
      });
      decipher.setAAD(Buffer.from(aad, 'utf8'));
      decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(value.ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch (error) {
      // Never include key material or plaintext fragments in the error.
      throw new CredentialCipherError(
        'Stored secret could not be decrypted (wrong key, tampered data, or record mismatch).',
        { cause: error },
      );
    }
  }

  encryptJson(value: unknown, aad: string): EncryptedValue {
    return this.encrypt(JSON.stringify(value), aad);
  }

  decryptJson<T = unknown>(value: EncryptedValue, aad: string): T {
    return JSON.parse(this.decrypt(value, aad)) as T;
  }

  /** True when a ciphertext was produced with a key other than the active one. */
  needsRotation(value: Pick<EncryptedValue, 'keyId'>): boolean {
    return value.keyId !== this.activeKeyId;
  }

  /**
   * Derives an independent 256-bit key for another purpose (e.g. signing media URLs) so the
   * master key itself is only ever used for encryption.
   */
  deriveKey(purpose: string): Buffer {
    const master = this.requireKey(this.activeKeyId);
    return Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), `vynor:${purpose}`, KEY_BYTES));
  }

  private requireKey(keyId: string): Buffer {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new CredentialCipherError(
        `No encryption key is configured for key ID "${keyId}". Add it to ENCRYPTION_PREVIOUS_KEYS.`,
      );
    }
    return key;
  }
}
