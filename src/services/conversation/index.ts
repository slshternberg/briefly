import { db } from "@/lib/db";
import { getStorageProvider } from "@/services/storage";
import { AssetSourceType } from "@prisma/client";
import { storageIncrementQuery } from "@/lib/billing";
import { logOrphanFile } from "@/lib/orphan-files";

const ALLOWED_MIME_TYPES = [
  // Audio
  "audio/mpeg",      // mp3
  "audio/mp3",       // mp3 (alt)
  "audio/wav",       // wav
  "audio/x-wav",     // wav (alt)
  "audio/mp4",       // m4a
  "audio/x-m4a",     // m4a (alt)
  "audio/webm",      // webm
  "audio/ogg",       // ogg
  // Video (screen recordings — Gemini supports these)
  "video/webm",
  "video/mp4",
];

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB (video meetings can be large)

export function isAllowedMimeType(mimeType: string): boolean {
  // Strip codec parameters (e.g. "audio/webm;codecs=opus" → "audio/webm")
  const base = mimeType.split(";")[0].trim().toLowerCase();
  return ALLOWED_MIME_TYPES.includes(base);
}

export function isAllowedFileSize(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_FILE_SIZE;
}

export async function createConversation(params: {
  workspaceId: string;
  createdById: string;
  title: string;
}) {
  return db.conversation.create({
    data: {
      workspaceId: params.workspaceId,
      createdById: params.createdById,
      title: params.title,
      status: "DRAFT",
    },
  });
}

export async function uploadAudioAsset(params: {
  workspaceId: string;
  conversationId: string;
  sourceType: AssetSourceType;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
  durationSeconds?: number | null;
}) {
  const storage = getStorageProvider();

  const { storagePath, sizeBytes } = await storage.saveFile(params.buffer, {
    workspaceId: params.workspaceId,
    conversationId: params.conversationId,
    originalName: params.originalName,
    mimeType: params.mimeType,
  });

  // Defensive: we pass sizeBytes as Number to billing's increment query.
  // This fails loudly if a future storage provider returns something unsafe
  // rather than silently over-/under-counting billing.
  if (!Number.isSafeInteger(sizeBytes)) {
    throw new Error(`uploadAudioAsset: unsafe sizeBytes=${sizeBytes} from storage`);
  }

  // Atomic: asset create + conversation status + storage usage increment.
  // If any step fails, compensate by deleting the already-uploaded file.
  try {
    const [asset] = await db.$transaction([
      db.conversationAsset.create({
        data: {
          workspaceId: params.workspaceId,
          conversationId: params.conversationId,
          sourceType: params.sourceType,
          originalName: params.originalName,
          mimeType: params.mimeType,
          sizeBytes: BigInt(sizeBytes),
          storagePath,
          uploadStatus: "COMPLETED",
          durationSeconds: params.durationSeconds ?? null,
        },
      }),
      db.conversation.update({
        where: { id: params.conversationId },
        data: { status: "UPLOADED" },
      }),
      storageIncrementQuery(params.workspaceId, sizeBytes),
    ]);

    return asset;
  } catch (dbErr) {
    // Compensation: the file is already in storage but no DB record points
    // to it. Delete the file. If the delete also fails → log as orphan so
    // an operator can reconcile manually.
    try {
      await storage.deleteFile(storagePath);
    } catch (delErr) {
      await logOrphanFile({
        storagePath,
        workspaceId: params.workspaceId,
        reason: "db-tx-failed",
        error: delErr,
      });
    }
    throw dbErr;
  }
}

export async function getConversation(params: {
  conversationId: string;
  workspaceId: string;
}) {
  return db.conversation.findFirst({
    where: {
      id: params.conversationId,
      workspaceId: params.workspaceId,
      deletedAt: null,
    },
    include: {
      assets: { orderBy: { createdAt: "desc" } },
      createdBy: { select: { id: true, name: true, email: true } },
      summary: true,
    },
  });
}

export async function listConversations(params: {
  workspaceId: string;
  limit?: number;
  offset?: number;
}) {
  const { workspaceId, limit = 50, offset = 0 } = params;

  return db.conversation.findMany({
    where: { workspaceId, deletedAt: null },
    include: {
      assets: { select: { id: true, sourceType: true, mimeType: true, sizeBytes: true, durationSeconds: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
}
