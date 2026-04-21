/**
 * Backfill: extract audio duration for ConversationAssets that have no durationSeconds,
 * then recount audioSecondsUsed for all affected UsageRecords.
 *
 * Run AFTER deploying the upload-route duration extraction change.
 *
 * Idempotent: skips assets that already have durationSeconds set.
 * UsageRecord recount is always a full sum — not a delta — so it's safe to re-run.
 *
 * Usage:
 *   npx tsx src/scripts/backfill/extract-asset-durations.ts
 *
 * Dry-run (no writes):
 *   DRY_RUN=true npx tsx src/scripts/backfill/extract-asset-durations.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { extractDurationSeconds } from "@/lib/duration";
import { getStorageProvider } from "@/services/storage";

const db = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "true";
const BATCH_SIZE = 50;

async function phase1ExtractDurations(): Promise<Set<string>> {
  console.log("\n[phase 1] Extracting durations for assets with durationSeconds = null");
  const storage = getStorageProvider();
  const isLocal = process.env.STORAGE_TYPE !== "s3";

  const affectedWorkspaces = new Set<string>();
  let cursor: string | undefined;
  let processed = 0;
  let updated = 0;
  let failed = 0;

  while (true) {
    const assets = await db.conversationAsset.findMany({
      where: { durationSeconds: null, uploadStatus: "COMPLETED" },
      select: {
        id: true,
        workspaceId: true,
        storagePath: true,
        mimeType: true,
      },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
    });

    if (assets.length === 0) break;
    cursor = assets[assets.length - 1].id;
    processed += assets.length;

    for (const asset of assets) {
      let duration: number | null = null;
      try {
        duration = await extractDurationSeconds(
          isLocal
            ? { filePath: storage.getFilePath(asset.storagePath) }
            : { buffer: await storage.getFileBuffer(asset.storagePath), mimeType: asset.mimeType }
        );
      } catch {
        // extractDurationSeconds shouldn't throw, but guard anyway
      }

      if (duration == null) {
        console.warn(`  SKIP (could not extract) ${asset.storagePath}`);
        failed++;
        continue;
      }

      if (!DRY_RUN) {
        await db.conversationAsset.update({
          where: { id: asset.id },
          data: { durationSeconds: duration },
        });
      }

      affectedWorkspaces.add(asset.workspaceId);
      updated++;
      console.log(`  ${DRY_RUN ? "WOULD UPDATE" : "UPDATED"} ${asset.storagePath} → ${duration}s`);
    }

    console.log(`  [phase 1] batch done — processed ${processed}, updated ${updated}, failed ${failed}`);
  }

  console.log(`[phase 1] Complete — updated ${updated}, failed ${failed}`);
  return affectedWorkspaces;
}

async function phase2RecountUsage(affectedWorkspaces: Set<string>): Promise<void> {
  if (affectedWorkspaces.size === 0) {
    console.log("\n[phase 2] No affected workspaces — skipping recount");
    return;
  }

  console.log(`\n[phase 2] Recounting audioSecondsUsed for ${affectedWorkspaces.size} workspace(s)`);

  // Recount for ALL UsageRecords of affected workspaces, not just the current period.
  // This corrects historical records that accumulated 0s instead of real duration.
  const records = await db.usageRecord.findMany({
    where: { workspaceId: { in: [...affectedWorkspaces] } },
    select: { id: true, workspaceId: true, periodStart: true, periodEnd: true, audioSecondsUsed: true },
  });

  for (const record of records) {
    // Sum durationSeconds for COMPLETED conversations whose analysis finished in this period.
    // ConversationSummary.createdAt is the moment analysis completed (and billing was triggered).
    const agg = await db.conversationAsset.aggregate({
      _sum: { durationSeconds: true },
      where: {
        workspaceId: record.workspaceId,
        uploadStatus: "COMPLETED",
        durationSeconds: { not: null },
        conversation: {
          status: "COMPLETED",
          summary: {
            createdAt: {
              gte: record.periodStart,
              lt: record.periodEnd,
            },
          },
        },
      },
    });

    const newSeconds = agg._sum.durationSeconds ?? 0;
    console.log(
      `  workspace=${record.workspaceId} period=${record.periodStart.toISOString().slice(0, 10)} ` +
        `old=${record.audioSecondsUsed}s → new=${newSeconds}s`
    );

    if (!DRY_RUN) {
      await db.usageRecord.update({
        where: { id: record.id },
        data: { audioSecondsUsed: newSeconds },
      });
    }
  }

  console.log(`[phase 2] Complete — recounted ${records.length} UsageRecord(s)`);
}

async function main() {
  console.log(`[backfill] extract-asset-durations (dry_run=${DRY_RUN})`);

  const affectedWorkspaces = await phase1ExtractDurations();
  await phase2RecountUsage(affectedWorkspaces);

  if (DRY_RUN) {
    console.log("\n[backfill] DRY RUN — no writes were made.");
  } else {
    console.log("\n[backfill] Done.");
  }
}

main()
  .catch((err) => {
    console.error("[backfill] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
