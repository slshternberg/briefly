# `AUTH_SECRET` rotation

`AUTH_SECRET` is the symmetric key NextAuth uses to sign and verify the
JWTs it stores in the `authjs.session-token` cookie. Anyone who knows
it can forge valid session tokens for any user in the workspace. Treat
it like a database password.

## When to rotate

- **On first deploy.** The bootstrap value in `.env.example` is
  placeholder text.
- **After any suspected exposure** — committed by mistake, copied to
  the wrong Slack channel, stored in a no-longer-trusted 1Password
  vault, etc.
- **At least once a year.** A cheap insurance premium.
- **Immediately** if `src/lib/env.ts` rejects the current value on
  boot (as of commit `af25431`, a too-short or missing `AUTH_SECRET`
  fails both build and runtime — this is a feature, not a bug).

## How to generate a fresh value

Pick one. Both give ≥32 bytes of entropy, well over the 32-char
minimum the env schema enforces.

```bash
# Linux / macOS
openssl rand -base64 32
```

```bash
# Any platform with Node installed — works on Windows PowerShell too
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Rotation procedure

### Local development

1. Generate a new value with one of the commands above.
2. Edit `.env.local` and replace the `AUTH_SECRET=...` line.
3. Restart the dev server (`npm run dev`).
4. Log out and back in — your old session cookie will not validate
   against the new key.

### Production (PM2 / systemd / Docker)

1. Generate a new value **on the destination machine** — never paste
   the value through intermediate tooling that might log it.
2. Edit the production `.env` (NOT `.env.example`, which is
   committed).
3. Restart the app process:
   - PM2: `pm2 restart briefly --update-env`
   - systemd: `systemctl restart briefly`
   - Docker: recreate the container with the updated env
4. Notify users: **all existing sessions will be invalidated.** Every
   user will be redirected to `/login` on their next request. This
   is expected.
5. Run the smoke checklist in `docs/deploy/MASTER-DEPLOY.md` → "שלב 9".

## Rollback

If rotation broke something (e.g. a service depending on the old
cookie), restore the previous value in `.env` and restart. The old
cookies will validate again.

**Do not keep a list of "past secrets" in any config file.** If you
need a short overlap window where both old and new secrets are
accepted, that's a product change (requires rewriting the JWT layer
to try multiple keys) — not a deploy-time workaround.

## Related

- `docs/deploy/ENV-VARS-CHECKLIST.md` — full list of env vars.
- `docs/deploy/MASTER-DEPLOY.md` — step-by-step deploy runbook.
- Commit `af25431` — the env-validation tightening that surfaces a
  too-short secret at build time.
- Commit `c7bb0af` — the SR-5 fix that invalidates JWTs when the
  user's `passwordChangedAt` advances (different mechanism; doesn't
  substitute for full rotation, but worth knowing about).
