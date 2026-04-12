# Briefly — Architecture Notes (v2, reviewed)

## Assumptions

- This is an MVP data layer. The schema is designed to be production-ready but will evolve.
- Authentication will be handled by NextAuth.js or a similar library. The `User` table stores identity; auth provider details (OAuth tokens, etc.) will be managed by the auth library's own tables.
- File storage is external (S3, GCS, or Cloudflare R2). The database stores storage keys (not full URLs) so the bucket/CDN can change without a data migration.
- AI processing (transcription, summarization, chat) is handled asynchronously. The `ConversationStatus` enum tracks the processing pipeline state.
- Stripe is the sole payment processor. Webhook events from Stripe drive subscription state changes.

## Naming Conventions

- **Tables**: plural snake_case (`workspace_members`, `chat_messages`)
- **Columns**: camelCase in Prisma, mapped to snake_case in PostgreSQL via `@@map`
- **IDs**: UUID v4 everywhere. No auto-incrementing integers.
- **Timestamps**: `createdAt` and `updatedAt` on every table. `deletedAt` on soft-deletable entities.
- **Enums**: PascalCase values (`OWNER`, `ACTIVE`, `SUMMARIZED`)
- **Counters**: `*Count` suffix for discrete counts, `*Used` suffix for continuous measurements with explicit unit in the name (e.g. `audioSecondsUsed`, `storageBytesUsed`)

## Tenant Model

- **Tenant = Workspace**. The `workspaceId` column is the tenant isolation key.
- **Every tenant-scoped table carries `workspaceId` directly** — including leaf tables like `ConversationFile`, `ConversationSummary`, `ChatThread`, and `ChatMessage`. This enables:
  - Direct RLS policies on every table without joins
  - Workspace-scoped queries without multi-table joins
  - Future partitioning by workspace
- Every query on tenant-scoped data MUST include a `workspaceId` filter.
- Enforced at three layers:
  1. Service/repository layer: `workspaceId` is a required parameter on all data access methods.
  2. Prisma middleware: rejects queries on tenant tables that lack a workspace filter.
  3. PostgreSQL RLS policies (future): defense-in-depth, applied when moving to production hardening.
- Cross-tenant data access is never allowed. There are no "global admin" queries in the application layer — admin tooling uses a separate, audited connection.

## Ownership Model

- **Users** own their identity. A user can exist independently of any workspace.
- **Workspaces** own all business data: conversations, files, summaries, chat, usage, billing.
- **WorkspaceMember** links users to workspaces with a role:
  - `OWNER`: full control, can delete workspace, manage billing. At least one per workspace.
  - `ADMIN`: can manage members and settings, but cannot delete workspace or change billing.
  - `MEMBER`: can create and view conversations, use chat. Cannot manage workspace settings.
- **User deletion is restricted** if the user is a workspace member. Memberships must be explicitly removed or reassigned first. This prevents orphaned workspaces with no owner.
- **Conversations** are owned by a workspace and track the `createdById` for attribution, not access control. Any workspace member can access any conversation in their workspace.

## Billing Model

- **Stripe customer lives on Workspace**, not on Subscription. One Stripe Customer = one billing entity = one workspace. The `stripeCustomerId` column is on the `workspaces` table with a unique constraint.
- Each workspace has exactly one active subscription at a time. Application code must enforce this (query: `WHERE workspaceId = ? AND status IN ('ACTIVE', 'TRIALING')`). A partial unique index in a raw migration is recommended for DB-level enforcement.
- Subscription period dates (`currentPeriodStart`, `currentPeriodEnd`) are nullable — free plans don't have Stripe-managed billing periods.
- The `subscriptions` table stores the full history (status changes, plan changes).
- The `plans` table is a catalog of available tiers with `maxStorageMb` added for storage limit enforcement.
- Plan limits are stored on the `Plan` record, not hardcoded in application logic.
- **Workspace deletion is restricted** if subscriptions or audit logs exist. Subscriptions must be canceled and audit logs retained for compliance before a workspace can be hard-deleted.

## Usage Model

- Usage is tracked in `usage_records`, one row per workspace per billing period.
- Usage checks happen synchronously before billable actions (upload, chat query, etc.).
- Usage counters are incremented atomically via `UPDATE ... SET count = count + 1`.
- **Storage tracking**: `storageBytesUsed` (BigInt) tracks cumulative file storage per period. Updated on file upload and deletion.
- **Audio duration**: `audioSecondsUsed` stores seconds (not minutes) for precision. Display layer converts to minutes.

### Plan Defaults (seed data)

| Field | Free | Pro |
|---|---|---|
| Monthly price | $0 | $29 |
| Conversations/month | 5 | 100 |
| Audio minutes/month | 30 | 600 |
| AI queries/month | 20 | 1000 |
| Storage | 500 MB | 10 GB |
| Members/workspace | 2 | 20 |

## Deletion Safety

| Entity | Behavior | Rationale |
|---|---|---|
| Workspace → Members | Cascade | Members are part of the workspace |
| Workspace → Conversations | Cascade | Business data owned by workspace |
| Workspace → Subscriptions | **Restrict** | Preserve billing history |
| Workspace → AuditLogs | **Restrict** | Compliance requirement |
| User → WorkspaceMember | **Restrict** | Prevent orphaned workspaces |
| User → AuditLog | SetNull | Preserve audit trail, anonymize actor |
| User → ChatMessage | SetNull | Preserve conversation history |
| Conversation → Files/Summary/Threads | Cascade | Child data follows parent |
| Plan → Subscription | **Restrict** | Can't delete a plan that's in use |

## Audit Logging

- `action` is a `String`, not an enum. This avoids a schema migration every time a new auditable action is added. Action strings follow the convention `ENTITY_VERB` (e.g., `WORKSPACE_CREATED`, `MEMBER_INVITED`).
- Audit logs survive workspace soft-deletion (Restrict on delete).

## Future Scalability Considerations

1. **Read replicas**: The schema is compatible with read/write splitting. All reads on tenant data can go to replicas; writes go to primary.
2. **Partitioning**: `audit_logs` and `usage_records` are append-heavy and good candidates for time-based partitioning. All tenant-scoped tables carry `workspaceId` and can be hash-partitioned if needed.
3. **Row-Level Security**: PostgreSQL RLS policies can be applied directly to every tenant table since they all carry `workspaceId`. No joins required.
4. **Partial unique index**: Add via raw migration: `CREATE UNIQUE INDEX idx_one_active_sub_per_workspace ON subscriptions (workspace_id) WHERE status IN ('ACTIVE', 'TRIALING')` — enforces single active subscription at the DB level.
5. **Full-text search**: `conversations` and `conversation_summaries` may benefit from PostgreSQL full-text search indexes or an external search service as data grows.
6. **Async processing queue**: Conversation processing (upload → transcribe → summarize) should flow through a job queue (BullMQ, Inngest, or similar). The `ConversationStatus` enum supports this pipeline.
7. **Rate limiting**: API-level rate limiting should be implemented at the middleware layer, separate from usage quota tracking.
8. **Data retention**: Audit logs and soft-deleted records should have a retention policy.
9. **Multi-region**: UUID primary keys and no auto-increment IDs make the schema compatible with distributed databases.
