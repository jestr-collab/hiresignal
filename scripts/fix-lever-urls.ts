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

const LEVER_JOBS_BASE = "https://jobs.lever.co";

/** First label of the hostname, e.g. apollo.io → apollo */
function domainWithoutTld(domain: string): string {
  const d = domain.trim().toLowerCase();
  return (d.split(".")[0] ?? d).replace(/[^a-z0-9]/g, "");
}

function nameLowercaseNoSpaces(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function nameLowercaseWithHyphens(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function slugVariations(domain: string, name: string): string[] {
  const seen = new Set<string>();
  const push = (s: string) => {
    const v = s.trim();
    if (v.length > 0) seen.add(v);
  };
  push(domainWithoutTld(domain));
  push(nameLowercaseNoSpaces(name));
  push(nameLowercaseWithHyphens(name));
  return Array.from(seen);
}

function leverBoardUrl(slug: string): string {
  return `${LEVER_JOBS_BASE}/${encodeURIComponent(slug)}`;
}

async function headOk(targetUrl: string): Promise<boolean> {
  try {
    const res = await fetch(targetUrl, {
      method: "HEAD",
      redirect: "follow",
      headers: {
        "user-agent": "HireSignal-lever-url-fix/1.0",
      },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

type CompanyRow = {
  id: string;
  name: string;
  domain: string;
  lever_url: string | null;
};

async function main() {
  const { data: companies, error } = await supabase
    .from("companies")
    .select("id, name, domain, lever_url")
    .order("name");

  if (error) {
    console.error("Failed to load companies:", error.message);
    process.exit(1);
  }

  const list = (companies ?? []) as CompanyRow[];

  for (const company of list) {
    const { id, name, domain, lever_url: existing } = company;

    if (existing?.trim()) {
      const ok = await headOk(existing.trim());
      if (ok) {
        console.log(`[found] ${name}: existing Lever URL OK (${existing.trim()})`);
        continue;
      }
    }

    const slugs = slugVariations(domain, name);
    let matched: string | null = null;

    for (const slug of slugs) {
      const candidate = leverBoardUrl(slug);
      if (await headOk(candidate)) {
        matched = candidate;
        break;
      }
    }

    if (matched) {
      const { error: upErr } = await supabase
        .from("companies")
        .update({ lever_url: matched })
        .eq("id", id);

      if (upErr) {
        console.error(
          `[error] ${name}: found ${matched} but update failed: ${upErr.message}`
        );
        continue;
      }
      console.log(`[found] ${name}: updated → ${matched}`);
    } else {
      console.log(`[not found] ${name} (tried: ${slugs.join(", ")})`);
    }

    await new Promise((r) => setTimeout(r, 150));
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
