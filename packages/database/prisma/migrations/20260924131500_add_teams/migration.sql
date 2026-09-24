-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "team_id" TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("team_id","membership_id")
);

-- CreateIndex
CREATE INDEX "idx_teams_workspace_id" ON "teams"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_teams_workspace_name" ON "teams"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "idx_team_members_team_id" ON "team_members"("team_id");

-- CreateIndex
CREATE INDEX "idx_team_members_membership_id" ON "team_members"("membership_id");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "workspace_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;
