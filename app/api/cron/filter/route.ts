import { NextRequest, NextResponse } from "next/server";
import {
  bestSignalStrength,
  buildSignalContext,
  capScore,
  classifyJob,
  computeEnterpriseFlag,
  computeWhyItMatters,
  isFirstBuilderHire,
  sizeRangeScoreAdjustment,
  type JobClassification,
  type SignalType,
} from "@/lib/filter";
import { createServiceRoleClient } from "@/lib/supabase-service";
import type { ConfidenceLevel, Job } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type FilterSummary = {
  jobsProcessed: number;
  signalsCreated: number;
  highIntentCompanies: number;
};

type SignalCleanupRow = {
  id: string;
  company_id: string | null;
  week_of: string | null;
  score: number | null;
};

const EXCLUDED_DOMAINS = new Set([
  "salesforce.com",
  "hubspot.com",
  "pipedrive.com",
  "freshsales.com",
  "close.com",
  "copper.com",
  "nutshell.com",
  "streak.com",
  "capsulecrm.com",
  "insightly.com",
  "nimble.com",
  "zoho.com",
  "sugarcrm.com",
  "vtiger.com",
  "agilecrm.com",
  "outreach.io",
  "salesloft.com",
  "apollo.io",
  "reply.io",
  "klenty.com",
  "lemlist.com",
  "mailshake.com",
  "woodpecker.co",
  "mixmax.com",
  "yesware.com",
  "groove.co",
  "persistiq.com",
  "autoklose.com",
  "quickmail.io",
  "frontspin.com",
  "gong.io",
  "chorus.ai",
  "clari.com",
  "avoma.com",
  "jiminny.com",
  "wingman.app",
  "fireflies.ai",
  "otter.ai",
  "fathom.video",
  "grain.com",
  "tldv.io",
  "modjo.fr",
  "refract.ai",
  "execvision.io",
  "revenue.io",
  "ringdna.com",
  "highspot.com",
  "showpad.com",
  "mindtickle.com",
  "seismic.com",
  "brainshark.com",
  "allego.com",
  "mediafly.com",
  "bigtincan.com",
  "spekit.com",
  "guru.com",
  "bloomfire.com",
  "lessonly.com",
  "workramp.com",
  "trainual.com",
  "zoominfo.com",
  "lusha.com",
  "cognism.com",
  "leadiq.com",
  "uplead.com",
  "seamless.ai",
  "rocketreach.com",
  "hunter.io",
  "snov.io",
  "contactout.com",
  "kaspr.io",
  "clearbit.com",
  "clay.com",
  "surfe.com",
  "evaboot.com",
  "dropcontact.com",
  "getprospect.com",
  "aircall.io",
  "dialpad.com",
  "kixie.com",
  "orum.io",
  "justcall.io",
  "cloudtalk.io",
  "talkdesk.com",
  "five9.com",
  "genesys.com",
  "nice.com",
  "vonage.com",
  "ringcentral.com",
  "natterbox.com",
  "salescookie.com",
  "xactlycorp.com",
  "spiff.com",
  "captivateiq.com",
  "quotapath.com",
  "everstage.com",
  "performio.co",
  "varicent.com",
  "commissionly.io",
  "chilipiper.com",
  "chili-piper.com",
  "bombora.com",
  "6sense.com",
  "demandbase.com",
  "terminus.com",
  "rollworks.com",
  "metadata.io",
  "salto.io",
  "insidesales.com",
  "xant.ai",
]);

function normalizeCompanyDomain(domain: string | null | undefined): string {
  return (domain ?? "").trim().toLowerCase().replace(/^www\./, "");
}

/** Derive confidence from final score only (keeps score and confidence aligned). */
function confidenceFromFinalScore(score: number): ConfidenceLevel {
  if (score >= 95) return "very_high";
  if (score >= 80) return "high";
  return "medium";
}

/** Monday (local) of the calendar week containing `date`, as YYYY-MM-DD for `signals.week_of`. */
function mondayOfWeekLocal(date: Date): string {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dayNum = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dayNum}`;
}

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;

  if (!expected || cronSecret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server misconfiguration";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const now = new Date();
  const fortyEightHoursAgo = new Date(
    now.getTime() - 48 * 60 * 60 * 1000
  ).toISOString();
  const weekOf = mondayOfWeekLocal(now);

  const { data: jobs48h, error: jobsError } = await supabase
    .from("jobs")
    .select("*")
    .gte("scraped_at", fortyEightHoursAgo)
    .not("company_id", "is", null);

  if (jobsError) {
    return NextResponse.json({ error: jobsError.message }, { status: 500 });
  }

  const { data: weekSignals, error: sigError } = await supabase
    .from("signals")
    .select("job_ids")
    .eq("week_of", weekOf);

  if (sigError) {
    return NextResponse.json({ error: sigError.message }, { status: 500 });
  }

  const classifiedJobIds = new Set<string>();
  for (const row of weekSignals ?? []) {
    const ids = row.job_ids as string[] | null;
    if (!ids) continue;
    for (const id of ids) {
      if (id) classifiedJobIds.add(id);
    }
  }

  const allRecent = (jobs48h ?? []) as Job[];
  const toProcess = allRecent.filter((j) => !classifiedJobIds.has(j.id));
  const jobsProcessed = toProcess.length;

  const summary: FilterSummary = {
    jobsProcessed,
    signalsCreated: 0,
    highIntentCompanies: 0,
  };

  if (toProcess.length === 0) {
    return NextResponse.json(summary);
  }

  const affectedCompanyIds = Array.from(
    new Set(
      toProcess
        .map((j) => j.company_id)
        .filter((id): id is string => id != null)
    )
  );

  const companyMetaByCompanyId = new Map<
    string,
    { name: string | null; size_range: string | null; domain: string | null }
  >();
  if (affectedCompanyIds.length > 0) {
    const { data: companyRows, error: companyErr } = await supabase
      .from("companies")
      .select("id, name, size_range, domain")
      .in("id", affectedCompanyIds);

    if (companyErr) {
      return NextResponse.json({ error: companyErr.message }, { status: 500 });
    }

    for (const row of companyRows ?? []) {
      const r = row as {
        id: string;
        name: string | null;
        size_range: string | null;
        domain: string | null;
      };
      companyMetaByCompanyId.set(r.id, {
        name: r.name,
        size_range: r.size_range,
        domain: r.domain,
      });
    }
  }

  for (const companyId of affectedCompanyIds) {
    const companyMeta = companyMetaByCompanyId.get(companyId);
    const normalizedDomain = normalizeCompanyDomain(companyMeta?.domain);
    if (EXCLUDED_DOMAINS.has(normalizedDomain)) {
      console.warn(
        `[filter] Skipping ${companyMeta?.name ?? normalizedDomain} — excluded domain (sales tool)`
      );
      continue;
    }

    const companyJobs = allRecent.filter((j) => j.company_id === companyId);

    const classified: { job: Job; classification: JobClassification }[] = [];
    for (const job of companyJobs) {
      const c = classifyJob(job.title);
      if (c) classified.push({ job, classification: c });
    }

    if (classified.length === 0) continue;

    const totalSignalJobs = classified.length;
    const scoreBoost = totalSignalJobs >= 3 ? 15 : 0;
    if (scoreBoost > 0) {
      summary.highIntentCompanies += 1;
    }

    const countsByType: Partial<Record<SignalType, number>> = {};
    for (const { classification } of classified) {
      const t = classification.signal_type;
      countsByType[t] = (countsByType[t] ?? 0) + 1;
    }

    const context = buildSignalContext(totalSignalJobs, countsByType);

    const byType = new Map<SignalType, typeof classified>();
    for (const row of classified) {
      const t = row.classification.signal_type;
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t)!.push(row);
    }

    const { error: delError } = await supabase
      .from("signals")
      .delete()
      .eq("company_id", companyId)
      .eq("week_of", weekOf);

    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 });
    }

    const detectedAt = new Date().toISOString();
    const rowsToInsert = [];
    const companySizeRange = companyMeta?.size_range ?? null;

    for (const [signalType, rows] of Array.from(byType.entries())) {
      const baseScores = rows.map((r) => r.classification.base_score);
      const maxBase = Math.max(...baseScores);
      let score = maxBase + scoreBoost;
      score += sizeRangeScoreAdjustment(companySizeRange);

      let strength = bestSignalStrength(
        rows.map((r) => r.classification.signal_strength)
      );
      const jobCountForType = rows.length;
      if (isFirstBuilderHire(signalType, jobCountForType, companySizeRange)) {
        score += 20;
        strength = "high";
      }
      score = capScore(score);

      const why_it_matters = computeWhyItMatters(
        companyId,
        signalType,
        jobCountForType,
        companySizeRange,
        countsByType
      );
      const finalConfidenceLevel = confidenceFromFinalScore(score);

      rowsToInsert.push({
        company_id: companyId,
        signal_type: signalType,
        signal_strength: strength,
        score,
        job_count: rows.length,
        job_ids: rows.map((r) => r.job.id),
        context,
        why_it_matters,
        enterprise_flag: computeEnterpriseFlag(companySizeRange),
        confidence_level: finalConfidenceLevel,
        detected_at: detectedAt,
        is_new: true,
        week_of: weekOf,
      });
    }

    const { error: insError } = await supabase.from("signals").insert(rowsToInsert);
    if (insError) {
      return NextResponse.json({ error: insError.message }, { status: 500 });
    }

    const { count: contactCount } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId);

    if ((contactCount ?? 0) === 0) {
      const { data: createdSignals, error: fetchSigErr } = await supabase
        .from("signals")
        .select("id, score, confidence_level")
        .eq("company_id", companyId)
        .eq("week_of", weekOf);

      if (fetchSigErr) {
        return NextResponse.json({ error: fetchSigErr.message }, { status: 500 });
      }

      for (const s of createdSignals ?? []) {
        const row = s as {
          id: string;
          score: number | null;
          confidence_level: ConfidenceLevel | null;
        };
        const nextScore = Math.max(0, (row.score ?? 0) - 20);
        const nextConfidenceLevel = confidenceFromFinalScore(nextScore);
        const { error: penErr } = await supabase
          .from("signals")
          .update({
            score: nextScore,
            confidence_level: nextConfidenceLevel,
          })
          .eq("id", row.id);
        if (penErr) {
          return NextResponse.json({ error: penErr.message }, { status: 500 });
        }
      }
    }

    summary.signalsCreated += rowsToInsert.length;
  }

  const { data: cleanupSignals, error: cleanupFetchErr } = await supabase
    .from("signals")
    .select("id, company_id, week_of, score")
    .eq("week_of", weekOf)
    .not("company_id", "is", null)
    .order("score", { ascending: false });

  if (cleanupFetchErr) {
    return NextResponse.json({ error: cleanupFetchErr.message }, { status: 500 });
  }

  const seenCompanyWeek = new Set<string>();
  const duplicateIds: string[] = [];
  for (const row of (cleanupSignals ?? []) as SignalCleanupRow[]) {
    if (!row.company_id || !row.week_of) continue;
    const key = `${row.company_id}:${row.week_of}`;
    if (seenCompanyWeek.has(key)) {
      duplicateIds.push(row.id);
      continue;
    }
    seenCompanyWeek.add(key);
  }

  if (duplicateIds.length > 0) {
    const { error: cleanupDeleteErr } = await supabase
      .from("signals")
      .delete()
      .in("id", duplicateIds);

    if (cleanupDeleteErr) {
      return NextResponse.json(
        { error: cleanupDeleteErr.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(summary);
}
