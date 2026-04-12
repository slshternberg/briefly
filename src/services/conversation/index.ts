import { db } from "@/lib/db";
import { getStorageProvider } from "@/services/storage";
import { AssetSourceType } from "@prisma/client";

const ALLOWED_MIME_TYPES = [
  "audio/mpeg",      // mp3
  "audio/wav",       // wav
  "audio/x-wav",     // wav (alt)
  "audio/mp4",       // m4a
  "audio/x-m4a",     // m4a (alt)
  "audio/webm",      // webm
  "audio/ogg",       // ogg
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

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
}) {
  const storage = getStorageProvider();

  const { storagePath, sizeBytes } = await storage.saveFile(params.buffer, {
    workspaceId: params.workspaceId,
    conversationId: params.conversationId,
    originalName: params.originalName,
    mimeType: params.mimeType,
  });

  // Create asset and update conversation status in one transaction
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
      },
    }),
    db.conversation.update({
      where: { id: params.conversationId },
      data: { status: "UPLOADED" },
    }),
  ]);

  return asset;
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
      assets: { select: { id: true, sourceType: true, mimeType: true, sizeBytes: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
}
