/**
 * Backfill: recount storageBytesUsed for all workspaces.
 *
 * Sets each workspace's CURRENT period storageBytesUsed to the actual sum of
 * all non-deleted ConversationAssets plus StyleExamples currently in storage.
 *
 * Run after deploying the delete-decrement change to correct any drift that
 * accumulated before decrementStorageUsage was in place.
 *
 * Idempotent — safe to run multiple times.
 *
 * Usage:
 *   npx tsx src/scripts/backfill/recount-storage.ts
 *
 * Dry-run:
 *   DRY_RUN=true npx tsx src/scripts/backfill/recount-storage.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "true";

function periodStart(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

async function main() {
  console.log(`[recount-storage] dry_run=${DRY_RUN}`);

  const start = periodStart();

  // All workspaces with a current-period UsageRecord
  const records = await db.usageRecord.findMany({
    where: { periodStart: start },
    select: { id: true, workspaceId: true, storageBytesUsed: true },
  });

  console.log(`Found ${records.length} UsageRecord(s) for current period (${start.toISOString().slice(0, 10)})`);

  let changed = 0;
  let unchanged = 0;

  for (const record of records) {
    const ws = record.workspaceId;

    // Sum bytes of all assets for non-deleted conversations
    const assetAgg = await db.conversationAsset.aggregate({
      _sum: { sizeBytes: true },
      where: {
        workspaceId: ws,
        uploadStatus: "COMPLETED",
        conversation: { deletedAt: null },
      },
    });

    // Sum bytes of all style examples (no soft-delete on style examples)
    const styleAgg = await db.styleExample.aggregate({
      _sum: { audioSizeBytes: true },
      where: { workspaceId: ws },
    });

    const actualBytes =
      (assetAgg._sum.sizeBytes ?? BigInt(0)) +
      (styleAgg._sum.audioSizeBytes ?? BigInt(0));

    const currentBytes = record.storageBytesUsed;
    const diff = actualBytes - currentBytes;

    console.log(
      `  workspace=${ws}  stored=${currentBytes}  actual=${actualBytes}  diff=${diff}`
    );

    if (diff === BigInt(0)) {
      unchanged++;
      continue;
    }

    if (!DRY_RUN) {
      await db.usageRecord.update({
        where: { id: record.id },
        data: { storageBytesUsed: actualBytes },
      });
    }

    changed++;
  }

  console.log(`\n[recount-storage] Done — changed: ${changed}, unchanged: ${unchanged}`);
  if (DRY_RUN) console.log("[recount-storage] DRY RUN — no writes made.");
}

main()
  .catch((err) => {
    console.error("[recount-storage] Fatal:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
