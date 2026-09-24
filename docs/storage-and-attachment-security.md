# Storage and Attachment Security

This document defines the provider-neutral storage boundary and attachment safety policy for
FND-071 through FND-075. It implements the constraints established by AD-010: PostgreSQL stores
metadata only, while RustFS or another S3-compatible service stores binary objects.

## Storage interface

`@vynor/storage` exports `S3CompatibleStorage`. A concrete RustFS adapter must implement:

- `put`: upload a known-length object with MIME type, SHA-256 checksum, and safe metadata;
- `get`: stream an object, optionally using a bounded byte range;
- `stat`: retrieve immutable location, size, MIME type, checksum, ETag, and metadata;
- `createSignedDownload`: generate a short-lived GET URL after authorization;
- `delete`: remove the referenced object/version idempotently; and
- `health`: perform a bounded readiness check and return status plus latency.

All methods accept an optional `AbortSignal`. Concrete adapters must apply explicit timeouts and
map provider errors into stable application error types. The interface carries bucket and key as a
`StorageObjectLocation`; callers must never concatenate a user-supplied bucket or key.

## Object key convention

Object keys are created only through `buildObjectKey`:

```text
workspaces/{workspaceId}/{purpose}/{yyyy}/{mm}/{dd}/{opaqueObjectId}
```

Example:

```text
workspaces/ws_01abc/message-inbound/2026/09/24/att_01xyz
```

Rules:

1. `workspaceId` and `opaqueObjectId` may contain only letters, numbers, `_`, and `-`.
2. Dates are UTC partitions derived from the durable attachment creation time.
3. Purpose is selected from the canonical `AttachmentPurpose` enum.
4. The key never contains an original filename, customer identifier, phone number, MIME type, or
   file extension.
5. `parseObjectKey` rejects traversal, unknown purpose, extra segments, and invalid calendar dates.
6. Bucket selection is configuration owned by the server, not part of a client request.

## Attachment metadata

The `attachments` table stores:

- workspace and optional provider-account ownership;
- purpose, storage zone, bucket, and object key;
- original filename for display only;
- canonical server-detected MIME type and size in bytes;
- lowercase SHA-256 checksum;
- provider media/message/event references as structured JSON;
- scan state, engine, result summary, and completion time;
- retention days, purge time, and soft-deletion time; and
- creation/update timestamps.

The table deliberately contains no `BYTEA`, base64, or other binary-content column. A unique
constraint on `(storage_bucket, object_key)` prevents two metadata rows from owning the same
object. Check constraints reject negative sizes, non-positive retention, and malformed checksums.

## Upload and quarantine policy

The generic Phase 0 default is 25 MiB. Images have a stricter 10 MiB cap. The initial allowlist is
defined in `DEFAULT_ALLOWED_ATTACHMENT_MEDIA_TYPES` and includes common images, audio/video,
PDF, Office Open XML documents, CSV, and plain text.

Upload decisions follow this order:

1. Reject empty, non-integer, or over-limit objects before storage.
2. Normalize the declared content type and compare it with server-side magic-byte detection.
3. Reject types outside the allowlist or a declared/detected mismatch.
4. Calculate SHA-256 while streaming and verify a provider checksum when one is available.
5. Store accepted bytes in the configured quarantine bucket with `storageZone=QUARANTINE` and
   `scanStatus=PENDING`.
6. Move/copy the object to the private bucket only after a successful scan, then atomically change
   the metadata to `storageZone=PRIVATE` and `scanStatus=CLEAN`.
7. Keep infected bytes inaccessible and apply the security retention/deletion procedure.
8. A failed scan may retry through `FAILED -> SCANNING`; `CLEAN` and `INFECTED` are terminal.

Do not trust MIME type, filename, or size supplied by a browser or external provider. The final
adapter must use streaming limits so a false `Content-Length` cannot bypass enforcement.

## Malware scanner decision

**OPEN QUESTION:** the scanning engine is not selected in Phase 0. The policy and metadata are
vendor-neutral. Before enabling attachment download in production, select and document a scanner
(for example ClamAV or an approved managed service), its signature-update SLA, timeout, maximum
object size, failure mode, metrics, and data-residency impact.

Fail closed: `PENDING`, `SCANNING`, `FAILED`, and `INFECTED` attachments cannot receive a signed
download URL.

## Signed download authorization

`authorizeSignedDownload` must run before the storage adapter signs a URL. It enforces:

1. the actor and attachment belong to the same workspace;
2. the actor has the required server-side permission (default `message:read`);
3. the attachment is not deleted or past `purgeAfter`;
4. the object is in the `PRIVATE` zone; and
5. the malware scan status is `CLEAN`.

The caller must load metadata by opaque attachment ID and must never sign a raw key supplied by a
client. The default URL lifetime is 60 seconds, with a hard range of 10–300 seconds. The adapter
should set an attachment disposition using a sanitized filename and private/no-store cache policy.
Signed URLs and credentials must not be written to logs, audit metadata, analytics, or error
tracking. Record the authorization decision and attachment ID instead.

## Retention and deletion

- `purgeAfter` is the authoritative eligibility time for retention workers.
- Database metadata and object deletion require an idempotent, retryable workflow.
- A missing object during an eligible delete is treated as already deleted, but remains observable.
- Legal/audit retention requirements may preserve metadata after the binary is removed.
- Orphaned-object reconciliation compares storage inventory with durable metadata; it must never
  delete an object solely because a transient database query failed.
