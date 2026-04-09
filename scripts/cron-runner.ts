import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

type StepResult = {
  step: string;
  status: number;
  durationMs: number;
  body: unknown;
};

function nowIso(): string {
  return new Date().toISOString();
}

function requireEnv(name: "CRON_SECRET" | "NEXT_PUBLIC_APP_URL"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function parseResponseBody(text: string): unknown {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function postCronStep(
  appUrl: string,
  cronSecret: string,
  stepName: string,
  path: string
): Promise<StepResult> {
  const startedAt = Date.now();
  const url = `${appUrl}${path}`;

  console.log(`[${nowIso()}] Starting ${stepName}: POST ${url}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": cronSecret,
    },
  });

  const text = await response.text();
  const body = parseResponseBody(text);
  const durationMs = Date.now() - startedAt;

  console.log(
    `[${nowIso()}] Finished ${stepName}: status=${response.status} durationMs=${durationMs}`
  );
  console.log(`[${nowIso()}] ${stepName} result:`, body);

  if (!response.ok) {
    throw new Error(
      `${stepName} failed with status ${response.status}: ${text || "No response body"}`
    );
  }

  return {
    step: stepName,
    status: response.status,
    durationMs,
    body,
  };
}

function shouldRunDigest(date = new Date()): boolean {
  // Railway cron schedules use UTC, so use UTC weekday here too.
  return date.getUTCDay() === 1;
}

async function main() {
  const cronSecret = requireEnv("CRON_SECRET");
  const appUrl = normalizeBaseUrl(requireEnv("NEXT_PUBLIC_APP_URL"));
  const results: StepResult[] = [];

  results.push(
    await postCronStep(appUrl, cronSecret, "scrape", "/api/cron/scrape")
  );
  results.push(
    await postCronStep(appUrl, cronSecret, "filter", "/api/cron/filter")
  );
  results.push(
    await postCronStep(appUrl, cronSecret, "enrich", "/api/cron/enrich")
  );

  if (shouldRunDigest()) {
    results.push(
      await postCronStep(appUrl, cronSecret, "digest", "/api/cron/digest")
    );
  } else {
    console.log(
      `[${nowIso()}] Skipping digest: today is not Monday in UTC.`
    );
  }

  console.log(`[${nowIso()}] Pipeline complete.`);
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${nowIso()}] Pipeline failed: ${message}`);
  process.exit(1);
});
