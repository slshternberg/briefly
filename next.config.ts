import type { NextConfig } from "next";

// Security headers applied to every route.
//
// - HSTS is emitted only in production so local http://localhost dev keeps
//   working. Preload is intentionally omitted — opt in only after the domain
//   has been stable for months.
// - Permissions-Policy explicitly allows `microphone` and `display-capture`
//   for self (audio + screen recording in src/hooks/use-recorder.ts) and
//   allows `camera` for self because Chromium enforces that policy for
//   display-media video capture too.
// - CSP is held for a follow-up pass (tracked in TODO-observed.md). Next.js
//   emits inline styles and scripts that require either `unsafe-inline` or
//   per-request nonces; rolling out without browser verification risks
//   breaking Stripe Checkout / Google OAuth popups.
const BASE_SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: [
      "microphone=(self)",
      "display-capture=(self)",
      "camera=(self)",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "fullscreen=(self)",
    ].join(", "),
  },
];

const PROD_ONLY_HEADERS =
  process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains",
        },
      ]
    : [];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  // node-cron uses Node.js internals — keep it out of the webpack bundle.
  serverExternalPackages: ["node-cron"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...BASE_SECURITY_HEADERS, ...PROD_ONLY_HEADERS],
      },
    ];
  },
};

export default nextConfig;
