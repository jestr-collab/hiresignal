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

type ParsedArgs = {
  name: string;
  domain: string;
  url: string;
  size: string;
};

type ExistingCompany = {
  greenhouse_url: string | null;
  lever_url: string | null;
};

function usage(): string {
  return [
    'Usage: npm run add-company -- --name "Gong" --domain "gong.io" --url "https://jobs.lever.co/gong" --size "201-500"',
  ].join("\n");
}

function normalizeValue(value: string | undefined): string {
  return value?.trim() ?? "";
}

function normalizeDomain(raw: string): string {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.split("/")[0] ?? d;
  d = d.replace(/^www\./, "");
  return d;
}

function parseArgs(argv: string[]): ParsedArgs | null {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      out[key] = "";
      continue;
    }
    out[key] = value;
    i += 1;
  }

  const parsed: ParsedArgs = {
    name: normalizeValue(out.name),
    domain: normalizeDomain(normalizeValue(out.domain)),
    url: normalizeValue(out.url),
    size: normalizeValue(out.size),
  };

  if (!parsed.name || !parsed.domain || !parsed.url || !parsed.size) {
    return null;
  }
  return parsed;
}

async function headOk(targetUrl: string): Promise<boolean> {
  try {
    const res = await fetch(targetUrl, {
      method: "HEAD",
      redirect: "follow",
      headers: {
        "user-agent": "HireSignal-add-company/1.0",
      },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

function inferBoard(urlString: string): "greenhouse" | "lever" | null {
  try {
    const urlObj = new URL(urlString);
    const host = urlObj.hostname.toLowerCase();
    const href = urlObj.href.toLowerCase();

    if (
      host.includes("greenhouse.io") ||
      href.includes("job-boards.greenhouse.io")
    ) {
      return "greenhouse";
    }
    if (host.includes("jobs.lever.co") || href.includes("/lever/")) {
      return "lever";
    }
  } catch {
    return null;
  }
  return null;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed) {
    console.error(usage());
    process.exit(1);
  }

  const ok = await headOk(parsed.url);
  if (!ok) {
    console.error("URL returned 404, not added");
    process.exit(1);
  }

  const board = inferBoard(parsed.url);
  if (!board) {
    console.error("Could not infer board from URL. Use a Greenhouse or Lever URL.");
    process.exit(1);
  }

  const { data: existing, error: loadError } = await supabase
    .from("companies")
    .select("greenhouse_url, lever_url")
    .eq("domain", parsed.domain)
    .maybeSingle();

  if (loadError) {
    console.error("Failed to load existing company:", loadError.message);
    process.exit(1);
  }

  const prev = (existing ?? null) as ExistingCompany | null;
  const greenhouse_url =
    board === "greenhouse" ? parsed.url : prev?.greenhouse_url ?? null;
  const lever_url = board === "lever" ? parsed.url : prev?.lever_url ?? null;

  const payload = {
    name: parsed.name,
    domain: parsed.domain,
    greenhouse_url,
    lever_url,
    size_range: parsed.size,
  };

  const { error } = await supabase
    .from("companies")
    .upsert(payload, { onConflict: "domain" });

  if (error) {
    console.error(`Failed to upsert ${parsed.name}:`, error.message);
    process.exit(1);
  }

  console.log(`Added/updated ${parsed.name}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
