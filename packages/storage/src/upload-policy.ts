import type { AttachmentScanStatus } from '@vynor/contracts';

export const MEBIBYTE = 1024 * 1024;
export const DEFAULT_MAX_ATTACHMENT_SIZE_BYTES = 25 * MEBIBYTE;

export const DEFAULT_ALLOWED_ATTACHMENT_MEDIA_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
  'text/plain',
  'video/3gpp',
  'video/mp4',
] as const;

export const DEFAULT_ATTACHMENT_MEDIA_TYPE_LIMITS: Readonly<Record<string, number>> = {
  'image/gif': 10 * MEBIBYTE,
  'image/jpeg': 10 * MEBIBYTE,
  'image/png': 10 * MEBIBYTE,
  'image/webp': 10 * MEBIBYTE,
};

export type AttachmentPolicyRejection =
  'EMPTY_OBJECT' | 'OBJECT_TOO_LARGE' | 'MEDIA_TYPE_NOT_ALLOWED' | 'MEDIA_TYPE_MISMATCH';

export interface AttachmentUploadCandidate {
  readonly declaredContentType: string;
  readonly detectedContentType?: string;
  readonly sizeBytes: number;
}

export interface AttachmentUploadPolicy {
  readonly maxSizeBytes: number;
  readonly allowedMediaTypes: ReadonlySet<string>;
  readonly mediaTypeSizeLimits: Readonly<Record<string, number>>;
}

export interface AttachmentPolicyDecision {
  readonly accepted: boolean;
  readonly quarantineRequired: true;
  readonly normalizedContentType: string;
  readonly rejectionReasons: readonly AttachmentPolicyRejection[];
}

export const DEFAULT_ATTACHMENT_UPLOAD_POLICY: AttachmentUploadPolicy = {
  maxSizeBytes: DEFAULT_MAX_ATTACHMENT_SIZE_BYTES,
  allowedMediaTypes: new Set(DEFAULT_ALLOWED_ATTACHMENT_MEDIA_TYPES),
  mediaTypeSizeLimits: DEFAULT_ATTACHMENT_MEDIA_TYPE_LIMITS,
};

function normalizeContentType(contentType: string): string {
  return contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}

/**
 * Evaluates metadata before upload. The detected media type should come from
 * server-side magic-byte inspection; client-declared MIME is never sufficient.
 */
export function evaluateAttachmentUpload(
  candidate: AttachmentUploadCandidate,
  policy: AttachmentUploadPolicy = DEFAULT_ATTACHMENT_UPLOAD_POLICY,
): AttachmentPolicyDecision {
  const declaredContentType = normalizeContentType(candidate.declaredContentType);
  const detectedContentType = candidate.detectedContentType
    ? normalizeContentType(candidate.detectedContentType)
    : undefined;
  const effectiveContentType = detectedContentType ?? declaredContentType;
  const rejectionReasons: AttachmentPolicyRejection[] = [];

  if (!Number.isSafeInteger(candidate.sizeBytes) || candidate.sizeBytes <= 0) {
    rejectionReasons.push('EMPTY_OBJECT');
  }

  const mediaTypeLimit = policy.mediaTypeSizeLimits[effectiveContentType] ?? policy.maxSizeBytes;
  if (candidate.sizeBytes > Math.min(policy.maxSizeBytes, mediaTypeLimit)) {
    rejectionReasons.push('OBJECT_TOO_LARGE');
  }

  if (!policy.allowedMediaTypes.has(effectiveContentType)) {
    rejectionReasons.push('MEDIA_TYPE_NOT_ALLOWED');
  }

  if (detectedContentType && detectedContentType !== declaredContentType) {
    rejectionReasons.push('MEDIA_TYPE_MISMATCH');
  }

  return {
    accepted: rejectionReasons.length === 0,
    quarantineRequired: true,
    normalizedContentType: effectiveContentType,
    rejectionReasons,
  };
}

const ALLOWED_SCAN_TRANSITIONS: Readonly<
  Record<AttachmentScanStatus, ReadonlySet<AttachmentScanStatus>>
> = {
  PENDING: new Set(['SCANNING', 'FAILED']),
  SCANNING: new Set(['CLEAN', 'INFECTED', 'FAILED']),
  CLEAN: new Set(),
  INFECTED: new Set(),
  FAILED: new Set(['SCANNING']),
};

export function isAttachmentScanTransitionAllowed(
  current: AttachmentScanStatus,
  next: AttachmentScanStatus,
): boolean {
  return current === next || ALLOWED_SCAN_TRANSITIONS[current].has(next);
}
