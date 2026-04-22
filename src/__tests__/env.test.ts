import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

/**
 * env.ts runs Zod validation at module load and throws on failure.
 * These tests use dynamic import() so each import re-runs validation against
 * a freshly-stubbed process.env.
 */

const VALID_ENV = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  AUTH_SECRET: "a".repeat(32),
  AUTH_URL: "https://briefly.example.com",
  GEMINI_API_KEY: "test-gemini-key",
  ENCRYPTION_KEY: "a".repeat(64),
  SMTP_HOST: "smtp.example.com",
  SMTP_USER: "sender@example.com",
  SMTP_PASS: "app-password",
};

const SAVED = { ...process.env };

function applyEnv(partial: Record<string, string | undefined>) {
  // Start from a clean slate for the keys we care about, then apply partial
  for (const k of Object.keys(VALID_ENV)) delete process.env[k];
  for (const [k, v] of Object.entries(partial)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  // env.ts only throws when NEXT_PHASE !== "phase-production-build"
  delete process.env.NEXT_PHASE;
}

beforeEach(() => {
  vi.resetModules();
});

afterAll(() => {
  process.env = SAVED;
});

describe("env validation", () => {
  it("throws when AUTH_URL is missing", async () => {
    applyEnv({ ...VALID_ENV, AUTH_URL: undefined });
    await expect(import("@/lib/env")).rejects.toThrow(/Invalid environment/);
  });

  it("throws when AUTH_URL is not a valid URL", async () => {
    applyEnv({ ...VALID_ENV, AUTH_URL: "not-a-url" });
    await expect(import("@/lib/env")).rejects.toThrow(/Invalid environment/);
  });

  it("throws when SMTP_HOST is missing (regression: was hardcoded in email service)", async () => {
    applyEnv({ ...VALID_ENV, SMTP_HOST: undefined });
    await expect(import("@/lib/env")).rejects.toThrow(/Invalid environment/);
  });

  it("throws when ENCRYPTION_KEY is wrong length", async () => {
    applyEnv({ ...VALID_ENV, ENCRYPTION_KEY: "too-short" });
    await expect(import("@/lib/env")).rejects.toThrow(/Invalid environment/);
  });

  it("passes with all required vars set", async () => {
    applyEnv(VALID_ENV);
    const mod = await import("@/lib/env");
    expect(mod.env.AUTH_URL).toBe("https://briefly.example.com");
    expect(mod.env.SMTP_HOST).toBe("smtp.example.com");
  });

  it("defaults SMTP_PORT to 587 and SMTP_SECURE to 'false' when not set", async () => {
    applyEnv(VALID_ENV);
    const mod = await import("@/lib/env");
    expect(mod.env.SMTP_PORT).toBe("587");
    expect(mod.env.SMTP_SECURE).toBe("false");
  });

  it("allows overriding SMTP_PORT and SMTP_SECURE", async () => {
    applyEnv({ ...VALID_ENV, SMTP_PORT: "465", SMTP_SECURE: "true" });
    const mod = await import("@/lib/env");
    expect(mod.env.SMTP_PORT).toBe("465");
    expect(mod.env.SMTP_SECURE).toBe("true");
  });
});
