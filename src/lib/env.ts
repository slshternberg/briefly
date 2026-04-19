import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 chars"),
  AUTH_URL: z.string().url().optional(),
  GEMINI_API_KEY: z.string().min(1),
  ENCRYPTION_KEY: z.string().length(64, "ENCRYPTION_KEY must be 32 bytes hex"),
  SMTP_USER: z.string().email(),
  SMTP_PASS: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  STORAGE_TYPE: z.enum(["local", "s3"]).default("local"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Missing/invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables. Check server logs.");
}

export const env = parsed.data;
