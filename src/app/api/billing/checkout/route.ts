import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { env } from "@/lib/env";
import { z } from "zod";

const schema = z.object({ planSlug: z.string() });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id || !session.user.activeWorkspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.activeWorkspaceRole;
  if (role !== "OWNER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Only owners and admins can manage billing" }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Plan required" }, { status: 400 });
  }

  const plan = await db.plan.findUnique({
    where: { slug: parsed.data.planSlug, isActive: true },
  });

  if (!plan || !plan.stripePriceId) {
    return NextResponse.json({ error: "Plan not available" }, { status: 404 });
  }

  const workspaceId = session.user.activeWorkspaceId;
  const baseUrl = env.AUTH_URL;

  // Check if workspace already has a Stripe customer ID stored
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { stripeCustomerId: true, name: true },
  });

  const stripe = getStripe();
  let customerId = workspace?.stripeCustomerId ?? undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      name: workspace?.name ?? undefined,
      metadata: { workspaceId, userId: session.user.id },
    });
    customerId = customer.id;

    await db.workspace.update({
      where: { id: workspaceId },
      data: { stripeCustomerId: customerId },
    });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard/settings?billing=success`,
    cancel_url: `${baseUrl}/dashboard/settings?billing=cancelled`,
    metadata: { workspaceId, planId: plan.id },
    subscription_data: {
      metadata: { workspaceId, planId: plan.id },
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
