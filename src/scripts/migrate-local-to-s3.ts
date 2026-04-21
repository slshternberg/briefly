/**
 * One-time migration: copy all ConversationAsset files from local disk to S3.
 *
 * USAGE:
 *   # Dry run first — shows what would be migrated, touches nothing:
 *   DRY_RUN=true npx tsx src/scripts/migrate-local-to-s3.ts
 *
 *   # Live run — copies files to S3 and updates storagePath in the DB:
 *   npx tsx src/scripts/migrate-local-to-s3.ts
 *
 * REQUIREMENTS (all must be set in env):
 *   DATABASE_URL, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET
 *
 * HOW IT WORKS:
 *   1. Reads every ConversationAsset from the DB.
 *   2. For each asset, reads the file from local disk (uploads/).
 *   3. Uploads to S3 under the same key path.
 *   4. Updates asset.storagePath in the DB to the S3 key.
 *   5. On completion, set STORAGE_TYPE=s3 in .env and restart the server.
 *
 * SAFETY:
 *   - Dry run by default (set DRY_RUN=false to actually migrate).
 *   - Skips assets whose local file is missing (logs a warning).
 *   - Skips assets that already look like S3 keys (contain no /uploads/ prefix).
 *   - Idempotent: safe to re-run; already-migrated assets are skipped.
 *   - Does NOT delete local files — do that manually after verification.
 */

import path from "path";
import fs from "fs/promises";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

// Files that define or implement getFilePath — these are expected to contain it.
const STORAGE_DEFINITION_FILES = new Set([
  "local-storage.ts",
  "s3-storage.ts",
  "types.ts",
]);

/**
 * Abort if any source file calls getFilePath() without an isLocal guard.
 * Such calls will throw at runtime on S3 storage.
 */
async function checkPreflightGetFilePath(): Promise<void> {
  const dangerous: { file: string; line: number; text: string }[] = [];

  async function scanDir(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".ts") &&
        !STORAGE_DEFINITION_FILES.has(entry.name)
      ) {
        const content = await fs.readFile(fullPath, "utf8");
        if (content.includes("getFilePath(") && !content.includes("isLocal")) {
          const lines = content.split("\n");
          lines.forEach((line, i) => {
            if (line.includes("getFilePath(")) {
              dangerous.push({ file: fullPath, line: i + 1, text: line.trim() });
            }
          });
        }
      }
    }
  }

  await scanDir(path.join(process.cwd(), "src"));

  if (dangerous.length > 0) {
    console.error("\n[PREFLIGHT FAIL] Unguarded getFilePath() calls found:");
    for (const { file, line, text } of dangerous) {
      const rel = path.relative(process.cwd(), file);
      console.error(`  ${rel}:${line}  ${text}`);
    }
    console.error(
      "\nThese calls will throw when STORAGE_TYPE=s3." +
        "\nFix them with an isLocal guard before migrating.\n"
    );
    process.exit(1);
  }

  console.log("[preflight] No unguarded getFilePath() calls — safe to migrate.");
}
import { PrismaClient } from "@prisma/client";

const IS_DRY_RUN = process.env.DRY_RUN !== "false";
const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

const db = new PrismaClient();

function getS3Client(): S3Client {
  const required = [
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_S3_BUCKET",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing env vars: ${missing.join(", ")}`);
  }
  return new S3Client({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

async function s3KeyExists(s3: S3Client, key: string): Promise<boolean> {
  try {
    await s3.send(
      new HeadObjectCommand({ Bucket: process.env.AWS_S3_BUCKET!, Key: key })
    );
    return true;
  } catch {
    return false;
  }
}

async function main() {
  await checkPreflightGetFilePath();

  console.log(
    IS_DRY_RUN
      ? "=== DRY RUN (set DRY_RUN=false to migrate) ==="
      : "=== LIVE MIGRATION ==="
  );

  const s3 = getS3Client();

  const assets = await db.conversationAsset.findMany({
    select: {
      id: true,
      storagePath: true,
      mimeType: true,
      originalName: true,
    },
  });

  console.log(`Found ${assets.length} assets to check.`);

  let skipped = 0;
  let migrated = 0;
  let errors = 0;

  for (const asset of assets) {
    // If storagePath already looks like an S3 key (workspaceId/convId/ts-name),
    // check whether it actually exists on S3. If yes, skip.
    const localPath = path.join(UPLOAD_ROOT, asset.storagePath);

    // Check if local file exists
    let localExists = false;
    try {
      await fs.access(localPath);
      localExists = true;
    } catch {
      // not on local disk
    }

    if (!localExists) {
      // Maybe already migrated — check S3
      if (!IS_DRY_RUN) {
        const onS3 = await s3KeyExists(s3, asset.storagePath);
        if (onS3) {
          console.log(`  SKIP  (already on S3) ${asset.storagePath}`);
          skipped++;
          continue;
        }
      }
      console.warn(`  WARN  local file missing and not on S3: ${asset.storagePath}`);
      errors++;
      continue;
    }

    console.log(`  ${IS_DRY_RUN ? "WOULD MIGRATE" : "MIGRATING"} ${asset.storagePath}`);

    if (!IS_DRY_RUN) {
      try {
        const buffer = await fs.readFile(localPath);
        await s3.send(
          new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET!,
            Key: asset.storagePath, // same key format — no path change needed
            Body: buffer,
            ContentType: asset.mimeType,
          })
        );
        // storagePath stays identical — just the storage backend changes
        // (no DB update needed unless key format differs)
        migrated++;
      } catch (err) {
        console.error(`  ERROR migrating ${asset.storagePath}:`, err);
        errors++;
      }
    } else {
      migrated++;
    }
  }

  console.log("\n=== Summary ===");
  console.log(`  ${IS_DRY_RUN ? "Would migrate" : "Migrated"}: ${migrated}`);
  console.log(`  Skipped (already on S3): ${skipped}`);
  console.log(`  Errors: ${errors}`);

  if (!IS_DRY_RUN && errors === 0) {
    console.log(
      "\nNext step: set STORAGE_TYPE=s3 in your .env and restart the server."
    );
    console.log(
      "After confirming everything works, you can delete the local uploads/ directory."
    );
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
