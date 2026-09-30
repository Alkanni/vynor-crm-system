import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { safeEqual } from '@vynor/channel-adapters';
import { ChannelRuntimeService } from '../channels/channel-runtime.service.js';

/** Signed media links stay valid this long; message lists are refetched well before. */
const MEDIA_URL_TTL_SECONDS = 60 * 60;

/**
 * Short-lived signed URLs for inbound media, so `<img>`/`<audio>` tags can load files through
 * the API proxy without sending the agent's bearer token.
 */
@Injectable()
export class MediaUrlService {
  private readonly key: Buffer | null;

  constructor(private readonly runtime: ChannelRuntimeService) {
    this.key = runtime.encryptionConfigured
      ? runtime.requireCipher().deriveKey('media-url-v1')
      : null;
  }

  private signature(messageId: string, expires: number): string {
    return createHmac('sha256', this.key!).update(`${messageId}.${expires}`).digest('base64url');
  }

  sign(messageId: string): string | null {
    if (!this.key) return null;
    const expires = Math.floor(Date.now() / 1000) + MEDIA_URL_TTL_SECONDS;
    const params = new URLSearchParams({
      exp: String(expires),
      sig: this.signature(messageId, expires),
    });
    return `${this.runtime.apiBaseUrl}/api/v1/media/${encodeURIComponent(messageId)}?${params.toString()}`;
  }

  verify(messageId: string, exp: string | undefined, sig: string | undefined): boolean {
    if (!this.key || !exp || !sig) return false;
    const expires = Number(exp);
    if (!Number.isInteger(expires) || expires < Math.floor(Date.now() / 1000)) return false;
    return safeEqual(sig, this.signature(messageId, expires));
  }
}
