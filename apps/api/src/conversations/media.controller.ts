import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { isChannelProviderError } from '@vynor/channel-adapters';
import { prisma } from '@vynor/database';
import type { Response } from 'express';
import { ChannelRuntimeService } from '../channels/channel-runtime.service.js';
import { Public } from '../iam/decorators.js';
import { MediaUrlService } from './media-url.service.js';

/** Types browsers may render inline; everything else is forced to download. */
const INLINE_TYPES =
  /^(image\/(jpeg|png|gif|webp)|audio\/[\w.+-]+|video\/(mp4|3gpp|webm|quicktime)|application\/pdf)$/i;

/**
 * Streams inbound media from the provider behind a signed, expiring URL (issue #37).
 * The signature replaces bearer auth so the file can be used in <img>/<audio>/<video>.
 */
@Public()
@Controller('media')
export class MediaController {
  constructor(
    private readonly runtime: ChannelRuntimeService,
    private readonly mediaUrls: MediaUrlService,
  ) {}

  @Get(':messageId')
  async download(
    @Param('messageId') messageId: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.mediaUrls.verify(messageId, exp, sig)) {
      res.status(403).json({
        code: 'MEDIA_LINK_INVALID',
        message: 'This media link is invalid or has expired.',
      });
      return;
    }
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { providerAccount: true },
    });
    const content = (message?.content ?? {}) as Record<string, unknown>;
    if (!message || content.type !== 'MEDIA') {
      res.status(404).json({ code: 'MEDIA_NOT_FOUND', message: 'This message has no media.' });
      return;
    }

    const adapter = this.runtime.adapterFor(message.providerAccount.provider);
    if (!adapter.downloadMedia) {
      res.status(404).json({
        code: 'MEDIA_NOT_FOUND',
        message: 'This channel does not provide media downloads.',
      });
      return;
    }

    try {
      const file = await adapter.downloadMedia(
        {
          ...(typeof content.providerMediaId === 'string'
            ? { providerMediaId: content.providerMediaId }
            : {}),
          ...(typeof content.url === 'string' ? { directUrl: content.url } : {}),
          ...(typeof content.mimeType === 'string' ? { mimeType: content.mimeType } : {}),
        },
        this.runtime.account(message.providerAccount),
      );
      const mimeType = (file.mimeType.split(';')[0] ?? 'application/octet-stream').trim();
      const inline = INLINE_TYPES.test(mimeType);
      const filename = (
        typeof content.filename === 'string' ? content.filename : (file.filename ?? 'attachment')
      )
        .replace(/[^\w.\- ]+/g, '_')
        .slice(0, 120);

      res.setHeader('Content-Type', inline ? mimeType : 'application/octet-stream');
      res.setHeader('Content-Length', String(file.sizeBytes));
      res.setHeader(
        'Content-Disposition',
        `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
      );
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.status(200).end(file.data);
    } catch (error) {
      const status = isChannelProviderError(error) && error.category === 'NOT_FOUND' ? 404 : 502;
      res.status(status).json({
        code: status === 404 ? 'MEDIA_EXPIRED' : 'MEDIA_UNAVAILABLE',
        message:
          error instanceof Error
            ? error.message
            : 'The file could not be fetched from the provider.',
      });
    }
  }
}
