import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Missing required environment variables:",
    parsed.error.flatten().fieldErrors
  );
  throw new Error("Missing required environment variables. Check server logs.");
}

export const env = parsed.data;
