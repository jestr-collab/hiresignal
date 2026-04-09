import { NextRequest, NextResponse } from "next/server";
import {
  enrichCompany,
  findContactsWithHunterFallback,
  type CompanyEnrichmentPatch,
} from "@/lib/apollo";
import { createServiceRoleClient } from "@/lib/supabase-service";
import type { Signal } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type EnrichSummary = {
  companiesEnriched: number;
  contactsFound: number;
};

function patchHasUpdates(patch: CompanyEnrichmentPatch): boolean {
  return Object.values(patch).some((v) => v != null && v !== "");
}

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;

  if (!expected || cronSecret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apolloKey = process.env.APOLLO_API_KEY?.trim();
  const hunterKey = process.env.HUNTER_API_KEY?.trim();
  if (!apolloKey && !hunterKey) {
    console.warn(
      "[enrich] APOLLO_API_KEY and HUNTER_API_KEY are both unset — nothing to do"
    );
    return NextResponse.json({
      companiesEnriched: 0,
      contactsFound: 0,
    } satisfies EnrichSummary);
  }
  if (!apolloKey) {
    console.warn(
      "[enrich] APOLLO_API_KEY is not set — skipping company enrichment (Hunter contacts still run if configured)"
    );
  }
  if (!hunterKey) {
    console.warn(
      "[enrich] HUNTER_API_KEY is not set — skipping contact lookup via Hunter"
    );
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server misconfiguration";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: recentSignals, error: sigErr } = await supabase
    .from("signals")
    .select("id, company_id, signal_type, score")
    .gte("detected_at", since)
    .not("company_id", "is", null);

  if (sigErr) {
    return NextResponse.json({ error: sigErr.message }, { status: 500 });
  }

  const { data: contactRows, error: contactErr } = await supabase
    .from("contacts")
    .select("company_id");

  if (contactErr) {
    return NextResponse.json({ error: contactErr.message }, { status: 500 });
  }

  const companiesWithContacts = new Set<string>();
  for (const row of contactRows ?? []) {
    const id = row.company_id as string | null;
    if (id) companiesWithContacts.add(id);
  }

  const candidates = (recentSignals ?? []).filter(
    (s) => s.company_id && !companiesWithContacts.has(s.company_id as string)
  ) as Pick<Signal, "company_id" | "signal_type" | "score">[];

  const bestSignalByCompany = new Map<
    string,
    Pick<Signal, "company_id" | "signal_type" | "score">
  >();
  for (const s of candidates) {
    const cid = s.company_id as string;
    const prev = bestSignalByCompany.get(cid);
    const score = s.score ?? 0;
    if (!prev || (prev.score ?? 0) < score) {
      bestSignalByCompany.set(cid, s);
    }
  }

  const summary: EnrichSummary = {
    companiesEnriched: 0,
    contactsFound: 0,
  };

  if (bestSignalByCompany.size === 0) {
    return NextResponse.json(summary);
  }

  const companyIds = Array.from(bestSignalByCompany.keys());

  const { data: companies, error: compErr } = await supabase
    .from("companies")
    .select("id, domain, size_range")
    .in("id", companyIds);

  if (compErr) {
    return NextResponse.json({ error: compErr.message }, { status: 500 });
  }

  const companyById = new Map(
    (companies ?? []).map((c) => [c.id as string, c] as const)
  );

  const now = new Date().toISOString();

  for (const companyId of companyIds) {
    const company = companyById.get(companyId);
    const signal = bestSignalByCompany.get(companyId);
    if (!company?.domain?.trim() || !signal) continue;

    const domain = company.domain.trim();

    const patch = apolloKey
      ? await enrichCompany(domain, company.size_range ?? null)
      : null;
    if (patch && patchHasUpdates(patch)) {
      const { error: upErr } = await supabase
        .from("companies")
        .update({
          ...patch,
          updated_at: now,
        })
        .eq("id", companyId);

      if (upErr) {
        console.warn(
          `[enrich] Failed to update company ${companyId}: ${upErr.message}`
        );
      } else {
        summary.companiesEnriched += 1;
      }
    }

    const { contacts, source } = await findContactsWithHunterFallback(
      domain,
      signal.signal_type,
      company.size_range ?? null
    );
    for (const c of contacts) {
      const { error: insErr } = await supabase.from("contacts").insert({
        company_id: companyId,
        first_name: c.first_name,
        last_name: c.last_name,
        title: c.title,
        email: c.email,
        linkedin_url: c.linkedin_url === "" ? "" : c.linkedin_url,
        seniority: c.seniority,
        source,
      });

      if (insErr) {
        console.warn(`[enrich] Contact insert failed: ${insErr.message}`);
      } else {
        summary.contactsFound += 1;
      }
    }
  }

  return NextResponse.json(summary);
}
