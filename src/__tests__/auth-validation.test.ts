import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "@/lib/validations/auth";

describe("registerSchema", () => {
  it("accepts valid input", () => {
    const result = registerSchema.safeParse({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "securepass123",
    });
    expect(result.success).toBe(true);
  });

  it("normalizes email to lowercase", () => {
    const result = registerSchema.safeParse({
      name: "Jane",
      email: "JANE@EXAMPLE.COM",
      password: "securepass123",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("jane@example.com");
  });

  it("rejects short name", () => {
    const result = registerSchema.safeParse({ name: "J", email: "j@x.com", password: "pass1234" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = registerSchema.safeParse({ name: "Jane", email: "not-an-email", password: "pass1234" });
    expect(result.success).toBe(false);
  });

  it("rejects short password", () => {
    const result = registerSchema.safeParse({ name: "Jane", email: "j@x.com", password: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects password over 128 chars", () => {
    const result = registerSchema.safeParse({
      name: "Jane",
      email: "j@x.com",
      password: "a".repeat(129),
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "anypass" });
    expect(result.success).toBe(true);
  });

  it("rejects missing password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "" });
    expect(result.success).toBe(false);
  });

  it("normalizes email to lowercase", () => {
    const result = loginSchema.safeParse({ email: "USER@EXAMPLE.COM", password: "pass" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("user@example.com");
  });
});
