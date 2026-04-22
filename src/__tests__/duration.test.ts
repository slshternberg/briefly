import { describe, it, expect, vi, beforeEach } from "vitest";

// ── mock music-metadata ───────────────────────────────────────────────────────
const { mockParseBuffer, mockParseFile } = vi.hoisted(() => ({
  mockParseBuffer: vi.fn(),
  mockParseFile: vi.fn(),
}));

vi.mock("music-metadata", () => ({
  parseBuffer: mockParseBuffer,
  parseFile: mockParseFile,
}));

import { extractDurationSeconds } from "@/lib/duration";

// ── helpers ───────────────────────────────────────────────────────────────────
function metaWith(duration: number | undefined) {
  return { format: { duration } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockParseBuffer.mockResolvedValue(metaWith(30));
  mockParseFile.mockResolvedValue(metaWith(30));
});

// ── buffer input ──────────────────────────────────────────────────────────────
describe("extractDurationSeconds — buffer input", () => {
  it("returns rounded seconds for a valid audio buffer", async () => {
    mockParseBuffer.mockResolvedValue(metaWith(30.7));
    const result = await extractDurationSeconds({ buffer: Buffer.from("data"), mimeType: "audio/mpeg" });
    expect(result).toBe(31);
  });

  it("returns 1 for sub-second audio (legitimate short recording)", async () => {
    mockParseBuffer.mockResolvedValue(metaWith(0.4));
    const result = await extractDurationSeconds({ buffer: Buffer.from("data"), mimeType: "audio/mpeg" });
    expect(result).toBe(1);
  });

  it("returns null when duration is exactly 0 (corrupted header)", async () => {
    mockParseBuffer.mockResolvedValue(metaWith(0));
    const result = await extractDurationSeconds({ buffer: Buffer.from("data"), mimeType: "audio/mpeg" });
    expect(result).toBeNull();
  });

  it("returns null when duration is undefined (format not recognised)", async () => {
    mockParseBuffer.mockResolvedValue(metaWith(undefined));
    const result = await extractDurationSeconds({ buffer: Buffer.from("data"), mimeType: "audio/mpeg" });
    expect(result).toBeNull();
  });

  it("returns null when duration is Infinity (regression: do not pass garbage to billing)", async () => {
    mockParseBuffer.mockResolvedValue(metaWith(Infinity));
    const result = await extractDurationSeconds({ buffer: Buffer.from("data"), mimeType: "audio/mpeg" });
    expect(result).toBeNull();
  });

  it("returns null and does not throw when parseBuffer throws (corrupted file)", async () => {
    mockParseBuffer.mockRejectedValue(new Error("Invalid data"));
    await expect(
      extractDurationSeconds({ buffer: Buffer.from("junk"), mimeType: "audio/mpeg" })
    ).resolves.toBeNull();
  });

  it("returns null and does not throw when extraction times out", async () => {
    mockParseBuffer.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(metaWith(30)), 200))
    );
    const result = await extractDurationSeconds(
      { buffer: Buffer.from("data"), mimeType: "audio/mpeg" },
      50 // 50ms timeout — faster than the 200ms mock
    );
    expect(result).toBeNull();
  });

  it("clears the timeout handle when parse resolves first (regression: timer leak)", async () => {
    const clearSpy = vi.spyOn(global, "clearTimeout");
    mockParseBuffer.mockResolvedValue(metaWith(30));
    await extractDurationSeconds({ buffer: Buffer.from("data"), mimeType: "audio/mpeg" });
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});

// ── filePath input ────────────────────────────────────────────────────────────
describe("extractDurationSeconds — filePath input", () => {
  it("calls parseFile, not parseBuffer, when filePath is provided", async () => {
    mockParseFile.mockResolvedValue(metaWith(60));
    const result = await extractDurationSeconds({ filePath: "/audio/meeting.mp3" });
    expect(result).toBe(60);
    expect(mockParseFile).toHaveBeenCalledWith("/audio/meeting.mp3");
    expect(mockParseBuffer).not.toHaveBeenCalled();
  });

  it("returns null and does not throw when parseFile throws", async () => {
    mockParseFile.mockRejectedValue(new Error("File not found"));
    await expect(
      extractDurationSeconds({ filePath: "/missing/file.mp3" })
    ).resolves.toBeNull();
  });
});

// ── edge cases ────────────────────────────────────────────────────────────────
describe("extractDurationSeconds — edge cases", () => {
  it("returns duration without clamping for files > 24 hours (only warns)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockParseBuffer.mockResolvedValue(metaWith(90001)); // 25h+
    const result = await extractDurationSeconds({ buffer: Buffer.from("data"), mimeType: "audio/mpeg" });
    expect(result).toBe(90001);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Unusually long audio"));
    warnSpy.mockRestore();
  });
});
