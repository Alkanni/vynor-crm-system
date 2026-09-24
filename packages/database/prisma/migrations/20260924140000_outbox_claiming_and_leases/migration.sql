-- AlterTable: add claiming and lease recovery fields to outbox_events
ALTER TABLE "outbox_events" ADD COLUMN "claimed_at" TIMESTAMPTZ(6);
ALTER TABLE "outbox_events" ADD COLUMN "claim_lease_expires_at" TIMESTAMPTZ(6);
ALTER TABLE "outbox_events" ADD COLUMN "claimed_by" VARCHAR(128);
ALTER TABLE "outbox_events" ADD COLUMN "dispatched_at" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "idx_outbox_events_status_lease" ON "outbox_events"("status", "claim_lease_expires_at");
