import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey);
const GREENHOUSE_API_BASE = "https://api.greenhouse.io/v1/boards";

type CompanyRow = {
  id: string;
  name: string;
  greenhouse_url: string | null;
  lever_url: string | null;
};

function normalizeUrl(value: string | null | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

async function headOk(targetUrl: string): Promise<boolean> {
  try {
    const res = await fetch(targetUrl, {
      method: "HEAD",
      redirect: "follow",
      headers: {
        "user-agent": "HireSignal-validate-urls/1.0",
      },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

function extractGreenhouseSlug(
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

async function greenhouseUrlValid(targetUrl: string): Promise<boolean> {
  const slug = extractGreenhouseSlug(targetUrl);
  if (!slug) return false;

  try {
    const res = await fetch(
      `${GREENHOUSE_API_BASE}/${encodeURIComponent(slug)}/jobs`,
      {
        headers: {
          Accept: "application/json",
          "user-agent": "HireSignal-validate-urls/1.0",
        },
      }
    );
    if (!res.ok) return false;
    const json = (await res.json()) as { jobs?: unknown };
    return Array.isArray(json.jobs);
  } catch {
    return false;
  }
}

async function validateAndMaybeRemove(
  company: CompanyRow,
  column: "greenhouse_url" | "lever_url",
  currentUrl: string
): Promise<"valid" | "removed"> {
  const ok =
    column === "greenhouse_url"
      ? await greenhouseUrlValid(currentUrl)
      : await headOk(currentUrl);
  if (ok) {
    console.log(`[valid] ${company.name}: URL ok (${currentUrl})`);
    return "valid";
  }

  const { error } = await supabase
    .from("companies")
    .update({ [column]: null })
    .eq("id", company.id);

  if (error) {
    console.error(
      `[error] ${company.name}: failed to clear ${column}: ${error.message}`
    );
    process.exit(1);
  }

  console.log(`[removed] ${company.name}: dead URL (${currentUrl})`);
  return "removed";
}

async function main() {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, greenhouse_url, lever_url")
    .order("name");

  if (error) {
    console.error("Failed to load companies:", error.message);
    process.exit(1);
  }

  const companies = ((data ?? []) as CompanyRow[]).filter((company) => {
    return Boolean(
      normalizeUrl(company.greenhouse_url) || normalizeUrl(company.lever_url)
    );
  });

  let valid = 0;
  let removed = 0;

  for (const company of companies) {
    const greenhouseUrl = normalizeUrl(company.greenhouse_url);
    const leverUrl = normalizeUrl(company.lever_url);

    if (greenhouseUrl) {
      const result = await validateAndMaybeRemove(
        company,
        "greenhouse_url",
        greenhouseUrl
      );
      if (result === "valid") valid += 1;
      else removed += 1;
    }

    if (leverUrl) {
      const result = await validateAndMaybeRemove(
        company,
        "lever_url",
        leverUrl
      );
      if (result === "valid") valid += 1;
      else removed += 1;
    }
  }

  console.log(`Summary: ${valid} valid, ${removed} removed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
