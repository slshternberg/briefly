# Briefly

Multi-tenant SaaS for AI meeting summaries. Record or upload business
conversations, get structured Gemini-powered analysis + follow-up chat
per conversation, and send personalised Gmail summaries in the user's
own writing style.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind 4 · Prisma 5
on Postgres · NextAuth v5 (JWT / Credentials) · `@google/genai` · Stripe.

## Getting started

### 1. Prerequisites

- Node 20+
- PostgreSQL 14+ reachable locally
- (Optional) Google Cloud project with Gmail API enabled for the
  Gmail-send feature.
- (Optional) Stripe account for billing.

### 2. Install

```bash
npm install --legacy-peer-deps
```

The `--legacy-peer-deps` flag is required because `music-metadata@7`
declares strict peer ranges that don't all match Next 16's.

### 3. Environment

Copy the example and fill in real values:

```bash
cp .env.example .env.local
```

Minimum set needed to boot the dev server:

- `DATABASE_URL`
- `AUTH_SECRET` — **must be at least 32 characters**. Generate one:
  ```bash
  # Linux / macOS
  openssl rand -base64 32
  # Any platform
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `AUTH_URL` — `http://localhost:3000` in dev.
- `GEMINI_API_KEY`
- `ENCRYPTION_KEY` — 64 hex chars (32 bytes). Generate:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` — any SMTP provider. Gmail app
  passwords work. SMTP_PORT defaults to 587.

Stripe, Google OAuth, S3 are optional — the env schema marks them
`optional()` so the app boots without them, and the corresponding
features no-op or show a friendly disabled state.

The `env.ts` validator runs at boot and will throw with a clear
message listing every missing or malformed variable. See
[`docs/deploy/ENV-VARS-CHECKLIST.md`](docs/deploy/ENV-VARS-CHECKLIST.md)
for the full matrix.

### 4. Database

```bash
npx prisma migrate deploy
npx prisma db seed        # optional — seeds the free / paid Plan rows
```

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000.

## Common commands

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server with HMR. |
| `npm run build` | Production build. Fails fast on malformed env vars (see commit `af25431`). |
| `npm run start` | Serve the production build. |
| `npm run lint` | ESLint. |
| `npx tsc --noEmit` | TypeScript strict check. |
| `npx vitest run` | Unit + route-integration tests. |
| `npx prisma studio` | Browse the DB. |

## Tests

Current baseline: **140 tests across 16 files**. Highlights:

- `jwt-callback.test.ts` — SR-1/SR-5 workspace-hijack + session-invalidation.
- `workspace-isolation.test.ts` — cross-tenant send-email protection.
- `request-validation.test.ts` — Zod schemas for every `request.json()`.
- `rate-limit.test.ts` — 429 + Retry-After + audit-log wiring.
- `token-consume.test.ts` — atomic one-time-use for reset/verify/join.
- `concurrent-process.test.ts`, `concurrent-delete.test.ts` — race
  safety for the analysis and delete flows.

Prioritised list of still-missing coverage:
[`TEST_TASKS.md`](TEST_TASKS.md).

## Deployment

Read in order:

1. [`docs/deploy/MASTER-DEPLOY.md`](docs/deploy/MASTER-DEPLOY.md) —
   end-to-end runbook.
2. [`docs/deploy/ENV-VARS-CHECKLIST.md`](docs/deploy/ENV-VARS-CHECKLIST.md)
   — what to set where.
3. [`docs/deploy/level-0-full-sequence.md`](docs/deploy/level-0-full-sequence.md)
   — the narrower Level-0 stability checklist from earlier iterations.
4. [`docs/deploy/auth-secret-rotation.md`](docs/deploy/auth-secret-rotation.md)
   — when / how to rotate `AUTH_SECRET`.
5. [`docs/deploy/rate-limiting.md`](docs/deploy/rate-limiting.md) —
   current memory backend + Redis upgrade path.
6. [`docs/security/route-audit.md`](docs/security/route-audit.md) —
   per-route auth / workspaceId / deletedAt status.

## Project docs

- [`SYSTEM_ANALYSIS_REPORT.md`](SYSTEM_ANALYSIS_REPORT.md) — current
  state overview.
- [`TODO-observed.md`](TODO-observed.md) — known follow-ups and
  non-blocking issues.
- [`DECISIONS.md`](DECISIONS.md) — non-trivial choices made during
  the hardening + wrap-up sessions.
- [`SESSION-SUMMARY.md`](SESSION-SUMMARY.md) — what the most recent
  sessions landed and what's still open.
