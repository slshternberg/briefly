import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id || !session.user.activeWorkspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.activeWorkspaceRole;
  if (role !== "OWNER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Only owners and admins can manage billing" }, { status: 403 });
  }

  const workspace = await db.workspace.findUnique({
    where: { id: session.user.activeWorkspaceId },
    select: { stripeCustomerId: true },
  });

  if (!workspace?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account found" }, { status: 404 });
  }

  const portalSession = await getStripe().billingPortal.sessions.create({
    customer: workspace.stripeCustomerId,
    return_url: `${env.AUTH_URL}/dashboard/settings`,
  });

  return NextResponse.json({ url: portalSession.url });
}
