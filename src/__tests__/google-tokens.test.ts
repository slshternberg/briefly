import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

// Set ENCRYPTION_KEY before any module is imported
beforeAll(() => {
  process.env.ENCRYPTION_KEY = "a".repeat(64); // 32 bytes hex — valid for AES-256-GCM
});

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import {
  getDecryptedGoogleTokens,
  setEncryptedGoogleTokens,
  refreshEncryptedAccessToken,
} from "@/services/google/tokens";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDb = db as any;

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Crypto layer ──────────────────────────────────────────────────────────────

describe("encrypt / decrypt round-trip", () => {
  it("recovers the original plaintext", () => {
    const token = "ya29.supersecretaccesstoken";
    expect(decrypt(encrypt(token))).toBe(token);
  });

  it("produces different ciphertext each call (random IV)", () => {
    const token = "ya29.token";
    expect(encrypt(token)).not.toBe(encrypt(token));
  });

  it("stored ciphertext is not equal to plaintext (regression: tokens were stored raw)", () => {
    const token = "ya29.plaintext_was_stored_like_this";
    const ciphertext = encrypt(token);
    expect(ciphertext).not.toBe(token);
    expect(ciphertext).not.toContain(token);
  });
});

// ── getDecryptedGoogleTokens ──────────────────────────────────────────────────

describe("getDecryptedGoogleTokens", () => {
  it("returns null when user not found", async () => {
    mockDb.user.findUnique.mockResolvedValue(null);
    expect(await getDecryptedGoogleTokens("u1")).toBeNull();
  });

  it("returns null when neither encrypted nor plaintext token exists (Gmail not connected)", async () => {
    mockDb.user.findUnique.mockResolvedValue({
      googleAccessTokenEncrypted: null,
      googleRefreshTokenEncrypted: null,
      googleAccessToken: null,
      googleRefreshToken: null,
      googleEmail: null,
    });
    expect(await getDecryptedGoogleTokens("u1")).toBeNull();
  });

  it("reads and decrypts from encrypted columns when present", async () => {
    const access = "ya29.access_token";
    const refresh = "1//refresh_token";
    mockDb.user.findUnique.mockResolvedValue({
      googleAccessTokenEncrypted: encrypt(access),
      googleRefreshTokenEncrypted: encrypt(refresh),
      googleAccessToken: "old_plaintext_access", // present but should be ignored
      googleRefreshToken: "old_plaintext_refresh",
      googleEmail: "user@gmail.com",
    });

    const tokens = await getDecryptedGoogleTokens("u1");
    expect(tokens).not.toBeNull();
    expect(tokens!.access).toBe(access);
    expect(tokens!.refresh).toBe(refresh);
    expect(tokens!.email).toBe("user@gmail.com");
  });

  it("falls back to plaintext columns when encrypted column is null (pre-backfill user)", async () => {
    const access = "ya29.old_access";
    const refresh = "1//old_refresh";
    mockDb.user.findUnique.mockResolvedValue({
      googleAccessTokenEncrypted: null,
      googleRefreshTokenEncrypted: null,
      googleAccessToken: access,
      googleRefreshToken: refresh,
      googleEmail: "legacy@gmail.com",
    });

    const tokens = await getDecryptedGoogleTokens("u1");
    expect(tokens).not.toBeNull();
    expect(tokens!.access).toBe(access);
    expect(tokens!.refresh).toBe(refresh);
    expect(tokens!.email).toBe("legacy@gmail.com");
  });

  it("handles missing refresh token gracefully", async () => {
    const access = "ya29.access_only";
    mockDb.user.findUnique.mockResolvedValue({
      googleAccessTokenEncrypted: encrypt(access),
      googleRefreshTokenEncrypted: null,
      googleAccessToken: null,
      googleRefreshToken: null,
      googleEmail: null,
    });

    const tokens = await getDecryptedGoogleTokens("u1");
    expect(tokens).not.toBeNull();
    expect(tokens!.access).toBe(access);
    expect(tokens!.refresh).toBeNull();
  });
});

// ── setEncryptedGoogleTokens ──────────────────────────────────────────────────

describe("setEncryptedGoogleTokens", () => {
  it("writes encrypted values to the encrypted columns (not plaintext)", async () => {
    mockDb.user.update.mockResolvedValue({});
    const access = "ya29.new_token";
    const refresh = "1//new_refresh";

    await setEncryptedGoogleTokens("u1", { access, refresh, email: "u@gmail.com" });

    const { data } = mockDb.user.update.mock.calls[0][0];
    // Encrypted columns must not equal the plaintext
    expect(data.googleAccessTokenEncrypted).not.toBe(access);
    expect(data.googleRefreshTokenEncrypted).not.toBe(refresh);
    // But decrypting them must recover the originals
    expect(decrypt(data.googleAccessTokenEncrypted)).toBe(access);
    expect(decrypt(data.googleRefreshTokenEncrypted)).toBe(refresh);
  });

  it("dual-writes to plaintext columns for rollback safety", async () => {
    mockDb.user.update.mockResolvedValue({});
    await setEncryptedGoogleTokens("u1", { access: "tok", refresh: "ref" });

    const { data } = mockDb.user.update.mock.calls[0][0];
    expect(data.googleAccessToken).toBe("tok");
    expect(data.googleRefreshToken).toBe("ref");
  });
});

// ── refreshEncryptedAccessToken ───────────────────────────────────────────────

describe("refreshEncryptedAccessToken", () => {
  it("writes new encrypted access token and also updates plaintext column", async () => {
    mockDb.user.update.mockResolvedValue({});
    const newToken = "ya29.refreshed";

    await refreshEncryptedAccessToken("u1", newToken);

    const { data } = mockDb.user.update.mock.calls[0][0];
    expect(decrypt(data.googleAccessTokenEncrypted)).toBe(newToken);
    expect(data.googleAccessToken).toBe(newToken); // dual-write
  });
});
