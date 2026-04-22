/**
 * Backfill: encrypt plaintext Google OAuth tokens for all existing users.
 *
 * Run AFTER migration 20260421000000_add_encrypted_google_token_columns is applied.
 * Do NOT run after 20260421000001_drop_plaintext_google_tokens — plaintext columns
 * will no longer exist.
 *
 * Idempotent: skips users whose encrypted column is already populated.
 *
 * Usage:
 *   npx tsx src/scripts/backfill/encrypt-google-tokens.ts
 *
 * Dry-run (no writes):
 *   DRY_RUN=true npx tsx src/scripts/backfill/encrypt-google-tokens.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { buildBackfillUpdate } from "@/services/google/tokens";

const db = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "true";
const BATCH_SIZE = 100;

async function main() {
  console.log(`[backfill] Starting Google token encryption backfill (dry_run=${DRY_RUN})`);

  let cursor: string | undefined;
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalUpdated = 0;

  while (true) {
    // Pick up ANY user with at least one plaintext column that is not yet
    // encrypted — covers mixed-state users (e.g. access refreshed post-deploy
    // so access is encrypted, but refresh is still plaintext).
    const users = await db.user.findMany({
      where: {
        OR: [
          {
            googleAccessToken: { not: null },
            googleAccessTokenEncrypted: null,
          },
          {
            googleRefreshToken: { not: null },
            googleRefreshTokenEncrypted: null,
          },
        ],
      },
      select: {
        id: true,
        googleAccessToken: true,
        googleAccessTokenEncrypted: true,
        googleRefreshToken: true,
        googleRefreshTokenEncrypted: true,
      },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
    });

    if (users.length === 0) break;

    cursor = users[users.length - 1].id;
    totalProcessed += users.length;

    for (const user of users) {
      const data = buildBackfillUpdate(user);
      if (!data) {
        totalSkipped++;
        continue;
      }

      if (!DRY_RUN) {
        await db.user.update({ where: { id: user.id }, data });
      }

      totalUpdated++;
    }

    console.log(
      `[backfill] Batch done — processed ${totalProcessed}, updated ${totalUpdated}, skipped ${totalSkipped}`
    );
  }

  console.log(
    `[backfill] Complete — total processed: ${totalProcessed}, updated: ${totalUpdated}, skipped: ${totalSkipped}`
  );

  if (DRY_RUN) {
    console.log("[backfill] DRY RUN — no writes were made.");
  }
}

main()
  .catch((err) => {
    console.error("[backfill] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
