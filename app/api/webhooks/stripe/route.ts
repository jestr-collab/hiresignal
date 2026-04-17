import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!webhookSecret || !apiKey) {
    console.error("[stripe webhook] Missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  const rawBody = await request.text();

  const stripe = new Stripe(apiKey);
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("[stripe webhook] Signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server misconfiguration";
    console.error("[stripe webhook]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") {
          break;
        }

        const clerkUserId = session.metadata?.clerk_user_id?.trim();
        if (!clerkUserId) {
          console.error(
            "[stripe webhook] checkout.session.completed missing metadata.clerk_user_id"
          );
          return NextResponse.json(
            { error: "Missing clerk_user_id in session metadata" },
            { status: 500 }
          );
        }

        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id ?? null;

        if (!customerId || !subscriptionId) {
          console.error(
            "[stripe webhook] checkout.session.completed missing customer or subscription id"
          );
          return NextResponse.json(
            { error: "Missing customer or subscription on session" },
            { status: 500 }
          );
        }

        const { error } = await supabase
          .from("subscribers")
          .update({
            plan: "active",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          })
          .eq("clerk_user_id", clerkUserId);

        if (error) {
          console.error("[stripe webhook] Supabase update failed:", error.message);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string"
            ? subscription.customer
            : subscription.customer?.id ?? null;

        if (!customerId) {
          console.error(
            "[stripe webhook] customer.subscription.deleted missing customer id"
          );
          break;
        }

        const { error } = await supabase
          .from("subscribers")
          .update({ plan: "cancelled" })
          .eq("stripe_customer_id", customerId);

        if (error) {
          console.error("[stripe webhook] Supabase cancel update failed:", error.message);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
        break;
      }

      default:
        break;
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Handler error";
    console.error("[stripe webhook]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
