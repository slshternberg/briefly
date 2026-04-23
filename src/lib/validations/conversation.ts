import { z } from "zod";

export const createConversationSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be at most 200 characters")
    .trim(),
});

export const renameConversationSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be at most 200 characters")
    .trim(),
});

// outputLanguage is embedded into Gemini prompts; limit length to avoid
// prompt bloat. Accepts free-form language names (Hebrew, English, عربي, ...).
const outputLanguageSchema = z.string().min(1).max(100);

export const chatRequestSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Question is required")
    .max(2000, "Question too long (max 2000 characters)"),
  outputLanguage: outputLanguageSchema.optional(),
  threadId: z.string().uuid("Invalid thread id").optional(),
});

export const processConversationSchema = z.object({
  outputLanguage: outputLanguageSchema.optional(),
  conversationInstructions: z
    .string()
    .max(3000, "Instructions too long (max 3000 characters)")
    .optional(),
  sendNotification: z.boolean().optional(),
});

export const sendEmailSchema = z.object({
  to: z.string().email("Invalid recipient email").max(320),
  subject: z.string().min(1, "Subject required").max(300),
  body: z.string().min(1, "Body required").max(50_000),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type RenameConversationInput = z.infer<typeof renameConversationSchema>;
export type ChatRequestInput = z.infer<typeof chatRequestSchema>;
export type ProcessConversationInput = z.infer<typeof processConversationSchema>;
export type SendEmailInput = z.infer<typeof sendEmailSchema>;
