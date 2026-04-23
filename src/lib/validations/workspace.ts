import { z } from "zod";

export const SUPPORTED_WORKSPACE_LANGUAGES = ["Hebrew", "English", "Yiddish"] as const;

export const joinInvitationSchema = z.object({
  token: z.string().min(1, "Token is required").max(512),
});

export const updateLanguageSchema = z.object({
  language: z.enum(SUPPORTED_WORKSPACE_LANGUAGES),
});

export const updateInstructionsSchema = z.object({
  instructions: z.string().max(5000).optional().default(""),
});

export type JoinInvitationInput = z.infer<typeof joinInvitationSchema>;
export type UpdateLanguageInput = z.infer<typeof updateLanguageSchema>;
export type UpdateInstructionsInput = z.infer<typeof updateInstructionsSchema>;
