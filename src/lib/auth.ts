import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validations/auth";
import { WorkspaceMemberRole } from "@prisma/client";

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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          activeWorkspaceId: activeMembership.workspaceId,
          activeWorkspaceRole: activeMembership.role,
        };
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      const isProtected =
        pathname.startsWith("/dashboard") || pathname.startsWith("/settings");
      const isAuthPage =
        pathname.startsWith("/login") || pathname.startsWith("/register");

      // Redirect authenticated users away from auth pages
      if (isAuthPage && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      }

      // Block unauthenticated users from protected pages
      if (isProtected && !isLoggedIn) {
        return false; // NextAuth will redirect to signIn page
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.activeWorkspaceId = (user as Record<string, unknown>)
          .activeWorkspaceId as string;
        token.activeWorkspaceRole = (user as Record<string, unknown>)
          .activeWorkspaceRole as string;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.activeWorkspaceId = token.activeWorkspaceId as string;
        session.user.activeWorkspaceRole =
          token.activeWorkspaceRole as WorkspaceMemberRole;
      }
      return session;
    },
  },
});
