# Route-level workspace isolation audit

Scope: every file under `src/app/api/**/route.ts`.

Checks applied to each handler:

1. **Auth** — calls `auth()` or `requireAuth()` and rejects missing `session.user.id` / `session.user.activeWorkspaceId` before any DB access. `N/A` for legitimate public endpoints (oauth flows, register, verify-email, password-reset, billing webhook, nextauth internals, invite-join).
2. **WorkspaceId filter** — every query against a workspace-scoped table (`Conversation`, `ConversationAsset`, `ConversationSummary`, `ChatThread`, `ChatMessage`, `StyleExample`, `StyleProfile`, `AuditLog`, `UsageRecord`, `WorkspaceInvitation`, `WorkspaceMember`, `Subscription`, `Workspace`) includes `workspaceId` in its `where` clause.
3. **DeletedAt filter** — queries against tables that carry `deletedAt` (`Workspace`, `Conversation`) include `deletedAt: null` in workspace-visible paths.

Legend: ✅ OK · ❌ gap · N/A not applicable.

## Summary table

| Route | Methods | Auth | WorkspaceId | DeletedAt | Notes |
|-------|---------|------|-------------|-----------|-------|
| `api/auth/[...nextauth]` | GET, POST | N/A | N/A | N/A | NextAuth internal handlers. |
| `api/auth/account` | DELETE | ✅ | ✅ | ✅ | Deletes own user + memberships. |
| `api/auth/google/callback` | GET | N/A | N/A | N/A | OAuth callback, state param validated. |
| `api/auth/google/connect` | GET | ✅ | ✅ | N/A | Session required; stores state with userId. |
| `api/auth/password-reset-confirm` | POST | N/A | N/A | N/A | Public; validates token. |
| `api/auth/password-reset-request` | POST | N/A | N/A | N/A | Public; constant-response. |
| `api/auth/register` | POST | N/A | N/A | N/A | Public. |
| `api/auth/resend-verification` | POST | N/A | N/A | N/A | Public (email-bound). |
| `api/auth/resend-verification-session` | POST | ✅ | N/A | N/A | Session required; no tenant data. |
| `api/auth/verify-email` | GET | N/A | N/A | N/A | Public; token-gated. |
| `api/billing/checkout` | POST | ✅ | ✅ | ✅ | Owner-only; Stripe customer scoped to workspace. |
| `api/billing/portal` | POST | ✅ | ✅ | ✅ | Owner-only; stripeCustomerId workspace-scoped. |
| `api/billing/webhook` | POST | N/A | N/A | N/A | Stripe signature verified; workspace resolved from event metadata. |
| `api/conversations` | GET, POST | ✅ | ✅ | ✅ | Lists/creates scoped to active workspace. |
| `api/conversations/[conversationId]` | PATCH, DELETE | ✅ | ✅ | ✅ | Rename + soft-delete; `updateMany` race-safe. |
| `api/conversations/[conversationId]/audio` | GET | ✅ | ✅ | ✅ | Asset lookup includes `workspaceId` + `conversation.deletedAt: null`. |
| `api/conversations/[conversationId]/chat` | POST | ✅ | ✅ | ✅ | Conversation + thread + messages all filtered by workspaceId. |
| `api/conversations/[conversationId]/process` | POST | ✅ | ✅ | ✅ | Conversation + asset queries include workspaceId. |
| `api/conversations/[conversationId]/send-email` | POST | ✅ | ✅ | ✅ | **Fixed 2026-04-23**: asset lookup now filters by `workspaceId` (defense in depth). |
| `api/conversations/[conversationId]/status` | GET | ✅ | ✅ | ✅ | findFirst with workspaceId + deletedAt. |
| `api/conversations/[conversationId]/upload` | POST | ✅ | ✅ | ✅ | Pre-check conversation ownership before upload. |
| `api/workspace/instructions` | PUT | ✅ | ✅ | N/A | Updates active workspace only; role-gated. |
| `api/workspace/language` | PUT | ✅ | ✅ | N/A | Role-gated (owner/admin). |
| `api/workspace/style-examples` | GET, POST | ✅ | ✅ | N/A | Queries + uploads scoped to active workspace. |
| `api/workspace/style-examples/[exampleId]` | POST, DELETE | ✅ | ✅ | N/A | `updateMany({id,workspaceId})` enforces tenant boundary atomically. |
| `api/workspace/style-profile` | GET, POST | ✅ | ✅ | N/A | All queries filter by workspaceId; role-gated. |
| `api/workspaces` | GET | ✅ | ✅ | ✅ | Lists memberships of current user; workspace.deletedAt filtered. |
| `api/workspaces/invite` | POST | ✅ | ✅ | N/A | Owner/admin only; invitation scoped to workspace. |
| `api/workspaces/join` | POST | N/A | N/A | N/A | Public (token-gated); creates membership. |
| `api/workspaces/members/[memberId]` | DELETE | ✅ | ✅ | N/A | findFirst{id,workspaceId} before delete; OWNER + self protected. |

## Gaps observed during audit

### Fixed in this change

- **`api/conversations/[conversationId]/send-email` — asset lookup missed `workspaceId` filter.** The conversation lookup above it was already workspace-scoped, so an attacker could not access a conversation from another workspace directly. But if the `ConversationAsset.workspaceId` ever diverged from the parent `Conversation.workspaceId` (bad migration, manual DB edit), the attachment path would have loaded arbitrary audio bytes from storage and attached them to an outbound Gmail send. Defense-in-depth fix: `where: { conversationId, workspaceId: workspace.id }`. Covered by [`workspace-isolation.test.ts`](../../src/__tests__/workspace-isolation.test.ts).

### Observed but out of scope for A.1

- **JWT-stamped roles can go stale.** `session.user.activeWorkspaceRole` is read from the NextAuth JWT. A member who is demoted will still have the old role in their JWT until it refreshes. Affects: `workspaces/members/[memberId]` role check, any other role-gated route. Mitigation options: force JWT refresh on role change, or re-query `WorkspaceMember.role` inside each role-gated handler. Track in `TODO-observed.md` if not addressed before launch.
- **Race between `findFirst` and `delete` in `workspaces/members/[memberId]`.** Between the ownership check and the delete, the row could in theory be moved. Practical risk is negligible (UUID collision needed), but `deleteMany({id, workspaceId})` eliminates even the theoretical window.

## How to re-run this audit

1. `git ls-files 'src/app/api/**/route.ts'` — enumerate current routes.
2. For each file, verify by hand:
   - `auth()` or `requireAuth()` is the first call, with an early return on missing session.
   - Every `db.<model>.findFirst/findUnique/findMany/update/delete` against a tenant-scoped table carries `workspaceId` in `where`.
   - For `Conversation` and `Workspace`: `deletedAt: null` where "visible to user" semantics apply.
3. Add any new route to the summary table above and extend `workspace-isolation.test.ts` if it touches tenant data.
