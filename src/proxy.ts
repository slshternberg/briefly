import { auth } from "@/lib/auth";

/**
 * Next.js 16 proxy (née "middleware" — renamed by the upstream codemod
 * in v16; see https://nextjs.org/docs/app/api-reference/file-conventions/middleware).
 *
 * Runs the NextAuth `auth()` wrapper on every matched route so the
 * `authorized` callback in src/lib/auth.ts (login/verify-email redirects,
 * dashboard gating) fires for protected paths.
 *
 * Security headers previously lived here too but were moved to
 * next.config.ts (commit 65e0bf2, A.4) so they apply to *every* response,
 * not just the matcher set below.
 */
export default auth(() => {
  // Let NextAuth's authorized callback decide the response.
  // Returning undefined lets the request continue.
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings/:path*",
    "/verify-email",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ],
};
