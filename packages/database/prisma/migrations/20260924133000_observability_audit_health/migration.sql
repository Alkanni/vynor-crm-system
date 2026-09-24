-- AlterTable: add correlation and tracing context to outbox_events
ALTER TABLE "outbox_events" ADD COLUMN "correlation_id" VARCHAR(128);
ALTER TABLE "outbox_events" ADD COLUMN "causation_id" VARCHAR(128);
ALTER TABLE "outbox_events" ADD COLUMN "actor_id" VARCHAR(64);
ALTER TABLE "outbox_events" ADD COLUMN "traceparent" VARCHAR(128);

-- CreateIndex
CREATE INDEX "idx_outbox_events_correlation_id" ON "outbox_events"("correlation_id");

-- CreateTable: immutable audit_logs
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_type" VARCHAR(50) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(100) NOT NULL,
    "resource_id" TEXT NOT NULL,
    "correlation_id" VARCHAR(128) NOT NULL,
    "causation_id" VARCHAR(128),
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "before_state" JSONB,
    "after_state" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes on audit_logs
CREATE INDEX "idx_audit_logs_workspace_created_at" ON "audit_logs"("workspace_id", "created_at");
CREATE INDEX "idx_audit_logs_workspace_action" ON "audit_logs"("workspace_id", "action");
CREATE INDEX "idx_audit_logs_correlation_id" ON "audit_logs"("correlation_id");
CREATE INDEX "idx_audit_logs_resource" ON "audit_logs"("resource_type", "resource_id");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
