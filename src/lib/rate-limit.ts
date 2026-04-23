import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { createLimiter } from "@/lib/rate-limiter-store";

// All limiters share the same memory-backed store — see rate-limiter-store.ts
// for the explicit production limitation and the swap-to-Redis upgrade path.
const registerLimiter = createLimiter({
  points: 5, durationSec: 60 * 60, label: "auth/register",
});
const loginLimiter = createLimiter({
  points: 10, durationSec: 60 * 15, label: "auth/login",
});
const passwordResetLimiter = createLimiter({
  points: 3, durationSec: 60 * 60, label: "auth/password-reset",
});

const processLimiter = createLimiter({
  points: 20, durationSec: 60 * 60, label: "conversation/process",
});
const chatLimiter = createLimiter({
  points: 60, durationSec: 60 * 60, label: "conversation/chat",
});
const uploadLimiter = createLimiter({
  points: 30, durationSec: 60 * 60, label: "conversation/upload",
});
const sendEmailLimiter = createLimiter({
  points: 20, durationSec: 60 * 60, label: "conversation/send-email",
});
const styleUploadLimiter = createLimiter({
  points: 10, durationSec: 60 * 60, label: "style/upload",
});
const styleProcessLimiter = createLimiter({
  points: 15, durationSec: 60 * 60, label: "style/process",
});
const styleProfileLimiter = createLimiter({
  points: 6, durationSec: 60 * 60, label: "style/profile",
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

const USER_LIMITERS = {
  process: processLimiter,
  chat: chatLimiter,
  upload: uploadLimiter,
  sendEmail: sendEmailLimiter,
  styleUpload: styleUploadLimiter,
  styleProcess: styleProcessLimiter,
  styleProfile: styleProfileLimiter,
} as const;

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
