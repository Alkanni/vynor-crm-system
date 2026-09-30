import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  CredentialCipher,
  CredentialCipherError,
  parseEncryptionKey,
  parsePreviousKeys,
} from '../src/index.js';

const keyA = randomBytes(32);
const keyB = randomBytes(32);

describe('CredentialCipher (issue #37, docs/secret-management-and-rotation.md)', () => {
  it('round-trips JSON secrets and never stores plaintext', () => {
    const cipher = new CredentialCipher('v1', keyA);
    const secret = { botToken: '123456789:AAEexampleexampleexampleexample123' };

    const sealed = cipher.encryptJson(secret, 'provider-account:ch_1');

    expect(sealed.keyId).toBe('v1');
    expect(sealed.ciphertext).not.toContain('AAEexample');
    expect(Buffer.from(sealed.iv, 'base64')).toHaveLength(12);
    expect(cipher.decryptJson(sealed, 'provider-account:ch_1')).toEqual(secret);
  });

  it('uses a fresh IV for every encryption', () => {
    const cipher = new CredentialCipher('v1', keyA);
    const first = cipher.encrypt('same', 'aad');
    const second = cipher.encrypt('same', 'aad');
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it('rejects a ciphertext moved to another record (AAD mismatch)', () => {
    const cipher = new CredentialCipher('v1', keyA);
    const sealed = cipher.encrypt('secret', 'provider-account:ch_1');
    expect(() => cipher.decrypt(sealed, 'provider-account:ch_2')).toThrow(CredentialCipherError);
  });

  it('detects tampering with the ciphertext or tag', () => {
    const cipher = new CredentialCipher('v1', keyA);
    const sealed = cipher.encrypt('secret-value', 'aad');
    const bytes = Buffer.from(sealed.ciphertext, 'base64');
    bytes[0] = (bytes[0] ?? 0) ^ 0xff;

    expect(() =>
      cipher.decrypt({ ...sealed, ciphertext: bytes.toString('base64') }, 'aad'),
    ).toThrow(CredentialCipherError);
    expect(() =>
      cipher.decrypt({ ...sealed, tag: randomBytes(16).toString('base64') }, 'aad'),
    ).toThrow(CredentialCipherError);
  });

  it('keeps decrypting rows sealed with a retired key after rotation', () => {
    const oldCipher = new CredentialCipher('v1', keyA);
    const sealed = oldCipher.encrypt('rotating', 'aad');

    const rotated = new CredentialCipher('v2', keyB, new Map([['v1', keyA]]));
    expect(rotated.decrypt(sealed, 'aad')).toBe('rotating');
    expect(rotated.needsRotation(sealed)).toBe(true);
    expect(rotated.encrypt('fresh', 'aad').keyId).toBe('v2');

    const withoutOldKey = new CredentialCipher('v2', keyB);
    expect(() => withoutOldKey.decrypt(sealed, 'aad')).toThrow(/key ID "v1"/);
  });

  it('builds from environment variables and parses base64 or hex keys', () => {
    expect(CredentialCipher.fromEnv({})).toBeNull();

    const cipher = CredentialCipher.fromEnv({
      ENCRYPTION_MASTER_KEY: keyB.toString('base64'),
      ENCRYPTION_KEY_ID: 'v2',
      ENCRYPTION_PREVIOUS_KEYS: `v1:${keyA.toString('hex')}`,
    });
    expect(cipher?.keyId).toBe('v2');
    expect(parseEncryptionKey(keyA.toString('hex')).equals(keyA)).toBe(true);
    expect(
      parsePreviousKeys(`v1:${keyA.toString('base64')}`)
        .get('v1')
        ?.equals(keyA),
    ).toBe(true);
    expect(() => parseEncryptionKey('too-short')).toThrow(CredentialCipherError);
    expect(() => parsePreviousKeys('missing-separator')).toThrow(CredentialCipherError);
  });

  it('derives purpose-specific keys that differ from each other and from the master key', () => {
    const cipher = new CredentialCipher('v1', keyA);
    const media = cipher.deriveKey('media-url');
    expect(media).toHaveLength(32);
    expect(media.equals(keyA)).toBe(false);
    expect(media.equals(cipher.deriveKey('other'))).toBe(false);
    expect(media.equals(cipher.deriveKey('media-url'))).toBe(true);
  });
});
