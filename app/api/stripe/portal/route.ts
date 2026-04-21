import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase-service";

export const dynamic = "force-dynamic";

function appBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

/**
 * Stripe Customer Billing Portal. Enable the portal in Stripe Dashboard:
 * Settings → Billing → Customer portal.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!stripeKey) {
    return NextResponse.json(
      { error: "Missing STRIPE_SECRET_KEY" },
      { status: 500 }
    );
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server misconfiguration";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data: row, error } = await supabase
    .from("subscribers")
    .select("stripe_customer_id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const customerId = row?.stripe_customer_id?.trim();
  if (!customerId) {
    return NextResponse.json(
      { error: "No Stripe customer on file. Subscribe first." },
      { status: 400 }
    );
  }

  const stripe = new Stripe(stripeKey);
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appBaseUrl()}/`,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe did not return a portal URL" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(session.url);
}
