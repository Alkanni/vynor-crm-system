import { z } from 'zod';

/**
 * Durable attachment purposes. These values also map to the lowercase object-key
 * purpose segment defined by @vynor/storage (FND-072).
 */
export const ATTACHMENT_PURPOSES = [
  'MESSAGE_INBOUND',
  'MESSAGE_OUTBOUND',
  'KNOWLEDGE_SOURCE',
  'BULK_IMPORT',
  'REPORT_EXPORT',
  'AVATAR',
  'AUTOMATION_ARTIFACT',
] as const;

export const AttachmentPurposeSchema = z.enum(ATTACHMENT_PURPOSES);
export type AttachmentPurpose = z.infer<typeof AttachmentPurposeSchema>;

/**
 * Storage zones keep untrusted bytes physically separate from downloadable
 * objects. An object may only enter PRIVATE after policy approval (FND-074).
 */
export const ATTACHMENT_STORAGE_ZONES = ['QUARANTINE', 'PRIVATE'] as const;
export const AttachmentStorageZoneSchema = z.enum(ATTACHMENT_STORAGE_ZONES);
export type AttachmentStorageZone = z.infer<typeof AttachmentStorageZoneSchema>;

export const ATTACHMENT_SCAN_STATUSES = [
  'PENDING',
  'SCANNING',
  'CLEAN',
  'INFECTED',
  'FAILED',
] as const;

export const AttachmentScanStatusSchema = z.enum(ATTACHMENT_SCAN_STATUSES);
export type AttachmentScanStatus = z.infer<typeof AttachmentScanStatusSchema>;

export const Sha256ChecksumSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/i, 'Expected a 64-character SHA-256 checksum')
  .transform((value) => value.toLowerCase());

export const AttachmentProviderReferenceSchema = z.object({
  providerAccountId: z.string().min(1),
  providerMediaId: z.string().min(1).max(512).optional(),
  providerMessageId: z.string().min(1).max(512).optional(),
  providerEventId: z.string().min(1).optional(),
});

export type AttachmentProviderReference = z.infer<typeof AttachmentProviderReferenceSchema>;

/**
 * API-safe representation of attachment metadata. Binary content is never
 * embedded in this contract or stored in PostgreSQL (AD-010, FND-073).
 */
export const AttachmentMetadataSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  purpose: AttachmentPurposeSchema,
  storageZone: AttachmentStorageZoneSchema,
  storageBucket: z.string().min(3).max(128),
  objectKey: z.string().min(1).max(1024),
  originalFilename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  checksumSha256: Sha256ChecksumSchema,
  providerReference: AttachmentProviderReferenceSchema.optional(),
  scanStatus: AttachmentScanStatusSchema,
  scanEngine: z.string().min(1).max(100).nullable(),
  scanResult: z.record(z.string(), z.unknown()).nullable(),
  scannedAt: z.string().datetime().nullable(),
  retentionDays: z.number().int().positive(),
  purgeAfter: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
});

export type AttachmentMetadata = z.infer<typeof AttachmentMetadataSchema>;
