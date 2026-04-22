/**
 * Regression: uploadAudioAsset used to leave orphan files on disk/S3 when
 * the DB transaction failed after `storage.saveFile` succeeded.
 *
 * Verifies:
 *  - Happy path: 3-op transaction (asset + conversation + storage usage) runs.
 *  - DB failure → `storage.deleteFile` compensation.
 *  - Both DB + deleteFile failure → `logOrphanFile` records for manual cleanup.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── hoisted mocks ────────────────────────────────────────────────────────────
const { mockSaveFile, mockDeleteFile, mockLogOrphanFile } = vi.hoisted(() => ({
  mockSaveFile: vi.fn(),
  mockDeleteFile: vi.fn(),
  mockLogOrphanFile: vi.fn(),
}));

vi.mock("@/services/storage", () => ({
  getStorageProvider: () => ({
    saveFile: mockSaveFile,
    deleteFile: mockDeleteFile,
  }),
}));

vi.mock("@/lib/orphan-files", () => ({
  logOrphanFile: mockLogOrphanFile,
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn(),
    conversationAsset: { create: vi.fn().mockReturnValue("CREATE_ASSET") },
    conversation: { update: vi.fn().mockReturnValue("UPDATE_CONVERSATION") },
    usageRecord: { upsert: vi.fn().mockReturnValue("UPSERT_USAGE") },
  },
}));

import { db } from "@/lib/db";
import { uploadAudioAsset } from "@/services/conversation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDb = db as any;

const baseParams = {
  workspaceId: "ws-1",
  conversationId: "conv-1",
  sourceType: "UPLOADED" as const,
  originalName: "meeting.mp3",
  mimeType: "audio/mpeg",
  buffer: Buffer.from("fake-audio"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSaveFile.mockResolvedValue({
    storagePath: "ws-1/conv-1/1234-meeting.mp3",
    sizeBytes: 12345,
  });
  mockDb.conversationAsset.create.mockReturnValue("CREATE_ASSET");
  mockDb.conversation.update.mockReturnValue("UPDATE_CONVERSATION");
  mockDb.usageRecord.upsert.mockReturnValue("UPSERT_USAGE");
});

// ── happy path ───────────────────────────────────────────────────────────────
describe("uploadAudioAsset — happy path", () => {
  it("runs a 3-op transaction (asset create + conversation update + storage increment)", async () => {
    mockDb.$transaction.mockResolvedValue([
      { id: "asset-1" },
      {},
      {},
    ]);

    const result = await uploadAudioAsset({ ...baseParams, durationSeconds: 60 });

    expect(mockSaveFile).toHaveBeenCalledTimes(1);
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
    const txArray = mockDb.$transaction.mock.calls[0][0];
    expect(txArray).toHaveLength(3);
    expect(result.id).toBe("asset-1");
    expect(mockDeleteFile).not.toHaveBeenCalled();
    expect(mockLogOrphanFile).not.toHaveBeenCalled();
  });

  it("passes sizeBytes through to the storage increment query", async () => {
    mockDb.$transaction.mockResolvedValue([{ id: "asset-1" }, {}, {}]);

    await uploadAudioAsset({ ...baseParams });

    expect(mockDb.usageRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ storageBytesUsed: 12345 }),
        update: expect.objectContaining({ storageBytesUsed: { increment: 12345 } }),
      })
    );
  });
});

// ── compensation ─────────────────────────────────────────────────────────────
describe("uploadAudioAsset — DB transaction failure compensation", () => {
  it("deletes the uploaded file when the DB transaction fails", async () => {
    const dbErr = new Error("DB connection lost");
    mockDb.$transaction.mockRejectedValue(dbErr);
    mockDeleteFile.mockResolvedValue(undefined);

    await expect(uploadAudioAsset(baseParams)).rejects.toThrow("DB connection lost");

    expect(mockDeleteFile).toHaveBeenCalledWith("ws-1/conv-1/1234-meeting.mp3");
    expect(mockLogOrphanFile).not.toHaveBeenCalled();
  });

  it("rethrows the original DB error, not the compensation result", async () => {
    const dbErr = new Error("Unique constraint violation");
    mockDb.$transaction.mockRejectedValue(dbErr);
    mockDeleteFile.mockResolvedValue(undefined);

    await expect(uploadAudioAsset(baseParams)).rejects.toThrow(dbErr);
  });
});

// ── double failure: orphan log ───────────────────────────────────────────────
describe("uploadAudioAsset — double failure records an orphan", () => {
  it("logs the orphan file when deleteFile compensation itself fails", async () => {
    const dbErr = new Error("DB connection lost");
    const delErr = new Error("S3 timeout");
    mockDb.$transaction.mockRejectedValue(dbErr);
    mockDeleteFile.mockRejectedValue(delErr);

    await expect(uploadAudioAsset(baseParams)).rejects.toThrow("DB connection lost");

    expect(mockLogOrphanFile).toHaveBeenCalledWith({
      storagePath: "ws-1/conv-1/1234-meeting.mp3",
      workspaceId: "ws-1",
      reason: "db-tx-failed",
      error: delErr,
    });
  });
});

// ── BigInt safety ────────────────────────────────────────────────────────────
describe("uploadAudioAsset — sizeBytes safety check", () => {
  it("throws loudly if storage returns an unsafe sizeBytes (regression: silent billing bugs)", async () => {
    mockSaveFile.mockResolvedValue({
      storagePath: "ws-1/conv-1/huge",
      sizeBytes: Number.MAX_SAFE_INTEGER + 1,
    });

    await expect(uploadAudioAsset(baseParams)).rejects.toThrow(/unsafe sizeBytes/);
    // File not DB'd → should NOT call transaction or compensation
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });
});
