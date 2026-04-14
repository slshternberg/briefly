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

function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function rateLimit(
  req: NextRequest,
  type: "register" | "login"
): Promise<NextResponse | null> {
  const limiter = type === "register" ? registerLimiter : loginLimiter;
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
