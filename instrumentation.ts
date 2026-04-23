/**
 * Next.js instrumentation hook — runs once when the server process starts.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * We use this for two things:
 *  1. Startup recovery   — fail conversations that were PROCESSING when the
 *                          server last crashed/restarted (they can never complete).
 *  2. Cron cleanup       — every 10 minutes, fail any conversation stuck in
 *                          PROCESSING for more than 30 minutes.
 *                          This is the server-side safety net; the client-side
 *                          auto-fail in /status/route.ts is a secondary layer.
 */
export async function register() {
  // Guard: only run in the Node.js server runtime, not in the Edge runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Guard: prevent duplicate registration on HMR reloads in development.
  const g = globalThis as typeof globalThis & { __brieflyInstrumented?: boolean };
  if (g.__brieflyInstrumented) return;
  g.__brieflyInstrumented = true;

  // Dynamic imports keep these heavy modules out of the Edge bundle.
  const { db } = await import("@/lib/db");
  const { schedule } = await import("node-cron");

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Startup recovery
  //
  // Conversations that were PROCESSING before this restart will never
  // complete — their background tasks died with the old process. Mark them
  // as FAILED immediately so users can retry instead of waiting forever.
  //
  // We use a 2-minute grace period so a brand-new PROCESSING conversation
  // created just before a graceful restart isn't prematurely failed.
  // ─────────────────────────────────────────────────────────────────────────
  try {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    const stale = await db.conversation.findMany({
      where: { status: "PROCESSING", updatedAt: { lt: twoMinutesAgo } },
      select: { id: true },
    });

    if (stale.length > 0) {
      await db.conversation.updateMany({
        where: { id: { in: stale.map((c) => c.id) } },
        data: { status: "FAILED" },
      });
      console.log(
        `[startup] Recovered ${stale.length} stuck conversation(s) from previous run.`
      );
    }
  } catch (err) {
    // Non-fatal — don't block server startup.
    console.error("[startup] Recovery scan failed:", err);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Cron cleanup — runs every 10 minutes
  //
  // Auto-fails conversations that have been PROCESSING for more than 30
  // minutes. This is the server-side equivalent of the client-side auto-fail
  // in status/route.ts, but it works even when no browser is polling.
  // ─────────────────────────────────────────────────────────────────────────
  schedule("*/10 * * * *", async () => {
    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const stuck = await db.conversation.findMany({
        where: { status: "PROCESSING", updatedAt: { lt: thirtyMinutesAgo } },
        select: { id: true },
      });

      if (stuck.length === 0) return;

      await db.conversation.updateMany({
        where: {
          id: { in: stuck.map((c) => c.id) },
          status: "PROCESSING", // re-check to avoid race with a completing job
        },
        data: { status: "FAILED" },
      });

      console.log(`[cron] Auto-failed ${stuck.length} stuck conversation(s).`);
    } catch (err) {
      console.error("[cron] Cleanup failed:", err);
    }
  });

  console.log("[startup] Instrumentation ready (recovery done, cron scheduled).");
}
