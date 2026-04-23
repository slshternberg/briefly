/**
 * SR-3 regression: POST /api/workspace/style-examples (upload) previously:
 *   1. saved the file to storage,
 *   2. created the DB row,
 *   3. never incremented `storageBytesUsed`, never checked the limit,
 *   4. never cleaned up the file if the DB create failed.
 *
 * Paired with DELETE (which DOES decrement), this silently drove the
 * counter toward zero on every upload/delete cycle.
 *
 * Now:
 *   - checkStorageLimit runs before saveFile (402 on quota overflow);
 *   - saveFile + styleExample.create + storageIncrementQuery are atomic;
 *   - tx failure compensates with deleteFile; delete failure logs orphan.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAuth,
  mockMemberFindUnique,
  mockCheckStorageLimit,
  mockSaveFile,
  mockDeleteFile,
  mockTransaction,
  mockStorageIncrementQuery,
  mockLogOrphan,
  mockRateLimit,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockMemberFindUnique: vi.fn(),
  mockCheckStorageLimit: vi.fn(),
  mockSaveFile: vi.fn(),
  mockDeleteFile: vi.fn().mockResolvedValue(undefined),
  mockTransaction: vi.fn(),
  mockStorageIncrementQuery: vi.fn().mockReturnValue({ __type: "incrementQuery" }),
  mockLogOrphan: vi.fn().mockResolvedValue(undefined),
  mockRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/auth", () => ({ auth: mockAuth }));
vi.mock("@/lib/db", () => ({
  db: {
    workspaceMember: { findUnique: mockMemberFindUnique },
    styleExample: {
      create: vi.fn().mockReturnValue({ __type: "createQuery" }),
    },
    $transaction: mockTransaction,
  },
}));
vi.mock("@/lib/billing", () => ({
  checkStorageLimit: mockCheckStorageLimit,
  storageIncrementQuery: mockStorageIncrementQuery,
}));
vi.mock("@/lib/orphan-files", () => ({ logOrphanFile: mockLogOrphan }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitUser: mockRateLimit }));
vi.mock("@/services/storage", () => ({
  getStorageProvider: () => ({ saveFile: mockSaveFile, deleteFile: mockDeleteFile }),
}));

import { POST } from "@/app/api/workspace/style-examples/route";

function makeRequest(fileBytes = 1000) {
  const fd = new FormData();
  const file = new File([new Uint8Array(fileBytes)], "recording.mp3", { type: "audio/mpeg" });
  fd.append("file", file);
  fd.append("title", "Sales call");
  fd.append("sentEmailSubject", "Thanks");
  fd.append("sentEmailBody", "Body text");
  return new Request("http://local/api/workspace/style-examples", {
    method: "POST",
    body: fd,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({
    user: { id: "user-1", activeWorkspaceId: "ws-1" },
  });
  mockMemberFindUnique.mockResolvedValue({ role: "OWNER" });
  mockCheckStorageLimit.mockResolvedValue(null);
  mockSaveFile.mockResolvedValue({
    storagePath: "ws-1/style-examples/recording.mp3",
    sizeBytes: 1000,
  });
  mockTransaction.mockResolvedValue([
    { id: "ex-1", title: "Sales call", status: "PENDING" },
    undefined,
  ]);
});

describe("SR-3: style example upload accounting", () => {
  it("rejects with 402 when the workspace is over quota — no saveFile call", async () => {
    mockCheckStorageLimit.mockResolvedValue(
      "Storage limit reached (500MB). Upgrade to continue."
    );

    const res = await POST(makeRequest());
    expect(res.status).toBe(402);
    expect(mockSaveFile).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("on happy path: checkStorageLimit → saveFile → transaction (create + increment)", async () => {
    const res = await POST(makeRequest(1234));
    expect(res.status).toBe(201);

    expect(mockCheckStorageLimit).toHaveBeenCalledWith("ws-1", 1234);
    expect(mockSaveFile).toHaveBeenCalledTimes(1);
    expect(mockStorageIncrementQuery).toHaveBeenCalledWith("ws-1", 1000);

    const txArg = mockTransaction.mock.calls[0][0];
    expect(Array.isArray(txArg)).toBe(true);
    expect(txArg).toHaveLength(2); // create + incrementQuery
    expect(mockDeleteFile).not.toHaveBeenCalled();
  });

  it("compensates by deleting the saved file when the DB transaction fails", async () => {
    mockTransaction.mockRejectedValueOnce(new Error("tx boom"));

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);

    // The uploaded file was cleaned up.
    expect(mockDeleteFile).toHaveBeenCalledWith(
      "ws-1/style-examples/recording.mp3"
    );
    expect(mockLogOrphan).not.toHaveBeenCalled();
  });

  it("logs the file as orphan when both the tx AND the compensating delete fail", async () => {
    mockTransaction.mockRejectedValueOnce(new Error("tx boom"));
    mockDeleteFile.mockRejectedValueOnce(new Error("s3 unreachable"));

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);

    expect(mockLogOrphan).toHaveBeenCalledWith(
      expect.objectContaining({
        storagePath: "ws-1/style-examples/recording.mp3",
        workspaceId: "ws-1",
        reason: "style-example-db-tx-failed",
      })
    );
  });

  it("deletes the file and returns 500 if storage returns a non-safe-integer sizeBytes", async () => {
    mockSaveFile.mockResolvedValue({
      storagePath: "ws-1/style-examples/recording.mp3",
      sizeBytes: Number.MAX_SAFE_INTEGER + 1,
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(500);
    expect(mockDeleteFile).toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
