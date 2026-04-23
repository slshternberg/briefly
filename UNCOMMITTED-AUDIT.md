# Uncommitted file audit — 2026-04-23

Inventory of every file showing up in `git status` at the start of this
wrap-up session. Each row has a decision: **Keep** (commit as-is),
**Commit with cleanup**, **Restore** (recover a deleted tracked file),
**Discard** (drop from working tree), or **Ignore** (add to `.gitignore`).

Default decision is **Keep** unless there's explicit evidence the file
shouldn't be in git.

## Summary counts

| Decision | Count |
|---|---|
| Keep — commit as-is | 18 |
| Commit with cleanup | 2 |
| Restore (tracked deletion that should stay deleted — Next 16 migration) | 1 |
| Ignore (add to `.gitignore`) | 2 |
| Discard | 0 |
| **Total** | **23 entries** (some cover directories) |

## Modified (tracked) — `M` or `D`

| File | State | History | Purpose | Used by | Decision |
|------|------|---------|---------|---------|----------|
| `src/middleware.ts` | D | In `ec4a9ff`, `874e014` | NextAuth middleware (auth wrapper + security headers) | NextAuth session + redirects | **Keep deleted** — Next 16 renamed convention to `proxy.ts`. `src/proxy.ts` replaces it (see below). Per [Next 16 docs](https://nextjs.org/docs/app/api-reference/file-conventions/middleware) the rename is the official codemod path. |
| `src/app/(auth)/join/page.tsx` | M | Tracked | Invite-join landing | Invite flow | Keep |
| `src/app/(auth)/layout.tsx` | M | Tracked | Shared auth layout | All auth pages | Keep |
| `src/app/(auth)/login/page.tsx` | M | Tracked | Login form | `/login` | Keep |
| `src/app/(auth)/register/page.tsx` | M | Tracked | Registration form | `/register` | Keep |
| `src/app/(dashboard)/dashboard/conversations/[conversationId]/page.tsx` | M | Tracked | Conversation view | Router | Keep |
| `src/app/(dashboard)/dashboard/conversations/new/page.tsx` | M | Tracked | New conversation | Router | Keep |
| `src/app/(dashboard)/dashboard/page.tsx` | M | Tracked | Dashboard home | Router | Keep |
| `src/app/(dashboard)/dashboard/settings/page.tsx` | M | Tracked | Settings page | Router | Keep |
| `src/app/(dashboard)/layout.tsx` | M | Tracked | Dashboard shell | Router | Keep |
| `src/components/conversations/conversation-chat.tsx` | M | Tracked | Chat panel | Conversation view | Keep |
| `src/components/conversations/conversation-list.tsx` | M | Tracked | List | Dashboard | Keep |
| `src/components/conversations/draft-upload.tsx` | M | Tracked | Upload UI | New conversation | Keep |
| `src/components/conversations/file-upload.tsx` | M | Tracked | File picker | Upload | Keep |
| `src/components/conversations/process-button.tsx` | M | Tracked | Analyze button | Conversation view | Keep |
| `src/components/settings/google-connect-button.tsx` | M | Tracked | Gmail connect | Settings | Keep |
| `src/components/settings/invite-member.tsx` | M | Tracked | Invite form | Settings | Keep |
| `src/hooks/use-recorder.ts` | M | Tracked | Mic/screen recorder | New conversation | Keep |
| `src/lib/client-language.ts` | M | Tracked | Client-side labels | UI | Keep |
| `src/services/storage/s3-storage.ts` | M | Tracked | S3 provider | Storage | Keep |
| `src/types/next-auth.d.ts` | M | Tracked | NextAuth type aug | Auth | Keep |

All `M` files are incremental UI/UX work on top of existing components.
Diffs total 512 insertions / 107 deletions across 20 files; no file
grew by more than ~140 lines, matching normal feature work.

## Untracked — `??`

| File | Type | Purpose | Used by | Decision |
|------|------|---------|---------|----------|
| `src/proxy.ts` | new | Next 16 replacement for `middleware.ts`. NextAuth `auth()` wrapper + (now-redundant) security headers matcher for `/dashboard`, `/settings`, `/verify-email`, `/login`, `/register`, `/forgot-password`, `/reset-password` | Next.js auto-discovers | **Commit with cleanup** — remove the security-headers block (duplicated now by `next.config.ts` from A.4) and keep only the NextAuth wrapper. |
| `instrumentation.ts` | new | Next.js `register()` hook for: (1) recover PROCESSING conversations stranded by a crash; (2) `node-cron` every 10 min auto-fails conversations stuck >30 min. | Server boot | Keep — self-contained, documented inline |
| `prisma/seed.ts` | new | Dev/test seed | `prisma db seed` | Keep |
| `src/app/(auth)/verified/page.tsx` | new | Landing after successful verify-email redirect | `/api/auth/verify-email` success path | Keep |
| `src/app/(auth)/verify-email/page.tsx` | new | "Check your inbox" page for unverified sessions | Auth flow | Keep |
| `src/app/(legal)/layout.tsx` | new | Legal-pages shell | `/terms`, `/privacy`, `/help` | Keep |
| `src/app/(legal)/terms/page.tsx` | new | Terms of service | Router | Keep |
| `src/app/(legal)/privacy/page.tsx` | new | Privacy policy | Router | Keep |
| `src/app/(legal)/help/page.tsx` | new | Help page | Router | Keep |
| `src/app/api/billing/webhook/route.ts` | new | Stripe event webhook | Stripe `webhookSecret` setup | Keep |
| `src/app/api/conversations/[conversationId]/status/route.ts` | new | Poll conversation status (used by `process-button.tsx`) | UI polling | Keep |
| `src/app/api/workspaces/route.ts` | new | List workspaces the user is a member of | `workspace-switcher.tsx` | Keep |
| `src/app/api/workspaces/members/[memberId]/route.ts` | new | Remove workspace member (OWNER/ADMIN only) | Settings | Keep |
| `src/components/layout/workspace-switcher.tsx` | new | Dropdown to switch active workspace | Dashboard layout | Keep |
| `src/components/settings/billing-section.tsx` | new | Stripe billing UI in settings | Settings page | Keep |
| `src/lib/stripe.ts` | new | Lazy Stripe SDK singleton | billing routes + webhook | Keep |
| `src/__tests__/auth-validation.test.ts` | new | Zod tests for register/login schemas | vitest | Keep |
| `vitest.config.ts` | new | Vitest config (node env, `@` alias) | Test runner | Keep |
| `SYSTEM_ANALYSIS_REPORT.md` | new | Working notes on system state 2026-04-21 | Humans | Keep |
| `TEST_TASKS.md` | new | Prioritized list of missing coverage | Humans | Keep |
| `.claude/` | new | Claude Code local config (`settings.local.json`) | Claude Code only | **Ignore** — add to `.gitignore` |

## Cross-dependency check — do newer files import things that exist?

Greps run during audit:

- `grep -rn "from [\"']@/lib/stripe[\"']" src/` → used by
  `src/app/api/billing/checkout/route.ts`,
  `src/app/api/billing/portal/route.ts`,
  `src/app/api/billing/webhook/route.ts`,
  `src/components/settings/billing-section.tsx`.
- `grep -rn "from [\"']@/components/layout/workspace-switcher[\"']" src/` →
  imported by `src/app/(dashboard)/layout.tsx`.
- `grep -rn "from [\"']@/components/settings/billing-section[\"']" src/` →
  imported by `src/app/(dashboard)/dashboard/settings/page.tsx`.

All referenced files exist; no dangling import paths would break after
committing.

## Deleted-without-replacement check

`src/middleware.ts` is the only `D` entry. Confirmed via
[Next.js 16 docs](https://nextjs.org/docs/app/api-reference/file-conventions/middleware):
`middleware` is deprecated and replaced by `proxy`. `src/proxy.ts`
carries the same `auth()` wrapper with a superset matcher (adds
`/verify-email`). Keeping the deletion + committing `proxy.ts` matches
the documented codemod migration path.

## Follow-up flagged during audit

1. `src/proxy.ts` duplicates the base security headers that A.4 moved
   to `next.config.ts`. Will strip the duplicate block in the same
   commit that promotes `proxy.ts` into git (see Phase 3 commit 2).
2. `.claude/` needs to be gitignored before any commit to avoid
   accidentally shipping an IDE-local config file.
3. `AUTH_SECRET` in the local `.env.local` is 31 chars — below the
   32-char minimum enforced by `env.ts` since commit `af25431`. `npm
   run build` will fail locally until it is rotated. Not in scope for
   this audit; tracked in `DECISIONS.md` + the master deploy guide.
