import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 chars"),
  AUTH_URL: z.string().url(),
  GEMINI_API_KEY: z.string().min(1),
  ENCRYPTION_KEY: z.string().regex(
    /^[0-9a-fA-F]{64}$/,
    "ENCRYPTION_KEY must be 64 hex characters (32 bytes)"
  ),
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

/**
 * Classify a Zod issue as "the variable was not set" vs "the variable was
 * set but malformed". Used to decide whether to fail the build.
 *
 * Before SR-8 we masked ALL issues during `next build` so CI without a
 * full .env could still compile. That also hid *format* problems — a
 * typo'd AUTH_SECRET or a hand-edited ENCRYPTION_KEY that isn't hex went
 * undetected until the process hit its first request in production.
 *
 * Now we mask ONLY missing values during build; any malformed value
 * (too short, wrong regex, wrong enum, not a URL, not an email) still
 * breaks the build so the bad string never reaches production.
 *
 * We classify by looking up the original value at the failing path in
 * process.env — if it's undefined the variable truly isn't set; anything
 * else (even the empty string) is malformed and should fail the build.
 */
function isMissingValueIssue(
  issue: { code: string; path: PropertyKey[] },
  source: Record<string, string | undefined>
): boolean {
  if (issue.code !== "invalid_type") return false;
  const topKey = issue.path[0];
  if (typeof topKey !== "string") return false;
  return source[topKey] === undefined;
}

if (!parsed.success) {
  const issues = parsed.error.issues;
  console.error(
    "Missing/invalid environment variables:",
    parsed.error.flatten().fieldErrors
  );

  const isBuild = process.env.NEXT_PHASE === "phase-production-build";
  const onlyMissing = issues.every((i) =>
    isMissingValueIssue(i, process.env as Record<string, string | undefined>)
  );

  // Runtime: always throw (same behaviour as before).
  // Build + a formatting error: throw, so the bad string fails the pipeline.
  // Build + only-missing: let it through so CI without a full .env compiles.
  if (!isBuild || !onlyMissing) {
    throw new Error("Invalid environment variables. Check server logs.");
  }
}

export const env = (parsed.data ?? process.env) as z.infer<typeof envSchema>;
