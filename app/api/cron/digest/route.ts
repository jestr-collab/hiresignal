import { NextRequest, NextResponse } from "next/server";
import {
  sendTrialEndingReminder,
  sendWeeklyDigest,
  type WeeklyDigestSignal,
} from "@/lib/email";
import { mondayOfWeekLocalString } from "@/lib/dashboard-utils";
import { createServiceRoleClient } from "@/lib/supabase-service";
import type { Company, Contact, Signal, Subscriber } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type CompanyWithContacts = Company & { contacts?: Contact[] | null };
type SignalWithNested = Signal & { companies: CompanyWithContacts | null };
const DIGEST_CANDIDATE_LIMIT = 50;
const DIGEST_MAX_SIGNALS = 10;

function pickPrimaryContact(contacts: Contact[] | null | undefined): Contact | null {
  if (!contacts || contacts.length === 0) return null;
  const sorted = [...contacts].sort((a, b) => {
    const ta = a.enriched_at ? new Date(a.enriched_at).getTime() : 0;
    const tb = b.enriched_at ? new Date(b.enriched_at).getTime() : 0;
    return tb - ta;
  });
  return sorted[0] ?? null;
}

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET?.trim();

  if (!expected || cronSecret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.RESEND_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "Missing RESEND_API_KEY" },
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

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

  const now = new Date();
  const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const { data: trialsEnding, error: trialErr } = await supabase
    .from("subscribers")
    .select("*")
    .eq("plan", "trial")
    .gte("trial_ends_at", now.toISOString())
    .lte("trial_ends_at", inThreeDays.toISOString());

  if (trialErr) {
    return NextResponse.json({ error: trialErr.message }, { status: 500 });
  }

  let trialRemindersSent = 0;
  for (const sub of trialsEnding ?? []) {
    const em = sub.email?.trim();
    if (!em || !sub.trial_ends_at) continue;
    const endMs = new Date(sub.trial_ends_at).getTime();
    const daysRemaining = (endMs - now.getTime()) / (24 * 60 * 60 * 1000);
    if (daysRemaining <= 0) continue;
    try {
      await sendTrialEndingReminder(em, daysRemaining, appUrl);
      trialRemindersSent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[digest] Trial reminder failed for ${em}: ${message}`);
    }
  }

  const weekOf = mondayOfWeekLocalString(new Date());

  const { data: subscriberRows, error: subscriberErr } = await supabase
    .from("subscribers")
    .select("*")
    .or("plan.eq.active,plan.eq.trial");

  if (subscriberErr) {
    return NextResponse.json({ error: subscriberErr.message }, { status: 500 });
  }

  const subscribers = (subscriberRows ?? []) as Subscriber[];
  const activeSubscribers = subscribers.filter((row) => row.email?.trim());
  if (activeSubscribers.length === 0) {
    return NextResponse.json({
      subscribersEmailed: 0,
      signalsSent: 0,
      trialRemindersSent,
    });
  }

  const { data: signalRows, error: signalErr } = await supabase
    .from("signals")
    .select("*, companies (*, contacts (*))")
    .eq("week_of", weekOf)
    .eq("is_new", true)
    .order("score", { ascending: false })
    .limit(DIGEST_CANDIDATE_LIMIT);

  if (signalErr) {
    return NextResponse.json({ error: signalErr.message }, { status: 500 });
  }

  const candidates = ((signalRows ?? []) as SignalWithNested[])
    .filter((row) => row.companies && row.company_id)
    .map((row) => {
      const { companies, ...signalRest } = row;
      const contact = pickPrimaryContact(companies?.contacts);
      return {
        signal: signalRest as Signal,
        company: companies as Company,
        contact,
      } satisfies WeeklyDigestSignal;
    })
    .filter((row) => row.contact != null);

  const rows: WeeklyDigestSignal[] = [];
  const seenCompanyId = new Set<string>();
  for (const row of candidates) {
    const companyId = row.signal.company_id;
    if (!companyId) continue;
    if (seenCompanyId.has(companyId)) continue;
    seenCompanyId.add(companyId);
    rows.push(row);
    if (rows.length >= DIGEST_MAX_SIGNALS) break;
  }

  if (rows.length === 0) {
    return NextResponse.json({
      subscribersEmailed: 0,
      signalsSent: 0,
      trialRemindersSent,
    });
  }

  let subscribersEmailed = 0;

  for (const subscriber of activeSubscribers) {
    try {
      await sendWeeklyDigest(subscriber.email, rows, appUrl);
      subscribersEmailed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[digest] Failed to send to ${subscriber.email}: ${message}`
      );
    }
  }

  if (subscribersEmailed > 0) {
    const ids = rows.map((row) => row.signal.id);
    const { error: updateErr } = await supabase
      .from("signals")
      .update({ is_new: false })
      .in("id", ids);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    subscribersEmailed,
    signalsSent: rows.length,
    trialRemindersSent,
  });
}
