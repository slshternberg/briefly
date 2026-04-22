/**
 * Records files that failed cleanup after a DB transaction rollback.
 *
 * Context: when `uploadAudioAsset` fails inside the DB transaction AND the
 * subsequent `storage.deleteFile` compensation also fails, the file is
 * stranded on disk/S3 with no DB record pointing to it. Operator needs to
 * know about these for manual cleanup — this log is the tripwire.
 */

import fs from "fs/promises";
import path from "path";

const LOG_DIR = path.join(process.cwd(), "logs");
const LOG_FILE = path.join(LOG_DIR, "orphan-files.log");

export interface OrphanFileEntry {
  storagePath: string;
  workspaceId: string;
  reason: string;
  error?: unknown;
}

export async function logOrphanFile(entry: OrphanFileEntry): Promise<void> {
  const line =
    JSON.stringify({
      timestamp: new Date().toISOString(),
      storagePath: entry.storagePath,
      workspaceId: entry.workspaceId,
      reason: entry.reason,
      error: entry.error ? String(entry.error) : undefined,
    }) + "\n";

  try {
    await fs.mkdir(LOG_DIR, { recursive: true });
    await fs.appendFile(LOG_FILE, line, "utf8");
  } catch (writeErr) {
    // Last-resort: if we can't even write to the log, dump to stderr with a
    // distinctive prefix so log aggregation still catches it.
    console.error("[ORPHAN_FILE_LOG_WRITE_FAILED]", line.trim(), writeErr);
  }
}
