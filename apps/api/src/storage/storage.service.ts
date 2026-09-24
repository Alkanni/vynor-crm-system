import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { type ActorContext, type AttachmentMetadata } from '@vynor/contracts';
import { prisma } from '@vynor/database';
import {
  authorizeSignedDownload,
  createStorageClient,
  type S3CompatibleStorage,
  type SignedDownloadDenialReason,
} from '@vynor/storage';
import { AuditService } from '../audit/audit.service.js';

export interface SignedDownloadResponse {
  readonly attachmentId: string;
  readonly filename: string;
  readonly contentType: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly downloadUrl: string;
  readonly expiresAt: string;
  readonly expiresInSeconds: number;
}

@Injectable()
export class StorageService {
  private readonly storageClient: S3CompatibleStorage;

  constructor(private readonly auditService: AuditService) {
    this.storageClient = createStorageClient({
      endpoint: process.env.STORAGE_ENDPOINT || 'http://localhost:9000',
      region: process.env.STORAGE_REGION || 'us-east-1',
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || 'local_storage_access_key',
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || 'local_storage_secret_key',
      defaultBucket: process.env.STORAGE_BUCKET || 'vynor-crm-attachments',
      forcePathStyle: true,
    });
  }

  getStorageClient(): S3CompatibleStorage {
    return this.storageClient;
  }

  /**
   * Authorizes and generates a short-lived presigned GET URL for an attachment (FND-BE-008, FND-075).
   * Fail closed: never signs quarantine, pending scan, or infected attachments.
   */
  async getSignedDownloadUrl(
    attachmentId: string,
    actor: ActorContext,
    requestedTtlSeconds?: number,
    correlationId?: string,
  ): Promise<SignedDownloadResponse> {
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.workspaceId !== actor.workspace.id) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          code: 'ATTACHMENT_NOT_FOUND',
          message: 'The requested attachment does not exist in this workspace.',
          correlationId,
          timestamp: new Date().toISOString(),
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const metadata: AttachmentMetadata = {
      id: attachment.id,
      workspaceId: attachment.workspaceId,
      purpose: attachment.purpose as AttachmentMetadata['purpose'],
      storageZone: attachment.storageZone as AttachmentMetadata['storageZone'],
      storageBucket: attachment.storageBucket,
      objectKey: attachment.objectKey,
      originalFilename: attachment.originalFilename,
      contentType: attachment.contentType,
      sizeBytes: Number(attachment.sizeBytes),
      checksumSha256: attachment.checksumSha256,
      scanStatus: attachment.scanStatus as AttachmentMetadata['scanStatus'],
      retentionDays: attachment.retentionDays,
      scanEngine: attachment.scanEngine,
      scanResult: (attachment.scanResult as Record<string, unknown> | null) ?? null,
      scannedAt: attachment.scannedAt ? attachment.scannedAt.toISOString() : null,
      purgeAfter: attachment.purgeAfter ? attachment.purgeAfter.toISOString() : null,
      deletedAt: attachment.deletedAt ? attachment.deletedAt.toISOString() : null,
      createdAt: attachment.createdAt.toISOString(),
      updatedAt: attachment.updatedAt.toISOString(),
    };

    const authResult = authorizeSignedDownload({
      actorWorkspaceId: actor.workspace.id,
      actorPermissions: actor.permissions,
      attachment: metadata,
      requiredPermission: 'message:read',
      ...(requestedTtlSeconds !== undefined ? { requestedTtlSeconds } : {}),
    });

    if (!authResult.authorized) {
      this.handleDenial(authResult.reason, correlationId);
    }

    const signed = await this.storageClient.createSignedDownload({
      location: {
        bucket: attachment.storageBucket,
        key: attachment.objectKey,
      },
      expiresInSeconds: authResult.expiresInSeconds,
      downloadFilename: attachment.originalFilename,
    });

    // Record audit event (FND-BE-006, FND-048)
    try {
      await this.auditService.recordForActor(actor, {
        action: 'attachment.download_signed',
        resourceType: 'storage.attachment',
        resourceId: attachment.id,
        correlationId: correlationId || 'unknown',
        metadata: {
          objectKey: attachment.objectKey,
          expiresInSeconds: authResult.expiresInSeconds,
          purpose: attachment.purpose,
        },
      });
    } catch {
      // Audit write must not fail download delivery
    }

    return {
      attachmentId: attachment.id,
      filename: attachment.originalFilename,
      contentType: attachment.contentType,
      mimeType: attachment.contentType,
      sizeBytes: Number(attachment.sizeBytes),
      downloadUrl: signed.url,
      expiresAt: signed.expiresAt.toISOString(),
      expiresInSeconds: authResult.expiresInSeconds,
    };
  }

  private handleDenial(reason: SignedDownloadDenialReason, correlationId?: string): never {
    let statusCode: HttpStatus = HttpStatus.FORBIDDEN;
    let code = 'PERMISSION_DENIED';
    let message = 'Access to attachment denied.';

    switch (reason) {
      case 'WORKSPACE_MISMATCH':
        statusCode = HttpStatus.NOT_FOUND;
        code = 'ATTACHMENT_NOT_FOUND';
        message = 'The requested attachment does not exist in this workspace.';
        break;
      case 'PERMISSION_DENIED':
        statusCode = HttpStatus.FORBIDDEN;
        code = 'PERMISSION_DENIED';
        message = 'Forbidden: actor lacks message:read permission to download attachment.';
        break;
      case 'ATTACHMENT_NOT_CLEAN':
        statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
        code = 'ATTACHMENT_NOT_CLEAN';
        message = 'Attachment is not clean or malware scan is pending/failed.';
        break;
      case 'ATTACHMENT_NOT_PRIVATE':
        statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
        code = 'ATTACHMENT_QUARANTINED';
        message = 'Attachment is currently quarantined and cannot be downloaded.';
        break;
      case 'ATTACHMENT_EXPIRED':
        statusCode = HttpStatus.GONE;
        code = 'ATTACHMENT_EXPIRED';
        message = 'Attachment has expired and has been purged.';
        break;
      case 'ATTACHMENT_DELETED':
        statusCode = HttpStatus.GONE;
        code = 'ATTACHMENT_DELETED';
        message = 'Attachment has been deleted.';
        break;
    }

    throw new HttpException(
      {
        statusCode,
        code,
        message,
        correlationId,
        timestamp: new Date().toISOString(),
      },
      statusCode,
    );
  }
}
