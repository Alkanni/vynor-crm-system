import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import {
  createSuccessEnvelope,
  type ActorContext,
  type ApiSuccessResponse,
} from '@vynor/contracts';
import type { Request } from 'express';
import { CurrentActor, RequirePermissions } from '../iam/decorators.js';
import { StorageService, type SignedDownloadResponse } from './storage.service.js';

@Controller('attachments')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Request an authorized, short-lived signed download URL (FND-BE-008, FND-075).
   * Verifies workspace ownership, permissions, and scan status before signing.
   */
  @Get(':id/download-url')
  @RequirePermissions('message:read')
  async getDownloadUrl(
    @Param('id') id: string,
    @CurrentActor() actor: ActorContext,
    @Query('ttl') ttl: string | undefined,
    @Req() req: Request & { correlationId?: string },
  ): Promise<ApiSuccessResponse<SignedDownloadResponse>> {
    const ttlSeconds = ttl ? Number.parseInt(ttl, 10) : undefined;
    const result = await this.storageService.getSignedDownloadUrl(
      id,
      actor,
      ttlSeconds,
      req.correlationId,
    );

    return createSuccessEnvelope(result);
  }
}
