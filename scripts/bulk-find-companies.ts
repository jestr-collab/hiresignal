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

const BOARDS_BASE = "https://boards.greenhouse.io";
const LEVER_JOBS_BASE = "https://jobs.lever.co";
const GREENHOUSE_API_BASE = "https://api.greenhouse.io/v1/boards";

/** Same as fix-greenhouse-urls.ts */
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

/** Derive a pseudo company name from the hostname (first label, hyphens → spaces). */
function syntheticNameFromDomain(domain: string): string {
  const first = domain.trim().toLowerCase().split(".")[0] ?? "";
  return first.replace(/[-_]/g, " ").trim();
}

/** Same slug set as fix-greenhouse-urls / fix-lever-urls (domain + name-style variants). */
function slugVariations(domain: string): string[] {
  const name = syntheticNameFromDomain(domain);
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

function greenhouseBoardUrl(slug: string): string {
  return `${BOARDS_BASE}/${encodeURIComponent(slug)}`;
}

function greenhouseApiUrl(slug: string): string {
  return `${GREENHOUSE_API_BASE}/${encodeURIComponent(slug)}/jobs`;
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
        "user-agent": "HireSignal-bulk-find/1.0",
      },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function greenhouseSlugValid(slug: string): Promise<boolean> {
  try {
    const res = await fetch(greenhouseApiUrl(slug), {
      headers: {
        Accept: "application/json",
        "user-agent": "HireSignal-bulk-find/1.0",
      },
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { jobs?: unknown };
    return Array.isArray(json.jobs);
  } catch {
    return false;
  }
}

function normalizeDomain(raw: string): string {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.split("/")[0] ?? d;
  d = d.replace(/^www\./, "");
  return d;
}

function displayNameFromDomain(domain: string): string {
  const first = domain.split(".")[0] ?? domain;
  return first
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

const DOMAIN_LIST_RAW = `
salescookie.com, salesrabbit.com, insidesales.com, xant.ai,
frontspin.com, natterbox.com, kixie.com, orum.io,
ringdna.com, revenue.io, execvision.io, refract.ai,
modjo.fr, jiminny.com, wingman.app, salto.io,
avoma.com, fireflies.ai, grain.com, tldv.io,
fathom.video, sembly.ai, meetgeek.io, notta.ai,
rewatch.com, descript.com, riverside.fm, squadcast.fm,
zencastr.com, buzzsprout.com, transistor.fm, simplecast.com,
captivate.fm, podbean.com, spreaker.com, anchor.fm,
panopto.com, kaltura.com, brightcove.com, vidyard.com,
wistia.com, vimeo.com, dubb.com, bonjoro.com,
sendspark.com, covideo.com, hippo.video, playplay.com,
demostack.com, reprise.com, navattic.com, tourial.com,
storylane.io, walnut.io, consensus.com, vivun.com,
trumpet.app, dealpad.com, goconsensus.com, recapped.io,
aligned.me, valuecore.io, pandadoc.com, proposify.com,
qwilr.com, better-proposals.com, loopio.com, responsive.io,
rfpio.com, expedience.com, ombud.com, loopio.com,
docusign.com, hellosign.com, adobe.com, dropbox.com,
box.com, sharepoint.com, egnyte.com, onehub.com,
sharefile.com, accellion.com, kiteworks.com, intralinks.com,
firmex.com, merrill.com, datasite.com, ansarada.com,
ideals.com, digify.com, docurex.com, clinked.com,
glasscubes.com, boardpaq.com, diligent.com, boardvantage.com,
nasdaq.com, computershare.com, equiniti.com, broadridge.com
`;

function parseDomains(): string[] {
  return Array.from(
    new Set(
      DOMAIN_LIST_RAW.split(/[\s,]+/)
    .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.toLowerCase())
    )
  );
}

async function main() {
  const domains = parseDomains();
  let newCompaniesAdded = 0;

  for (const raw of domains) {
    const domain = normalizeDomain(raw);
    if (!domain) continue;

    const slugs = slugVariations(domain);
    let greenhouseUrl: string | null = null;
    let leverUrl: string | null = null;

    for (const slug of slugs) {
      if (await greenhouseSlugValid(slug)) {
        greenhouseUrl = greenhouseBoardUrl(slug);
        break;
      }
    }

    for (const slug of slugs) {
      const candidate = leverBoardUrl(slug);
      if (await headOk(candidate)) {
        leverUrl = candidate;
        break;
      }
    }

    if (!greenhouseUrl && !leverUrl) {
      console.log(`[not found] ${domain}`);
      await new Promise((r) => setTimeout(r, 120));
      continue;
    }

    const { data: existing } = await supabase
      .from("companies")
      .select("id, greenhouse_url, lever_url")
      .eq("domain", domain)
      .maybeSingle();

    const ex = existing as
      | { id: string; greenhouse_url: string | null; lever_url: string | null }
      | null;

    const name = displayNameFromDomain(domain);
    const greenhouseFinal = greenhouseUrl ?? ex?.greenhouse_url ?? null;
    const leverFinal = leverUrl ?? ex?.lever_url ?? null;

    const payload = {
      name,
      domain,
      greenhouse_url: greenhouseFinal,
      lever_url: leverFinal,
      size_range: "51-200" as const,
    };

    const { error } = await supabase
      .from("companies")
      .upsert(payload, { onConflict: "domain" });

    if (error) {
      console.error(`[error] ${domain}: ${error.message}`);
      continue;
    }

    const parts: string[] = [];
    if (greenhouseUrl) parts.push(`GH`);
    if (leverUrl) parts.push(`Lever`);
    console.log(`[found] ${domain} (${parts.join(" + ")})`);

    if (!ex) {
      newCompaniesAdded += 1;
    }

    await new Promise((r) => setTimeout(r, 120));
  }

  console.log("");
  console.log(`Summary: ${newCompaniesAdded} new companies added`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
