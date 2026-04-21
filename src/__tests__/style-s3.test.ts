/**
 * Regression: processStyleExample used to call storage.getFilePath() unconditionally,
 * which throws on S3 storage. Verifies the isLocal guard is in place.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

// ── env ───────────────────────────────────────────────────────────────────────
beforeAll(() => {
  process.env.GEMINI_API_KEY = "test-key";
});

// ── hoisted mocks (must be before vi.mock calls) ─────────────────────────────
const { mockGetFilePath, mockGetFileBuffer, mockFilesUpload } = vi.hoisted(() => ({
  mockGetFilePath: vi.fn().mockReturnValue("/local/audio.mp3"),
  mockGetFileBuffer: vi.fn().mockResolvedValue(Buffer.from("fake-audio")),
  mockFilesUpload: vi.fn().mockResolvedValue({
    name: "files/test-123",
    state: "ACTIVE",
    uri: "https://generativelanguage.googleapis.com/v1/files/test-123",
  }),
}));

// ── module mocks ──────────────────────────────────────────────────────────────
vi.mock("@/services/storage", () => ({
  getStorageProvider: () => ({
    getFilePath: mockGetFilePath,
    getFileBuffer: mockGetFileBuffer,
  }),
}));

vi.mock("@/lib/db", () => ({
  db: {
    styleExample: {
      findFirst: vi.fn().mockResolvedValue({
        id: "ex-1",
        workspaceId: "ws-1",
        audioStoragePath: "ws-1/conv-1/audio.mp3",
        audioMimeType: "audio/mpeg",
        sentEmailSubject: "Follow-up",
        sentEmailBody: "Thanks for the meeting.",
      }),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    files: {
      upload: mockFilesUpload,
      get: vi.fn().mockResolvedValue({
        name: "files/test-123",
        state: "ACTIVE",
        uri: "https://generativelanguage.googleapis.com/v1/files/test-123",
      }),
      delete: vi.fn().mockResolvedValue({}),
    },
    models: {
      generateContent: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          emailTone: "warm_professional",
          emailStructure: "paragraphs",
          emailLength: "medium",
          emailFormality: "medium",
          emailDirectness: "balanced",
          openingStyle: "direct_recap",
          closingStyle: "warm_professional",
          keyPhrases: ["thanks for your time"],
          meetingFocusAreas: ["next steps"],
          summaryStyle: "concise",
          signatureStyle: "best regards",
        }),
      }),
    },
  })),
}));

import { processStyleExample } from "@/services/style";

// ── helpers ───────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  // Re-apply default implementations after clearAllMocks resets them
  mockGetFilePath.mockReturnValue("/local/audio.mp3");
  mockGetFileBuffer.mockResolvedValue(Buffer.from("fake-audio"));
  mockFilesUpload.mockResolvedValue({
    name: "files/test-123",
    state: "ACTIVE",
    uri: "https://generativelanguage.googleapis.com/v1/files/test-123",
  });
});

afterEach(() => {
  delete process.env.STORAGE_TYPE;
});

// ── tests ─────────────────────────────────────────────────────────────────────
describe("processStyleExample — storage path selection", () => {
  it("local mode: uses getFilePath, uploads a string path to Gemini", async () => {
    // STORAGE_TYPE unset → local mode
    delete process.env.STORAGE_TYPE;

    await processStyleExample("ex-1", "ws-1");

    expect(mockGetFilePath).toHaveBeenCalledWith("ws-1/conv-1/audio.mp3");
    expect(mockGetFileBuffer).not.toHaveBeenCalled();

    const uploadArg = mockFilesUpload.mock.calls[0][0].file;
    expect(typeof uploadArg).toBe("string");
  });

  it("S3 mode: uses getFileBuffer, uploads a Blob to Gemini — regression for missing isLocal guard", async () => {
    process.env.STORAGE_TYPE = "s3";

    await processStyleExample("ex-1", "ws-1");

    expect(mockGetFileBuffer).toHaveBeenCalledWith("ws-1/conv-1/audio.mp3");
    expect(mockGetFilePath).not.toHaveBeenCalled();

    const uploadArg = mockFilesUpload.mock.calls[0][0].file;
    expect(uploadArg).toBeInstanceOf(Blob);
  });

  it("S3 Blob contains the buffer bytes returned by getFileBuffer", async () => {
    process.env.STORAGE_TYPE = "s3";
    const audioData = Buffer.from("real-audio-bytes");
    mockGetFileBuffer.mockResolvedValue(audioData);

    await processStyleExample("ex-1", "ws-1");

    const blob: Blob = mockFilesUpload.mock.calls[0][0].file;
    const blobBytes = Buffer.from(await blob.arrayBuffer());
    expect(blobBytes.equals(audioData)).toBe(true);
  });
});
