CREATE TABLE IF NOT EXISTS "workspace_invitations" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspaceId" UUID NOT NULL,
  "email"       TEXT NOT NULL,
  "role"        TEXT NOT NULL DEFAULT 'MEMBER',
  "tokenHash"   TEXT NOT NULL,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "usedAt"      TIMESTAMP(3),
  "invitedById" UUID NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workspace_invitations_tokenHash_key"
  ON "workspace_invitations"("tokenHash");

CREATE INDEX IF NOT EXISTS "workspace_invitations_workspaceId_idx"
  ON "workspace_invitations"("workspaceId");

ALTER TABLE "workspace_invitations"
  ADD CONSTRAINT "workspace_invitations_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workspace_invitations"
  ADD CONSTRAINT "workspace_invitations_invitedById_fkey"
  FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
