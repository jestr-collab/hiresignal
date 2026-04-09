import type { Browser, Page } from "playwright";
import { chromium } from "playwright";
import type { Company, ScrapedBoardJob } from "@/types";

/** Use this board when manually verifying selectors (e.g. Playwright smoke test). */
export const HUBSPOT_GREENHOUSE_URL =
  "https://boards.greenhouse.io/hubspot";

const GOTO_TIMEOUT_MS = 30_000;
const HARD_SCRAPE_TIMEOUT_MS = 30_000;
const GREENHOUSE_API_BASE = "https://api.greenhouse.io/v1/boards";

type GreenhouseApiJob = {
  title?: string;
  absolute_url?: string;
  location?: {
    name?: string;
  } | null;
};

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

function randomDelayMs(): number {
  return 1000 + Math.floor(Math.random() * 1000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isGreenhouseJobHref(href: string): boolean {
  const h = href.toLowerCase();
  return h.includes("job-boards.greenhouse.io") || h.includes("/jobs/");
}

function isLeverJobHref(href: string): boolean {
  const h = href.toLowerCase();
  return h.includes("jobs.lever.co") || h.includes("/lever/");
}

export function extractGreenhouseSlug(
  greenhouseUrl: string | null | undefined
): string | null {
  const value = greenhouseUrl?.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[0] ?? null;
  } catch {
    return null;
  }
}

async function fetchGreenhouseJobsBySlug(
  slug: string
): Promise<GreenhouseApiJob[] | null> {
  const apiUrl = `${GREENHOUSE_API_BASE}/${encodeURIComponent(slug)}/jobs`;

  try {
    const res = await fetch(apiUrl, {
      headers: {
        Accept: "application/json",
        "user-agent": "HireSignal-greenhouse-api/1.0",
      },
    });

    if (!res.ok) {
      return null;
    }

    const json = (await res.json()) as { jobs?: unknown };
    return Array.isArray(json.jobs) ? (json.jobs as GreenhouseApiJob[]) : null;
  } catch {
    return null;
  }
}

async function runScrapeWithHardTimeout(
  company: Company,
  browser: Browser | undefined,
  label: string,
  work: (page: Page) => Promise<ScrapedBoardJob[]>
): Promise<ScrapedBoardJob[]> {
  const ownsBrowser = !browser;
  const browserInstance = browser ?? (await chromium.launch({ headless: true }));

  try {
    let page: Page | undefined;
    let hardLimitTimer: ReturnType<typeof setTimeout> | undefined;

    const scrapeWork = async (): Promise<ScrapedBoardJob[]> => {
      page = await browserInstance.newPage();
      try {
        page.setDefaultNavigationTimeout(GOTO_TIMEOUT_MS);
        return await work(page);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[scraper] ${company.name}: ${message}`);
        return [];
      } finally {
        if (hardLimitTimer !== undefined) {
          clearTimeout(hardLimitTimer);
          hardLimitTimer = undefined;
        }
        await page?.close().catch(() => {});
        page = undefined;
      }
    };

    const hardLimitPromise = new Promise<ScrapedBoardJob[]>((resolve) => {
      hardLimitTimer = setTimeout(async () => {
        console.warn(
          `[scraper] ${company.name}: hard timeout ${HARD_SCRAPE_TIMEOUT_MS}ms (${label})`
        );
        if (page) {
          await page.close().catch(() => {});
          page = undefined;
        }
        resolve([]);
      }, HARD_SCRAPE_TIMEOUT_MS);
    });

    return await Promise.race([scrapeWork(), hardLimitPromise]);
  } finally {
    if (ownsBrowser) {
      await browserInstance.close().catch(() => {});
    }
  }
}

/**
 * Scrapes a Greenhouse board for the given company.
 * Pass an existing `browser` from the caller to reuse one Chromium instance across many companies.
 * On 404, timeout, or other errors, logs and returns [] (never throws).
 */
export async function scrapeCompanyJobs(
  company: Company,
  browser?: Browser
): Promise<ScrapedBoardJob[]> {
  const greenhouseUrl = company.greenhouse_url?.trim();
  if (!greenhouseUrl) {
    return [];
  }

  return runScrapeWithHardTimeout(company, browser, "greenhouse", async (page) => {
    const response = await page.goto(greenhouseUrl, {
      waitUntil: "domcontentloaded",
      timeout: GOTO_TIMEOUT_MS,
    });

    if (response && response.status() >= 400) {
      console.warn(
        `[scraper] ${company.name}: HTTP ${response.status()} for ${greenhouseUrl}`
      );
      return [];
    }

    const docTitle = await page.title();
    const textPreview = await page.evaluate(() => {
      const body = document.body;
      if (!body) return "";
      const t = body.innerText ?? "";
      return t.slice(0, 500).replace(/\s+/g, " ").trim();
    });
    console.warn(
      `[scraper] ${company.name}: pageTitle=${JSON.stringify(docTitle)} textPreview=${JSON.stringify(textPreview)}`
    );

    if (
      /no (current )?openings/i.test(textPreview) ||
      /there are no openings/i.test(textPreview)
    ) {
      console.warn(
        `[scraper] ${company.name}: board text indicates no open roles`
      );
      return [];
    }

    const links = await page.$$eval("a", (els) =>
      els.map((a) => ({
        href: (a as HTMLAnchorElement).href,
        text: a.textContent?.trim() ?? "",
      }))
    );

    const filtered = links.filter((l) => isGreenhouseJobHref(l.href));

    const seen = new Set<string>();
    const posted_date = todayISODate();
    const jobs: ScrapedBoardJob[] = [];

    for (const { href, text } of filtered) {
      if (!href) continue;
      let job_url: string;
      try {
        job_url = new URL(href, greenhouseUrl).href;
      } catch {
        job_url = href;
      }
      if (seen.has(job_url)) continue;
      seen.add(job_url);

      const title = text || "Untitled role";

      jobs.push({
        title,
        job_url,
        location: null,
        board: "greenhouse",
        posted_date,
      });
    }

    console.warn(
      `[scraper] ${company.name}: ${jobs.length} Greenhouse job link(s) after filter (${links.length} total <a>)`
    );

    return jobs;
  });
}

/**
 * Scrapes a Greenhouse board via the public API.
 * Uses the slug from `company.greenhouse_url` and avoids Playwright entirely.
 */
export async function scrapeCompanyJobsGreenhouseAPI(
  company: Company
): Promise<ScrapedBoardJob[]> {
  const greenhouseUrl = company.greenhouse_url?.trim();
  if (!greenhouseUrl) {
    return [];
  }

  const slug = extractGreenhouseSlug(greenhouseUrl);
  if (!slug) {
    console.warn(
      `[scraper] ${company.name}: could not extract Greenhouse slug from ${greenhouseUrl}`
    );
    return [];
  }

  const jobs = await fetchGreenhouseJobsBySlug(slug);
  if (!jobs) {
    console.warn(
      `[scraper] ${company.name}: Greenhouse API returned no jobs data for slug ${slug}`
    );
    return [];
  }

  const posted_date = todayISODate();
  const out: ScrapedBoardJob[] = [];

  for (const job of jobs) {
    const title = typeof job.title === "string" ? job.title.trim() : "";
    const job_url =
      typeof job.absolute_url === "string" ? job.absolute_url.trim() : "";
    const location =
      typeof job.location?.name === "string" && job.location.name.trim()
        ? job.location.name.trim()
        : null;

    if (!title || !job_url) continue;

    out.push({
      title,
      job_url,
      location,
      board: "greenhouse",
      posted_date,
    });
  }

  console.warn(
    `[scraper] ${company.name}: ${out.length} Greenhouse job(s) via public API`
  );

  return out;
}

/**
 * Scrapes a Lever board (jobs.lever.co/{slug}) for the given company.
 * Same link-extraction approach as Greenhouse; 404/timeout returns [].
 */
export async function scrapeCompanyJobsLever(
  company: Company,
  browser?: Browser
): Promise<ScrapedBoardJob[]> {
  const leverUrl = company.lever_url?.trim();
  if (!leverUrl) {
    return [];
  }

  return runScrapeWithHardTimeout(company, browser, "lever", async (page) => {
    const response = await page.goto(leverUrl, {
      waitUntil: "domcontentloaded",
      timeout: GOTO_TIMEOUT_MS,
    });

    if (response && response.status() >= 400) {
      console.warn(
        `[scraper] ${company.name}: HTTP ${response.status()} for ${leverUrl}`
      );
      return [];
    }

    const docTitle = await page.title();
    console.warn(
      `[scraper] ${company.name} [lever]: pageTitle=${JSON.stringify(docTitle)}`
    );

    const links = await page.$$eval("a", (els) =>
      els.map((a) => ({
        href: (a as HTMLAnchorElement).href,
        text: a.textContent?.trim() ?? "",
      }))
    );

    const filtered = links.filter((l) => isLeverJobHref(l.href));

    const seen = new Set<string>();
    const posted_date = todayISODate();
    const jobs: ScrapedBoardJob[] = [];

    for (const { href, text } of filtered) {
      if (!href) continue;
      let job_url: string;
      try {
        job_url = new URL(href, leverUrl).href;
      } catch {
        job_url = href;
      }
      if (seen.has(job_url)) continue;
      seen.add(job_url);

      const title = text || "Untitled role";

      jobs.push({
        title,
        job_url,
        location: null,
        board: "lever",
        posted_date,
      });
    }

    console.warn(
      `[scraper] ${company.name}: ${jobs.length} Lever job link(s) after filter (${links.length} total <a>)`
    );

    return jobs;
  });
}

/**
 * Waits 1–2 seconds between job board page visits (rate limiting).
 * Call from the cron route between scrape calls when sharing a browser.
 */
export async function delayBetweenGreenhouseVisits(): Promise<void> {
  await sleep(randomDelayMs());
}
