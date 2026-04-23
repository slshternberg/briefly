import { RateLimiterMemory } from "rate-limiter-flexible";
import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

// Register: max 5 attempts per hour per IP
const registerLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60 * 60, // 1 hour
});

// Login: max 10 attempts per 15 minutes per IP
const loginLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60 * 15, // 15 minutes
});

// Process (Gemini analysis): max 20 per hour per user
const processLimiter = new RateLimiterMemory({
  points: 20,
  duration: 60 * 60,
});

// Chat: max 60 per hour per user
const chatLimiter = new RateLimiterMemory({
  points: 60,
  duration: 60 * 60,
});

// Upload: max 30 per hour per user
const uploadLimiter = new RateLimiterMemory({
  points: 30,
  duration: 60 * 60,
});

// Gmail send via our UI: max 20 per hour per user
const sendEmailLimiter = new RateLimiterMemory({
  points: 20,
  duration: 60 * 60,
});

// Style example upload: max 10 per hour per user (audio upload + quota)
const styleUploadLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60 * 60,
});

// Style example processing (Gemini audio analysis): max 15 per hour per user
const styleProcessLimiter = new RateLimiterMemory({
  points: 15,
  duration: 60 * 60,
});

// Style profile generation (Gemini call, workspace-scoped): max 6 per hour per user
const styleProfileLimiter = new RateLimiterMemory({
  points: 6,
  duration: 60 * 60,
});

// Password reset / email verify: max 3 per hour per IP
const passwordResetLimiter = new RateLimiterMemory({
  points: 3,
  duration: 60 * 60,
});

function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function rateLimit(
  req: NextRequest,
  type: "register" | "login" | "passwordReset"
): Promise<NextResponse | null> {
  const limiter =
    type === "register" ? registerLimiter :
    type === "passwordReset" ? passwordResetLimiter :
    loginLimiter;
  const ip = getIP(req);

  try {
    await limiter.consume(ip);
    return null; // allowed
  } catch {
    return NextResponse.json(
      { error: "Too many attempts. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": "900" },
      }
    );
  }
}

export type UserRateLimitType =
  | "process"
  | "chat"
  | "upload"
  | "sendEmail"
  | "styleUpload"
  | "styleProcess"
  | "styleProfile";

const USER_LIMITERS: Record<UserRateLimitType, RateLimiterMemory> = {
  process: processLimiter,
  chat: chatLimiter,
  upload: uploadLimiter,
  sendEmail: sendEmailLimiter,
  styleUpload: styleUploadLimiter,
  styleProcess: styleProcessLimiter,
  styleProfile: styleProfileLimiter,
};

export interface RateLimitAuditCtx {
  workspaceId: string;
  userId: string;
  action?: string;
}

export async function rateLimitUser(
  userId: string,
  type: UserRateLimitType,
  audit?: RateLimitAuditCtx
): Promise<NextResponse | null> {
  const limiter = USER_LIMITERS[type];

  try {
    await limiter.consume(userId);
    return null; // allowed
  } catch {
    if (audit) {
      logAudit({
        workspaceId: audit.workspaceId,
        userId: audit.userId,
        action: audit.action ?? `ratelimit.${type}`,
        metadata: { limiter: type },
      });
    }
    return NextResponse.json(
      { error: "TOO_MANY_REQUESTS" },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }
}
