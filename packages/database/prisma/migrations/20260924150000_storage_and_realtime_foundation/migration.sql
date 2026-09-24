-- CreateEnum
CREATE TYPE "AttachmentPurpose" AS ENUM (
    'MESSAGE_INBOUND',
    'MESSAGE_OUTBOUND',
    'KNOWLEDGE_SOURCE',
    'BULK_IMPORT',
    'REPORT_EXPORT',
    'AVATAR',
    'AUTOMATION_ARTIFACT'
);

-- CreateEnum
CREATE TYPE "AttachmentStorageZone" AS ENUM ('QUARANTINE', 'PRIVATE');

-- CreateEnum
CREATE TYPE "AttachmentScanStatus" AS ENUM (
    'PENDING',
    'SCANNING',
    'CLEAN',
    'INFECTED',
    'FAILED'
);

-- CreateTable: attachment metadata only; binary content remains in RustFS/S3.
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "provider_account_id" TEXT,
    "purpose" "AttachmentPurpose" NOT NULL,
    "storage_zone" "AttachmentStorageZone" NOT NULL DEFAULT 'QUARANTINE',
    "storage_bucket" VARCHAR(128) NOT NULL,
    "object_key" VARCHAR(1024) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(255) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "checksum_sha256" CHAR(64) NOT NULL,
    "provider_reference" JSONB,
    "scan_status" "AttachmentScanStatus" NOT NULL DEFAULT 'PENDING',
    "scan_engine" VARCHAR(100),
    "scan_result" JSONB,
    "scanned_at" TIMESTAMPTZ(6),
    "retention_days" INTEGER NOT NULL DEFAULT 365,
    "purge_after" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "attachments_size_bytes_nonnegative" CHECK ("size_bytes" >= 0),
    CONSTRAINT "attachments_retention_days_positive" CHECK ("retention_days" > 0),
    CONSTRAINT "attachments_checksum_sha256_format" CHECK ("checksum_sha256" ~ '^[a-f0-9]{64}$')
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_attachments_bucket_object_key" ON "attachments"("storage_bucket", "object_key");
CREATE INDEX "idx_attachments_workspace_purpose_created_at" ON "attachments"("workspace_id", "purpose", "created_at");
CREATE INDEX "idx_attachments_workspace_scan_status" ON "attachments"("workspace_id", "scan_status");
CREATE INDEX "idx_attachments_provider_account_id" ON "attachments"("provider_account_id");
CREATE INDEX "idx_attachments_purge_after" ON "attachments"("purge_after");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_provider_account_id_fkey" FOREIGN KEY ("provider_account_id") REFERENCES "provider_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
