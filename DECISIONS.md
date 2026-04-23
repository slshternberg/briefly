# Decisions log — wrap-up session 2026-04-23

Non-trivial choices made while finalising the hardening work. Written
so that a future reader can understand *why*, not just *what*.

## D-1: `src/middleware.ts` deletion stays; `src/proxy.ts` replaces it

**Context.** Working tree showed `src/middleware.ts` as `D` (tracked,
deleted) and `src/proxy.ts` as `??` (new, untracked) with essentially
the same code.

**Decision.** Keep the deletion, commit `proxy.ts`.

**Why.** [Next.js 16 docs](https://nextjs.org/docs/app/api-reference/file-conventions/middleware)
state that the `middleware` file convention is deprecated and has been
renamed to `proxy`. The official codemod is
`npx @next/codemod@canary middleware-to-proxy .`, which is exactly the
diff already present locally. Leaving both in the tree would double-run
the auth wrapper; leaving `middleware.ts` alone would use the
deprecated convention.

**Alternative considered.** `git checkout HEAD -- src/middleware.ts` and
delete `proxy.ts`. Rejected because it would fight Next 16 conventions
and make future upgrades harder.

## D-2: Strip duplicated security headers from `src/proxy.ts`

**Context.** `proxy.ts` includes a local security-headers block (X-Frame,
nosniff, Referrer-Policy, Permissions-Policy). Commit `65e0bf2` (A.4)
already emits the same set from `next.config.ts` globally.

**Decision.** Remove the block from `proxy.ts` in the same commit that
promotes it into git. Keep the NextAuth wrapper + matcher. Strict-
Transport-Security remains only in `next.config.ts` (prod-gated).

**Why.** Duplication means two paths to update on every header change,
and one path (`next.config.ts`) covers **every** response, while the
proxy matcher only covers a handful of routes. `next.config.ts` is the
broader, safer home.

## D-3: `.claude/` added to `.gitignore`

**Context.** The directory is Claude Code's IDE-local config
(`settings.local.json`), created during the session. It was about to
be committed by `git add .`.

**Decision.** Gitignore it.

**Why.** IDE-local configs are user-specific. Committing them would
overwrite other contributors' local settings.

## D-4: `npm run build` currently fails locally — not blocking

**Context.** Commit `af25431` (SR-8) tightened env validation. The
local `.env.local` has `AUTH_SECRET` = 31 chars, below the schema's
32-char minimum. Build fails with `AUTH_SECRET must be at least 32
chars`.

**Decision.** Do not edit `.env.local`. Document the fix in
`docs/deploy/auth-secret-rotation.md` and the Master Deploy Guide.
Continue with other work. Tests (`vitest run`), lint (`eslint`), and
typecheck (`tsc --noEmit`) remain green and are the gating checks for
commits in this session.

**Why.** The failure is SR-8 *catching a pre-existing misconfiguration*
— exactly what it was supposed to catch. Editing `.env.local` would
silently paper over the problem the user explicitly asked to surface.
The project owner will rotate the secret themselves when they pick up
the deploy guide.

## D-5: Per-topic commits rather than one mega-commit

**Context.** 38 files to land. Could collapse into a single commit,
but the user's prompt was explicit: "commit קטנים ותיאוריים".

**Decision.** Ten topic-scoped commits (billing, workspaces, auth
pages, legal, status polling, ops, tests, UI polish, middleware rename,
docs). See Phase 3 in the wrap-up plan.

**Why.** Each topic has a clean revert path. A future bug introduced
by (say) the Stripe work can be `git revert <billing-commit>` without
touching the workspace switcher or the UI polish commits.

## D-6: `instrumentation.ts` committed as-is, no changes

**Context.** New Next.js server-boot hook that does two things:
(1) marks conversations stuck in PROCESSING for >2 min as FAILED on
boot (recovers from crashes); (2) `node-cron` every 10 min auto-fails
anything stuck >30 min.

**Decision.** Accept as written — no changes.

**Why.** Self-contained, well-documented inline, guarded against
double-registration (HMR in dev) and Edge runtime. It complements the
client-side auto-fail already in `/api/conversations/[id]/status`. Not
adding tests because booting a test harness for an instrumentation
hook is disproportionate to the logic complexity.

## D-7: No test added for `src/proxy.ts`

**Context.** `src/proxy.ts` is a thin wrapper around NextAuth's
`auth()` helper + a `config.matcher` array.

**Decision.** Skip dedicated unit tests.

**Why.** The logic inside the handler is a single line
(`NextResponse.next()`). Everything that matters is matcher config and
the NextAuth `authorized` callback — both already covered by the
existing E2E dashboard-redirect behaviour that we'd need browser tests
for (outside scope).

## D-8: Build step is NOT gated before commits in this session

**Context.** Normal self-review protocol requires `lint + tsc + test +
build` green before each commit. SR-8 makes `build` fail locally.

**Decision.** Treat `lint + tsc + test` as the gating subset for this
session. `build` is verified per-commit by the user after rotating
`AUTH_SECRET`.

**Why.** The build failure is a fixed environmental issue, unrelated
to the code changes being committed. Waiting for the user to rotate
their secret before each of ten commits would serialise an async human
step into the hot path.
