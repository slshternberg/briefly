import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validations/auth";
import { rateLimit } from "@/lib/rate-limit";
import { Prisma } from "@prisma/client";
import { sendEmail, buildVerificationEmail } from "@/services/email";

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, "register");
  if (limited) return limited;

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;
    const passwordHash = await hash(password, 12);

    // Create user + default workspace + membership in a single transaction.
    // Relies on DB unique constraint on email instead of check-then-create
    // to avoid race conditions.
    const result = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          name,
          passwordHash,
        },
      });

      const slug = generateSlug(name);

      const workspace = await tx.workspace.create({
        data: {
          name: `${name}'s Workspace`,
          slug,
        },
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId: user.id,
          role: "OWNER",
        },
      });

      return { user, workspace };
    });

    // Send verification email (fire-and-forget, don't block registration)
    const raw = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    db.emailVerificationToken
      .create({ data: { userId: result.user.id, tokenHash, expiresAt } })
      .then(() => {
        const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
        const link = `${baseUrl}/api/auth/verify-email?token=${raw}`;
        return sendEmail({
          to: result.user.email,
          subject: "Briefly — אמתי את כתובת המייל שלך",
          html: buildVerificationEmail(link),
        });
      })
      .catch((err) => console.error("Verification email failed:", err));

    return NextResponse.json(
      {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // Handle unique constraint violation (duplicate email)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || "workspace"}-${suffix}`;
}
