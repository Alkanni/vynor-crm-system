-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('WHATSAPP', 'INSTAGRAM', 'MESSENGER', 'TELEGRAM', 'EMAIL', 'LINE', 'WEBCHAT');

-- CreateEnum
CREATE TYPE "ProviderAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "ProviderEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'IGNORED', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateTable: provider_accounts
CREATE TABLE "provider_accounts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "channel_type" "ChannelType" NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "account_identifier" VARCHAR(255) NOT NULL,
    "status" "ProviderAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "credentials" JSONB NOT NULL,
    "config" JSONB,
    "capabilities" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "provider_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: provider_events (immutable journal)
CREATE TABLE "provider_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "channel_type" "ChannelType" NOT NULL,
    "provider_event_key" VARCHAR(255) NOT NULL,
    "is_fingerprinted" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "status" "ProviderEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "processing_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "processed_at" TIMESTAMPTZ(6),
    "retention_days" INTEGER NOT NULL DEFAULT 90,
    "purge_after" TIMESTAMPTZ(6),
    "correlation_id" VARCHAR(128),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "provider_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_provider_accounts_workspace_channel_identifier" ON "provider_accounts"("workspace_id", "channel_type", "account_identifier");
CREATE INDEX "idx_provider_accounts_workspace_id" ON "provider_accounts"("workspace_id");
CREATE INDEX "idx_provider_accounts_channel_status" ON "provider_accounts"("channel_type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_provider_events_account_event_key" ON "provider_events"("provider_account_id", "provider_event_key");
CREATE INDEX "idx_provider_events_workspace_status" ON "provider_events"("workspace_id", "status");
CREATE INDEX "idx_provider_events_status_created_at" ON "provider_events"("status", "created_at");
CREATE INDEX "idx_provider_events_correlation_id" ON "provider_events"("correlation_id");
CREATE INDEX "idx_provider_events_purge_after" ON "provider_events"("purge_after");

-- AddForeignKey
ALTER TABLE "provider_accounts" ADD CONSTRAINT "provider_accounts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_events" ADD CONSTRAINT "provider_events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_events" ADD CONSTRAINT "provider_events_provider_account_id_fkey" FOREIGN KEY ("provider_account_id") REFERENCES "provider_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
