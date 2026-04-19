import { RateLimiterMemory } from "rate-limiter-flexible";
import { NextRequest, NextResponse } from "next/server";

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

export async function rateLimitUser(
  userId: string,
  type: "process" | "chat" | "upload"
): Promise<NextResponse | null> {
  const limiter =
    type === "process" ? processLimiter :
    type === "upload" ? uploadLimiter :
    chatLimiter;

  try {
    await limiter.consume(userId);
    return null; // allowed
  } catch {
    return NextResponse.json(
      { error: "TOO_MANY_REQUESTS" },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }
}
