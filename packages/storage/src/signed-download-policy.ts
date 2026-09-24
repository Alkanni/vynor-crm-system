import { hasPermission, type AttachmentMetadata, type PermissionAction } from '@vynor/contracts';

export const DEFAULT_SIGNED_DOWNLOAD_TTL_SECONDS = 60;
export const MIN_SIGNED_DOWNLOAD_TTL_SECONDS = 10;
export const MAX_SIGNED_DOWNLOAD_TTL_SECONDS = 300;

export type SignedDownloadDenialReason =
  | 'WORKSPACE_MISMATCH'
  | 'PERMISSION_DENIED'
  | 'ATTACHMENT_DELETED'
  | 'ATTACHMENT_EXPIRED'
  | 'ATTACHMENT_NOT_PRIVATE'
  | 'ATTACHMENT_NOT_CLEAN';

export type SignedDownloadAuthorization =
  | { readonly authorized: true; readonly expiresInSeconds: number }
  | { readonly authorized: false; readonly reason: SignedDownloadDenialReason };

export interface SignedDownloadAuthorizationInput {
  readonly actorWorkspaceId: string;
  readonly actorPermissions: readonly string[];
  readonly attachment: AttachmentMetadata;
  readonly requiredPermission?: PermissionAction;
  readonly requestedTtlSeconds?: number;
  readonly now?: Date;
}

/**
 * Performs the policy decision before an adapter is allowed to sign a URL.
 * Callers must load attachment metadata by opaque attachment ID; an object key
 * supplied by a client must never be signed directly (FND-075).
 */
export function authorizeSignedDownload(
  input: SignedDownloadAuthorizationInput,
): SignedDownloadAuthorization {
  if (input.actorWorkspaceId !== input.attachment.workspaceId) {
    return { authorized: false, reason: 'WORKSPACE_MISMATCH' };
  }

  if (!hasPermission(input.actorPermissions, input.requiredPermission ?? 'message:read')) {
    return { authorized: false, reason: 'PERMISSION_DENIED' };
  }

  if (input.attachment.deletedAt) {
    return { authorized: false, reason: 'ATTACHMENT_DELETED' };
  }

  const now = input.now ?? new Date();
  if (input.attachment.purgeAfter && new Date(input.attachment.purgeAfter) <= now) {
    return { authorized: false, reason: 'ATTACHMENT_EXPIRED' };
  }

  if (input.attachment.storageZone !== 'PRIVATE') {
    return { authorized: false, reason: 'ATTACHMENT_NOT_PRIVATE' };
  }

  if (input.attachment.scanStatus !== 'CLEAN') {
    return { authorized: false, reason: 'ATTACHMENT_NOT_CLEAN' };
  }

  const requestedTtl =
    input.requestedTtlSeconds === undefined || !Number.isFinite(input.requestedTtlSeconds)
      ? DEFAULT_SIGNED_DOWNLOAD_TTL_SECONDS
      : Math.floor(input.requestedTtlSeconds);
  const expiresInSeconds = Math.min(
    MAX_SIGNED_DOWNLOAD_TTL_SECONDS,
    Math.max(MIN_SIGNED_DOWNLOAD_TTL_SECONDS, requestedTtl),
  );

  return { authorized: true, expiresInSeconds };
}
