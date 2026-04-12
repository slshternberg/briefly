import { z } from "zod";

export const createConversationSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title must be at most 200 characters")
    .trim(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
