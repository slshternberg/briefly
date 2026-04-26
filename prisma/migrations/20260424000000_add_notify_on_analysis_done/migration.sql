-- Add workspace-level toggle for "send email when analysis finishes".
-- Replaces the per-conversation `sendNotification` checkbox; the analysis
-- worker now reads this column server-side instead of trusting a value the
-- client supplies on every process call.
--
-- Default is false so existing workspaces keep the previous "off" behaviour
-- until an OWNER/ADMIN flips the toggle in Settings → Notifications.

ALTER TABLE "workspaces"
  ADD COLUMN "notifyOnAnalysisDone" BOOLEAN NOT NULL DEFAULT false;
