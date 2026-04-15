import { config } from "dotenv";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const LEVER_JOBS_BASE = "https://jobs.lever.co";
const GREENHOUSE_API_BASE = "https://api.greenhouse.io/v1/boards";
const GREENHOUSE_BOARD_BASE = "https://boards.greenhouse.io";

const EXCLUDED_DOMAINS = new Set([
  "salesforce.com",
  "hubspot.com",
  "pipedrive.com",
  "outreach.io",
  "salesloft.com",
  "apollo.io",
  "gong.io",
  "chorus.ai",
  "clari.com",
  "zoominfo.com",
  "highspot.com",
  "showpad.com",
  "mindtickle.com",
  "aircall.io",
  "dialpad.com",
  "kixie.com",
  "orum.io",
  "lusha.com",
  "cognism.com",
  "leadiq.com",
  "clay.com",
  "lemlist.com",
  "reply.io",
  "klenty.com",
  "mailshake.com",
  "woodpecker.co",
  "mixmax.com",
  "yesware.com",
  "xactlycorp.com",
  "spiff.com",
  "captivateiq.com",
  "bombora.com",
  "6sense.com",
  "demandbase.com",
  "terminus.com",
  "rollworks.com",
  "ringdna.com",
  "five9.com",
  "nice.com",
  "vonage.com",
  "ringcentral.com",
  "talkdesk.com",
  "genesys.com",
]);

const DOMAIN_LIST_RAW = `
notion.so, linear.app, figma.com, canva.com,
miro.com, loom.com, calendly.com, typeform.com,
webflow.com, bubble.io, retool.com, glide.page,
zapier.com, make.com, tray.io, workato.com,
pagerduty.com, datadog.com, newrelic.com, dynatrace.com,
splunk.com, elastic.co, grafana.com, honeycomb.io,
segment.com, rudderstack.com, mparticle.com,
mixpanel.com, amplitude.com, heap.io, fullstory.com,
hotjar.com, contentsquare.com, mouseflow.com,
optimizely.com, launchdarkly.com, split.io,
pendo.io, appcues.com, userflow.com, chameleon.io,
intercom.com, drift.com, zendesk.com, freshdesk.com,
helpscout.com, kustomer.com, gorgias.com, gladly.com,
asana.com, monday.com, clickup.com, basecamp.com,
wrike.com, smartsheet.com, airtable.com, notion.so,
coda.io, fibery.io, height.app, linear.app,
github.com, gitlab.com, bitbucket.org, jira.atlassian.com,
figma.com, sketch.com, invision.com, zeplin.io,
miro.com, lucidchart.com, whimsical.com, mural.com,
loom.com, vidyard.com, wistia.com, vimeo.com,
calendly.com, savvycal.com, chili-piper.com,
typeform.com, surveymonkey.com, jotform.com,
stripe.com, braintree.com, recurly.com, chargebee.com,
zuora.com, maxio.com, chargify.com, paddle.com,
plaid.com, dwolla.com, modern-treasury.com, unit.co,
mercury.com, brex.com, ramp.com, divvy.com,
rippling.com, gusto.com, justworks.com, bamboohr.com,
lattice.com, culture-amp.com, leapsome.com, 15five.com,
betterworks.com, workday.com, adp.com, paychex.com,
docusign.com, hellosign.com, pandadoc.com, proposify.com,
box.com, dropbox.com, egnyte.com, sharefile.com,
okta.com, auth0.com, onelogin.com, ping.com,
crowdstrike.com, sentinelone.com, cybereason.com,
snyk.io, veracode.com, checkmarx.com, sonarqube.org,
dataiku.com, databricks.com, snowflake.com, dbt.com,
fivetran.com, stitch.com, airbyte.com, matillion.com,
looker.com, tableau.com, thoughtspot.com, sisense.com,
domo.com, qlik.com, microstrategy.com, power-bi.com,
algolia.com, elastic.co, coveo.com, lucidworks.com,
twilio.com, sendgrid.com, messagebird.com, vonage.com,
bandwidth.com, sinch.com, infobip.com, kaleyra.com,
pagerduty.com, opsgenie.com, victorops.com, statuspage.io,
cloudflare.com, fastly.com, akamai.com, imperva.com,
netlify.com, vercel.com, render.com, railway.app,
heroku.com, digitalocean.com, linode.com, vultr.com
`;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeDomain(raw: string | null | undefined): string {
  let d = (raw ?? "").trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.split("/")[0] ?? d;
  d = d.replace(/^www\./, "");
  return d;
}

function domainWithoutTld(domain: string): string {
  const d = normalizeDomain(domain);
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
  const push = (value: string) => {
    const v = value.trim();
    if (v) seen.add(v);
  };
  push(domainWithoutTld(domain));
  push(nameLowercaseNoSpaces(name));
  push(nameLowercaseWithHyphens(name));
  return Array.from(seen);
}

function greenhouseApiUrl(slug: string): string {
  return `${GREENHOUSE_API_BASE}/${encodeURIComponent(slug)}/jobs`;
}

function greenhouseBoardUrl(slug: string): string {
  return `${GREENHOUSE_BOARD_BASE}/${encodeURIComponent(slug)}`;
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
        "user-agent": "HireSignal-discover/1.0",
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
        "user-agent": "HireSignal-discover/1.0",
      },
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { jobs?: unknown };
    return Array.isArray(json.jobs);
  } catch {
    return false;
  }
}

function employeesToSizeRange(n: number | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  if (n <= 50) return "1-50";
  if (n <= 200) return "51-200";
  if (n <= 500) return "201-500";
  return "500+";
}

function displayNameFromDomain(domain: string): string {
  const first = domain.split(".")[0] ?? domain;
  return first
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function parseDomains(): string[] {
  return Array.from(
    new Set(
      DOMAIN_LIST_RAW.split(/[\s,]+/)
        .map((value) => normalizeDomain(value))
        .filter(Boolean)
    )
  );
}

async function findBoardUrls(
  domain: string,
  name: string
): Promise<{ greenhouse_url: string | null; lever_url: string | null }> {
  const slugs = slugVariations(domain, name);

  for (const slug of slugs) {
    if (await greenhouseSlugValid(slug)) {
      return {
        greenhouse_url: greenhouseBoardUrl(slug),
        lever_url: null,
      };
    }
  }

  for (const slug of slugs) {
    const candidate = leverBoardUrl(slug);
    if (await headOk(candidate)) {
      return {
        greenhouse_url: null,
        lever_url: candidate,
      };
    }
  }

  return { greenhouse_url: null, lever_url: null };
}

async function main() {
  const { data: existingRows, error: existingErr } = await supabase
    .from("companies")
    .select("domain");

  if (existingErr) {
    console.error(`Failed to load existing companies: ${existingErr.message}`);
    process.exit(1);
  }

  const existingDomains = new Set(
    (existingRows ?? [])
      .map((row) => normalizeDomain((row as { domain: string | null }).domain))
      .filter(Boolean)
  );

  let companiesAdded = 0;
  let companiesSkippedExcluded = 0;
  let companiesSkippedNoBoard = 0;
  const domains = parseDomains();

  for (const domain of domains) {
    const name = displayNameFromDomain(domain);

    if (EXCLUDED_DOMAINS.has(domain)) {
      companiesSkippedExcluded += 1;
      console.log(`[skipped] ${name}: excluded domain`);
      continue;
    }

    if (existingDomains.has(domain)) {
      console.log(`[skipped] ${name}: already exists`);
      continue;
    }

    const boards = await findBoardUrls(domain, name);
    if (!boards.greenhouse_url && !boards.lever_url) {
      companiesSkippedNoBoard += 1;
      console.log(`[skipped] ${name}: no valid board`);
      await sleep(120);
      continue;
    }

    const payload = {
      name,
      domain,
      greenhouse_url: boards.greenhouse_url,
      lever_url: boards.lever_url,
      size_range: "51-200" as const,
    };

    const { error: upsertErr } = await supabase
      .from("companies")
      .upsert(payload, { onConflict: "domain" });

    if (upsertErr) {
      console.log(`[skipped] ${name}: upsert failed (${upsertErr.message})`);
      continue;
    }

    existingDomains.add(domain);
    companiesAdded += 1;
    const boardUrl = boards.greenhouse_url ?? boards.lever_url ?? "";
    console.log(`[added] ${name}: ${boardUrl}`);
    await sleep(120);
  }

  console.log("");
  console.log(
    `Summary: ${companiesAdded} companies added, ${companiesSkippedExcluded} skipped (excluded), ${companiesSkippedNoBoard} skipped (no valid board)`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
