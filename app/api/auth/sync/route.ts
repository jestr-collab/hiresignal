import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-service";

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

/**
 * Ensures a `subscribers` row exists for the signed-in Clerk user.
 * Called from the dashboard after auth (idempotent for returning users).
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = primaryEmail(user);
  if (!email) {
    return NextResponse.json({ error: "No email on account" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server misconfiguration";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const trialEnds = new Date();
  trialEnds.setDate(trialEnds.getDate() + 14);

  const { data: existing, error: selectErr } = await supabase
    .from("subscribers")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (selectErr) {
    return NextResponse.json({ error: selectErr.message }, { status: 500 });
  }

  if (!existing) {
    const { error: insertErr } = await supabase.from("subscribers").insert({
      clerk_user_id: userId,
      email,
      plan: "trial",
      trial_ends_at: trialEnds.toISOString(),
    });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ created: true });
  }

  const { error: updateErr } = await supabase
    .from("subscribers")
    .update({ email })
    .eq("clerk_user_id", userId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ created: false });
}
