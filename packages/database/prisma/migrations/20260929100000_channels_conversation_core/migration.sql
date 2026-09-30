-- Channels & Conversation Core (issue #37)
-- Adds connection lifecycle columns to provider_accounts and the channel-agnostic
-- contacts, contact_identities, conversations and messages tables (AD-003).
-- Purely additive: new nullable columns, new tables and a new enum value.

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageSenderType" AS ENUM ('CONTACT', 'AGENT', 'AI', 'SYSTEM');

-- AlterEnum
ALTER TYPE "ChannelType" ADD VALUE 'API';

-- AlterTable
ALTER TABLE "provider_accounts" ADD COLUMN     "connected_at" TIMESTAMPTZ(6),
ADD COLUMN     "description" VARCHAR(255),
ADD COLUMN     "display_identifier" VARCHAR(255),
ADD COLUMN     "last_error_at" TIMESTAMPTZ(6),
ADD COLUMN     "last_health_check_at" TIMESTAMPTZ(6),
ADD COLUMN     "settings" JSONB,
ADD COLUMN     "status_reason" TEXT,
ADD COLUMN     "sync_lease_expires_at" TIMESTAMPTZ(6),
ADD COLUMN     "sync_state" JSONB,
ADD COLUMN     "webhook_key" VARCHAR(64);

-- CreateTable
CREATE TABLE "provider_account_members" (
    "provider_account_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_account_members_pkey" PRIMARY KEY ("provider_account_id","membership_id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(64),
    "avatar_url" VARCHAR(1024),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_identities" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "channel_type" "ChannelType" NOT NULL,
    "external_id" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(255),
    "username" VARCHAR(255),
    "metadata" JSONB,
    "last_seen_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contact_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "contact_identity_id" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "assignee_membership_id" TEXT,
    "subject" VARCHAR(500),
    "external_thread_id" VARCHAR(512),
    "unread_count" INTEGER NOT NULL DEFAULT 0,
    "last_message_at" TIMESTAMPTZ(6),
    "last_message_preview" VARCHAR(500),
    "last_message_direction" "MessageDirection",
    "last_inbound_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "sender_type" "MessageSenderType" NOT NULL,
    "sender_membership_id" TEXT,
    "sender_name" VARCHAR(255),
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "content_type" VARCHAR(32) NOT NULL,
    "content" JSONB NOT NULL,
    "text" TEXT,
    "provider_message_id" VARCHAR(512),
    "reply_to_message_id" TEXT,
    "status" "MessageDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "error_code" VARCHAR(100),
    "error_message" TEXT,
    "provider_event_id" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "read_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_provider_account_members_membership_id" ON "provider_account_members"("membership_id");

-- CreateIndex
CREATE INDEX "idx_contacts_workspace_created_at" ON "contacts"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_contacts_workspace_email" ON "contacts"("workspace_id", "email");

-- CreateIndex
CREATE INDEX "idx_contacts_workspace_phone" ON "contacts"("workspace_id", "phone");

-- CreateIndex
CREATE INDEX "idx_contact_identities_workspace_id" ON "contact_identities"("workspace_id");

-- CreateIndex
CREATE INDEX "idx_contact_identities_contact_id" ON "contact_identities"("contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_contact_identities_account_external_id" ON "contact_identities"("provider_account_id", "external_id");

-- CreateIndex
CREATE INDEX "idx_conversations_workspace_status_last_message" ON "conversations"("workspace_id", "status", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "idx_conversations_workspace_assignee_status" ON "conversations"("workspace_id", "assignee_membership_id", "status");

-- CreateIndex
CREATE INDEX "idx_conversations_account_identity_status" ON "conversations"("provider_account_id", "contact_identity_id", "status");

-- CreateIndex
CREATE INDEX "idx_conversations_account_thread" ON "conversations"("provider_account_id", "external_thread_id");

-- CreateIndex
CREATE INDEX "idx_conversations_contact_id" ON "conversations"("contact_id");

-- CreateIndex
CREATE INDEX "idx_messages_conversation_created_at" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_messages_workspace_status_created_at" ON "messages"("workspace_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "uq_messages_account_provider_message_id" ON "messages"("provider_account_id", "provider_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_provider_accounts_webhook_key" ON "provider_accounts"("webhook_key");

-- AddForeignKey
ALTER TABLE "provider_account_members" ADD CONSTRAINT "provider_account_members_provider_account_id_fkey" FOREIGN KEY ("provider_account_id") REFERENCES "provider_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_account_members" ADD CONSTRAINT "provider_account_members_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "workspace_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_identities" ADD CONSTRAINT "contact_identities_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_identities" ADD CONSTRAINT "contact_identities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_identities" ADD CONSTRAINT "contact_identities_provider_account_id_fkey" FOREIGN KEY ("provider_account_id") REFERENCES "provider_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_provider_account_id_fkey" FOREIGN KEY ("provider_account_id") REFERENCES "provider_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_identity_id_fkey" FOREIGN KEY ("contact_identity_id") REFERENCES "contact_identities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assignee_membership_id_fkey" FOREIGN KEY ("assignee_membership_id") REFERENCES "workspace_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_provider_account_id_fkey" FOREIGN KEY ("provider_account_id") REFERENCES "provider_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_membership_id_fkey" FOREIGN KEY ("sender_membership_id") REFERENCES "workspace_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;
