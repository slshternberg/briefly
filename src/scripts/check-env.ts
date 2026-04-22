/**
 * Runs Zod validation on process.env via the env module side effect.
 * Throws (non-zero exit) if any required variable is missing or invalid.
 *
 * Usage: `npm run check:env` — also runs automatically on `npm start` (prestart hook).
 */

import "dotenv/config";
import "@/lib/env";

console.log("[env] All required environment variables are present.");
