# AD-010 — Object Storage Outside Database via S3/RustFS

## Status

Accepted

## Context

Omnichannel communications involve large binary attachments (images, audio notes, video, PDF documents). Storing binary payloads directly in PostgreSQL tables (`BYTEA` or large objects) causes rapid database bloat, degrades backup/restore performance, inflates memory usage, and slows down database queries.

## Decision

All binary attachments are stored externally in an **S3-compatible object store** (RustFS locally and in deployment):

1. The `packages/storage` package wraps standard S3 client operations (`putObject`, `getObject`, `statObject`, `getSignedUrl`, `deleteObject`).
2. PostgreSQL stores only attachment metadata: object key, original filename, MIME type, file size in bytes, SHA-256 checksum, malware scan status, and workspace reference.
3. Access to media files is granted via short-lived, backend-generated presigned download URLs.

## Consequences

### Positive

- Keeps PostgreSQL database lean, fast, and easy to backup and restore.
- Offloads file streaming from application servers to dedicated object storage.
- Standard S3 API ensures portable deployment across self-hosted RustFS, AWS S3, Cloudflare R2, or MinIO.

### Negative / Trade-offs

- Two-phase attachment upload/download workflow (metadata record + object upload).
- Requires object lifecycle policies and orphaned-object garbage collection jobs.

## Compliance & Verification

- Database schema inspection guarantees no binary columns exist in attachment tables.
- Storage integration tests verify presigned URL generation and access controls.
