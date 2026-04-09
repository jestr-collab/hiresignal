import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import {
  delayBetweenGreenhouseVisits,
  scrapeCompanyJobsGreenhouseAPI,
  scrapeCompanyJobsLever,
} from "@/lib/scraper";
import { createServiceRoleClient } from "@/lib/supabase-service";
import type { Company, ScrapedBoardJob } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ScrapeSummary = {
  companiesScraped: number;
  jobsFound: number;
  newJobs: number;
  greenhouseJobs: number;
  leverJobs: number;
};

function hasBoardUrl(c: Company): boolean {
  const g = c.greenhouse_url?.trim();
  const l = c.lever_url?.trim();
  return Boolean(g) || Boolean(l);
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

  const { data: companies, error: companiesError } = await supabase
    .from("companies")
    .select("*");

  if (companiesError) {
    return NextResponse.json(
      { error: companiesError.message },
      { status: 500 }
    );
  }

  const list = (companies ?? []).filter(hasBoardUrl) as Company[];

  const summary: ScrapeSummary = {
    companiesScraped: 0,
    jobsFound: 0,
    newJobs: 0,
    greenhouseJobs: 0,
    leverJobs: 0,
  };

  const needsLeverBrowser = list.some((company) => company.lever_url?.trim());
  const browser = needsLeverBrowser ? await chromium.launch({ headless: true }) : undefined;

  try {
    for (const company of list) {
      const scraped: ScrapedBoardJob[] = [];

      if (company.greenhouse_url?.trim()) {
        const g = await scrapeCompanyJobsGreenhouseAPI(company);
        scraped.push(...g);
        summary.greenhouseJobs += g.length;
      }

      if (company.lever_url?.trim()) {
        const l = await scrapeCompanyJobsLever(company, browser);
        scraped.push(...l);
        summary.leverJobs += l.length;
        if (l.length > 0) {
          await delayBetweenGreenhouseVisits();
        }
      }

      summary.companiesScraped += 1;
      summary.jobsFound += scraped.length;

      if (scraped.length === 0) {
        await delayBetweenGreenhouseVisits();
        continue;
      }

      const urls = scraped.map((j) => j.job_url);
      const { data: existingRows } = await supabase
        .from("jobs")
        .select("job_url")
        .eq("company_id", company.id)
        .in("job_url", urls);

      const existingSet = new Set(
        (existingRows ?? []).map((r) => r.job_url as string)
      );

      for (const job of scraped) {
        if (!existingSet.has(job.job_url)) {
          summary.newJobs += 1;
        }
      }

      const now = new Date().toISOString();
      const rows = scraped.map((job) => ({
        company_id: company.id,
        title: job.title,
        description: null as string | null,
        location: job.location,
        job_url: job.job_url,
        board: job.board,
        posted_date: job.posted_date,
        scraped_at: now,
        is_active: true,
      }));

      const { error: upsertError } = await supabase.from("jobs").upsert(rows, {
        onConflict: "company_id,job_url",
      });

      if (upsertError) {
        await browser?.close().catch(() => {});
        return NextResponse.json(
          { error: upsertError.message },
          { status: 500 }
        );
      }

      await delayBetweenGreenhouseVisits();
    }
  } finally {
    await browser?.close().catch(() => {});
  }

  return NextResponse.json(summary);
}
