import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

function primaryEmail(
  user: NonNullable<Awaited<ReturnType<typeof currentUser>>>
): string | null {
  const primaryId = user.primaryEmailAddressId;
  const primary =
    user.emailAddresses.find((e) => e.id === primaryId) ??
    user.emailAddresses[0];
  return primary?.emailAddress ?? null;
}

function appBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

async function createCheckoutSession(): Promise<
  | { ok: true; url: string }
  | { ok: false; status: number; message: string }
> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const secret = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!secret || !priceId) {
    return {
      ok: false,
      status: 500,
      message: "Missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID",
    };
  }

  const user = await currentUser();
  if (!user) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  const customerEmail = primaryEmail(user);
  if (!customerEmail) {
    return { ok: false, status: 400, message: "No email on account" };
  }

  const stripe = new Stripe(secret);
  const base = appBaseUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/upgrade`,
    customer_email: customerEmail,
    client_reference_id: userId,
    metadata: { clerk_user_id: userId },
  });

  if (!session.url) {
    return {
      ok: false,
      status: 500,
      message: "Stripe did not return a checkout URL",
    };
  }

  return { ok: true, url: session.url };
}

export async function GET() {
  const result = await createCheckoutSession();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: result.status }
    );
  }
  return NextResponse.redirect(result.url);
}

export async function POST() {
  const result = await createCheckoutSession();
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: result.status }
    );
  }
  return NextResponse.json({ url: result.url });
}
