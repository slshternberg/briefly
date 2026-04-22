import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 chars"),
  AUTH_URL: z.string().url(),
  GEMINI_API_KEY: z.string().min(1),
  ENCRYPTION_KEY: z.string().length(64, "ENCRYPTION_KEY must be 32 bytes hex"),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.string().default("587"),
  SMTP_SECURE: z.string().default("false"),
  SMTP_USER: z.string().email(),
  SMTP_PASS: z.string().min(1),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  STORAGE_TYPE: z.enum(["local", "s3"]).default("local"),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Missing/invalid environment variables:", parsed.error.flatten().fieldErrors);
  // During `next build` the server modules are loaded without runtime env vars.
  // Throw only at runtime so the build succeeds in CI / dev without a full .env.
  if (process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("Invalid environment variables. Check server logs.");
  }
}

export const env = (parsed.data ?? process.env) as z.infer<typeof envSchema>;
