import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validations/auth";
import { WorkspaceMemberRole } from "@prisma/client";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { logAudit } from "@/lib/audit";
import { resolveJwt } from "@/lib/jwt-resolver";

const loginLimiter = new RateLimiterMemory({ points: 10, duration: 60 * 15 });

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        try {
          await loginLimiter.consume(email);
        } catch {
          throw new Error("Too many login attempts. Please try again later.");
        }

        const user = await db.user.findUnique({
          where: { email },
          include: {
            memberships: {
              include: {
                workspace: { select: { id: true, deletedAt: true } },
              },
              orderBy: { createdAt: "asc" },
            },
          },
        });

        if (!user || !user.passwordHash) return null;

        const isValid = await compare(password, user.passwordHash);
        if (!isValid) return null;

        // Find the first active workspace membership
        const activeMembership = user.memberships.find(
          (m) => m.workspace.deletedAt === null
        );

        if (!activeMembership) return null;

        // Audit: successful login
        logAudit({
          workspaceId: activeMembership.workspaceId,
          userId: user.id,
          action: "user.login",
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          emailVerified: user.emailVerified,
          activeWorkspaceId: activeMembership.workspaceId,
          activeWorkspaceRole: activeMembership.role,
        };
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const emailVerified = auth?.user?.emailVerified ?? true; // default true for existing sessions without this field
      const { pathname } = request.nextUrl;

      const isProtected =
        pathname.startsWith("/dashboard") || pathname.startsWith("/settings");
      const isAuthPage =
        pathname.startsWith("/login") || pathname.startsWith("/register");
      const isVerifyPage = pathname.startsWith("/verify-email");

      // Redirect authenticated users away from auth pages
      if (isAuthPage && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      // Block unauthenticated users from protected pages
      if ((isProtected || isVerifyPage) && !isLoggedIn) {
        return false; // NextAuth will redirect to signIn page
      }

      // Redirect verified users away from verify-email page
      if (isVerifyPage && isLoggedIn && emailVerified) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      // Block unverified users from protected pages
      if (isProtected && isLoggedIn && !emailVerified) {
        return Response.redirect(new URL("/verify-email", request.nextUrl));
      }

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      return (await resolveJwt({
        token: token as Record<string, unknown>,
        user: (user as Record<string, unknown>) ?? null,
        trigger,
        session: session as Record<string, unknown> | undefined,
      })) as typeof token;
    },
    async session({ session, token }) {
      if (!token || !token.id) {
        return session;
      }
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { emailVerified: boolean }).emailVerified = (token.emailVerified ?? true) as boolean;
        session.user.activeWorkspaceId = token.activeWorkspaceId as string;
        session.user.activeWorkspaceRole =
          token.activeWorkspaceRole as WorkspaceMemberRole;
      }
      return session;
    },
  },
});
