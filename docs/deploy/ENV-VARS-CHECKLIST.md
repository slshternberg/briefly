# Environment variables — full checklist

Every variable the app reads. Use this as the reference when setting up
`.env.local` for dev or `.env` on the server.

Legend for **Where**:
- `local` — needed on a dev machine to run `npm run dev`.
- `prod` — needed on the production server.
- `both` — needed everywhere.

Legend for **When**:
- Required — app fails to boot without it (`env.ts` throws).
- Optional — feature that depends on it silently disables itself.

| Variable | Where | When | How to generate / source |
|---|---|---|---|
| `DATABASE_URL` | both | Required | Postgres connection string (`postgresql://user:pass@host:5432/db?schema=public`) |
| `AUTH_SECRET` | both | Required (≥32 chars) | `openssl rand -base64 32` or `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. See `auth-secret-rotation.md`. |
| `AUTH_URL` | both | Required | Full URL, no trailing slash. Dev: `http://localhost:3000`. Prod: your domain with https. |
| `GEMINI_API_KEY` | both | Required | https://aistudio.google.com → Get API key |
| `GEMINI_MODEL` | both | Optional | Default `gemini-2.5-flash`. Do NOT set to the `-preview-` variant — that was removed upstream in 2026-04. |
| `ENCRYPTION_KEY` | both | Required (64 hex chars) | `openssl rand -hex 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SMTP_HOST` | both | Required | e.g. `smtp.gmail.com`, `smtp.sendgrid.net` |
| `SMTP_PORT` | both | Optional (default `587`) | 587 for STARTTLS, 465 for SSL |
| `SMTP_SECURE` | both | Optional (default `"false"`) | `"true"` when using port 465 |
| `SMTP_USER` | both | Required (valid email) | The sender address |
| `SMTP_PASS` | both | Required | App password / API key |
| `GOOGLE_CLIENT_ID` | both | Optional | Google Cloud → APIs → OAuth client ID (enables "Connect Gmail" feature) |
| `GOOGLE_CLIENT_SECRET` | both | Optional | Paired with the ID |
| `STORAGE_TYPE` | both | Optional (default `"local"`) | `"local"` or `"s3"` |
| `AWS_REGION` | server | Required when `STORAGE_TYPE=s3` | e.g. `us-east-1` |
| `AWS_ACCESS_KEY_ID` | server | Required when `STORAGE_TYPE=s3` | IAM user/role with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` |
| `AWS_SECRET_ACCESS_KEY` | server | Required when `STORAGE_TYPE=s3` | Paired with the ID |
| `AWS_S3_BUCKET` | server | Required when `STORAGE_TYPE=s3` | Bucket name |
| `STRIPE_SECRET_KEY` | prod | Required for billing | Stripe dashboard → API keys |
| `STRIPE_WEBHOOK_SECRET` | prod | Required for billing | From the webhook endpoint config |
| `STRIPE_PRO_PRICE_ID` | prod | Required for billing | Price ID for the paid plan |
| `NEXT_PHASE` | — | Set by Next.js | Do NOT set manually. `env.ts` uses it to distinguish build from runtime. |
| `PM2_INSTANCES` | prod | Informational | If ever set >1, the rate-limiter prints a startup warning (see `rate-limiting.md`). |

## Quick validation

```bash
# From the project root:
npm run check:env
```

This runs `env.ts` in isolation and prints a human-readable error list
for anything missing or malformed. Runs in under a second and makes no
network calls.

## First-deploy minimum

The smallest env that boots the app with auth + conversations working
(no Stripe, no Google, local storage):

```
DATABASE_URL=...
AUTH_SECRET=...          # ≥32 chars
AUTH_URL=https://your-domain.com
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
ENCRYPTION_KEY=...       # 64 hex chars
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
STORAGE_TYPE=local
```

Everything else can be added incrementally as features are turned on.
