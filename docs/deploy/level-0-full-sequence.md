# Deploy Runbook: Level 0 Stability Fixes

Covers items 0.1 (OAuth encryption), 0.2 (audio duration), 0.3 (S3 style learning),
0.4 (storage decrement), 0.5 (soft-delete audio route).

Expected total time: ~30 minutes active + 24h monitoring window before Stage 4.

---

## Pre-deploy checklist

- [ ] `ENCRYPTION_KEY` is set in production `.env` — must be a 64-char hex string.
  Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] Take a DB snapshot / backup before running any migrations.
- [ ] Confirm `npm run build` succeeds locally with the new code (already verified — see CI).
- [ ] Confirm `music-metadata` resolves correctly on the server:
  `node -e "require('music-metadata'); console.log('ok')"` — must print `ok`, not throw.
- [ ] Ensure the server has file system access to `uploads/` (for local storage) or S3
  credentials (for S3 mode), since the duration backfill reads audio files.

---

## Stage 1 — Deploy the code

```bash
git pull
npm install --legacy-peer-deps   # music-metadata@7 requires legacy-peer-deps
npm run build

# Apply migration 1 of 0.1 — adds encrypted token columns (nullable, safe)
# Does NOT drop any columns. Fully reversible.
npx prisma migrate deploy

pm2 restart briefly --update-env
```

**What this does:**
- Adds `googleAccessTokenEncrypted` and `googleRefreshTokenEncrypted` columns (NULL for now).
- New uploads now write `durationSeconds` at upload time.
- Style example upload now works on S3 (isLocal guard in place).
- Conversation delete now decrements `storageBytesUsed`.
- Audio route returns 404 for soft-deleted conversations.

**Rollback (if Stage 1 fails):**
```bash
git checkout HEAD~1
npm install
npm run build
npx prisma migrate deploy   # re-applies previous migrations, safe
pm2 restart briefly --update-env
```
The old code reads plaintext token columns which still exist. No data loss.

---

## Stage 2 — Run backfills

Run from the same server that has DB access and storage access.

### 2a — Encrypt existing OAuth tokens

```bash
# Dry-run first
DRY_RUN=true npx tsx src/scripts/backfill/encrypt-google-tokens.ts

# Verify the count looks right, then run for real
npx tsx src/scripts/backfill/encrypt-google-tokens.ts
```

Expected: all users with `googleAccessToken` get `googleAccessTokenEncrypted` set.

### 2b — Extract audio durations for existing conversations

```bash
# Dry-run first
DRY_RUN=true npx tsx src/scripts/backfill/extract-asset-durations.ts

# Run for real (reads audio files from storage — may take several minutes)
npx tsx src/scripts/backfill/extract-asset-durations.ts
```

Expected: Phase 1 fills `ConversationAsset.durationSeconds` for completed conversations.
Phase 2 recounts `UsageRecord.audioSecondsUsed` per period.

### 2c — Recount storage usage

```bash
DRY_RUN=true npx tsx src/scripts/backfill/recount-storage.ts
npx tsx src/scripts/backfill/recount-storage.ts
```

Expected: `storageBytesUsed` in current-period UsageRecords reflects actual stored bytes.

---

## Stage 3 — Verification queries

Run these against the production DB after Stage 2 completes.

```sql
-- 3a: OAuth — no users should have plaintext tokens without encrypted equivalent
SELECT COUNT(*) AS missing_encrypted
FROM users
WHERE "googleAccessToken" IS NOT NULL
  AND "googleAccessTokenEncrypted" IS NULL;
-- Must return 0

-- 3b: Duration — no completed conversations should have null durationSeconds
SELECT COUNT(*) AS missing_duration
FROM conversation_assets ca
JOIN conversations c ON c.id = ca."conversationId"
WHERE c.status = 'COMPLETED'
  AND ca."uploadStatus" = 'COMPLETED'
  AND ca."durationSeconds" IS NULL
  AND c."deletedAt" IS NULL;
-- Should return 0 (or a small number for very old conversations with corrupted audio)

-- 3c: Storage — spot-check one workspace
SELECT w.id, w.name, ur."storageBytesUsed",
       SUM(ca."sizeBytes") AS actual_asset_bytes
FROM workspaces w
JOIN usage_records ur ON ur."workspaceId" = w.id
LEFT JOIN conversation_assets ca ON ca."workspaceId" = w.id
LEFT JOIN conversations c ON c.id = ca."conversationId" AND c."deletedAt" IS NULL
GROUP BY w.id, w.name, ur."storageBytesUsed"
LIMIT 10;
-- storageBytesUsed should be close to actual_asset_bytes (exact match after recount)
```

**If 3a returns > 0:** the backfill didn't run, or a user connected Gmail after backfill and
the OAuth flow failed. Re-run `encrypt-google-tokens.ts`.

**If 3b returns > 0:** those assets likely have corrupted or empty audio files. Log and skip
is the right behaviour — do not block. Users can re-upload.

---

## Stage 4 — Drop plaintext token columns (24h+ after Stage 3)

**Prerequisites before Stage 4:**
1. Confirm Stage 3 query 3a returns 0.
2. Confirm at least one Gmail send worked end-to-end after Stage 1.
3. Confirm no "Failed to persist refreshed OAuth token" errors in logs for 24h.
4. Deploy the cleanup code (Step 3.5 in `docs/deploy/0.1-oauth-token-encryption.md`) —
   removes the plaintext column selects from `tokens.ts`. This must go live BEFORE the
   migration runs, otherwise queries will fail on column-not-found.

```bash
# Only after cleanup code is live:
npx prisma migrate deploy
# applies: 20260421000001_drop_plaintext_google_tokens
```

**Rollback after Stage 4:** Not straightforward — plaintext columns are gone.
Requires DB restore or manual `ALTER TABLE users ADD COLUMN "googleAccessToken" TEXT`
and populating from the encrypted columns. Avoid by following the checklist above.

---

## Post-deploy monitoring (first 24h)

- [ ] Search logs for `"Failed to persist refreshed OAuth token"` — should be zero.
- [ ] Search logs for `"Storage decrement failed"` — should be zero.
- [ ] Search logs for `"[duration] Failed to extract duration"` — log volume should
  drop after backfill (only new corrupted uploads should trigger this).
- [ ] Test end-to-end: upload a recording → process → send email → delete conversation.
  Verify `storageBytesUsed` decrements in the DB after delete.
- [ ] Check billing display for a real user: audio minutes should now show correct values
  instead of 0.
