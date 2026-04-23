import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import type Stripe from "stripe";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !secret) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  const body = await req.text();

  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(sub);
        break;
      }
      default:
        // Ignore other events
        break;
    }
  } catch (err) {
    console.error(`Stripe webhook handler error for ${event.type}:`, err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

function getPeriodDates(sub: Stripe.Subscription) {
  // In Stripe API ≥ 2026-03-25, period dates moved from Subscription to SubscriptionItem
  const item = sub.items?.data?.[0];
  const start = item?.current_period_start;
  const end = item?.current_period_end;
  return {
    currentPeriodStart: start ? new Date(start * 1000) : undefined,
    currentPeriodEnd: end ? new Date(end * 1000) : undefined,
  };
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const workspaceId = session.metadata?.workspaceId;
  const planId = session.metadata?.planId;
  if (!workspaceId || !planId || !session.subscription) return;

  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(session.subscription as string);
  const { currentPeriodStart, currentPeriodEnd } = getPeriodDates(sub);

  await db.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    create: {
      workspaceId,
      planId,
      stripeSubscriptionId: sub.id,
      status: mapStatus(sub.status),
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
    update: {
      status: mapStatus(sub.status),
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  });
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const workspaceId = sub.metadata?.workspaceId;
  const planId = sub.metadata?.planId;
  if (!workspaceId) return;

  const { currentPeriodStart, currentPeriodEnd } = getPeriodDates(sub);
  const existing = await db.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
  });

  if (existing) {
    await db.subscription.update({
      where: { stripeSubscriptionId: sub.id },
      data: {
        status: mapStatus(sub.status),
        planId: planId || existing.planId,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    });
  } else if (planId) {
    await db.subscription.create({
      data: {
        workspaceId,
        planId,
        stripeSubscriptionId: sub.id,
        status: mapStatus(sub.status),
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      },
    });
  }
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  await db.subscription.updateMany({
    where: { stripeSubscriptionId: sub.id },
    data: { status: "CANCELED" },
  });
}

function mapStatus(stripeStatus: string): "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID" {
  const map: Record<string, "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "UNPAID"> = {
    trialing: "TRIALING",
    active: "ACTIVE",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    cancelled: "CANCELED",
    unpaid: "UNPAID",
    incomplete: "PAST_DUE",
    incomplete_expired: "CANCELED",
    paused: "PAST_DUE",
  };
  return map[stripeStatus] ?? "ACTIVE";
}
