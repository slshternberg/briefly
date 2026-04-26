/**
 * A.2 regression: every public write endpoint that previously did ad-hoc
 * type checks now rejects malformed payloads with a consistent 400 via Zod.
 * Tests the schemas directly — these are the single source of truth, and
 * each route delegates to them.
 */

import { describe, it, expect } from "vitest";
import {
  chatRequestSchema,
  processConversationSchema,
  renameConversationSchema,
  sendEmailSchema,
} from "@/lib/validations/conversation";
import {
  joinInvitationSchema,
  updateLanguageSchema,
  updateInstructionsSchema,
} from "@/lib/validations/workspace";

describe("chat request schema", () => {
  it("rejects missing question", () => {
    expect(chatRequestSchema.safeParse({}).success).toBe(false);
  });
  it("rejects non-string question", () => {
    expect(chatRequestSchema.safeParse({ question: 12 }).success).toBe(false);
  });
  it("rejects empty question after trim", () => {
    expect(chatRequestSchema.safeParse({ question: "   " }).success).toBe(false);
  });
  it("rejects questions over 2000 chars", () => {
    expect(chatRequestSchema.safeParse({ question: "a".repeat(2001) }).success).toBe(false);
  });
  it("rejects non-uuid threadId", () => {
    expect(
      chatRequestSchema.safeParse({ question: "hi", threadId: "not-a-uuid" }).success
    ).toBe(false);
  });
  it("accepts a valid uuid threadId", () => {
    expect(
      chatRequestSchema.safeParse({
        question: "hi",
        threadId: "00000000-0000-4000-8000-000000000000",
      }).success
    ).toBe(true);
  });
});

describe("process conversation schema", () => {
  it("accepts empty payload (all fields optional)", () => {
    expect(processConversationSchema.safeParse({}).success).toBe(true);
  });
  it("rejects unreasonably long outputLanguage", () => {
    expect(
      processConversationSchema.safeParse({ outputLanguage: "x".repeat(101) }).success
    ).toBe(false);
  });
  it("rejects conversationInstructions over 3000 chars", () => {
    expect(
      processConversationSchema.safeParse({ conversationInstructions: "x".repeat(3001) }).success
    ).toBe(false);
  });
  // sendNotification was removed from the schema — the toggle is now a
  // workspace-level setting (Workspace.notifyOnAnalysisDone). Extra fields
  // sent by old clients are ignored, not rejected.
});

describe("rename conversation schema", () => {
  it("rejects empty title", () => {
    expect(renameConversationSchema.safeParse({ title: "" }).success).toBe(false);
  });
  it("rejects titles over 200 chars", () => {
    expect(
      renameConversationSchema.safeParse({ title: "x".repeat(201) }).success
    ).toBe(false);
  });
  it("trims title whitespace", () => {
    const result = renameConversationSchema.safeParse({ title: "  hello  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.title).toBe("hello");
  });
});

describe("send email schema", () => {
  it("rejects invalid recipient email", () => {
    expect(
      sendEmailSchema.safeParse({ to: "not-an-email", subject: "s", body: "b" }).success
    ).toBe(false);
  });
  it("rejects missing subject", () => {
    expect(
      sendEmailSchema.safeParse({ to: "a@b.co", body: "b" }).success
    ).toBe(false);
  });
  it("rejects body over 50k chars", () => {
    expect(
      sendEmailSchema.safeParse({
        to: "a@b.co",
        subject: "s",
        body: "x".repeat(50_001),
      }).success
    ).toBe(false);
  });
});

describe("join invitation schema", () => {
  it("rejects empty token", () => {
    expect(joinInvitationSchema.safeParse({ token: "" }).success).toBe(false);
  });
  it("rejects non-string token", () => {
    expect(joinInvitationSchema.safeParse({ token: 123 }).success).toBe(false);
  });
});

describe("workspace language schema", () => {
  it("rejects unsupported language", () => {
    expect(updateLanguageSchema.safeParse({ language: "French" }).success).toBe(false);
  });
  it("accepts Hebrew / English / Yiddish", () => {
    for (const lang of ["Hebrew", "English", "Yiddish"]) {
      expect(updateLanguageSchema.safeParse({ language: lang }).success).toBe(true);
    }
  });
});

describe("workspace instructions schema", () => {
  it("rejects instructions over 5000 chars", () => {
    expect(
      updateInstructionsSchema.safeParse({ instructions: "x".repeat(5001) }).success
    ).toBe(false);
  });
  it("accepts empty payload (instructions optional)", () => {
    const result = updateInstructionsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.instructions).toBe("");
  });
});
