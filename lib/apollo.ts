const APOLLO_BASE = "https://api.apollo.io/api/v1";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiKey(): string | null {
  const k = process.env.APOLLO_API_KEY?.trim();
  return k || null;
}

/** Strip protocol/path and www. for Apollo domain params. */
export function normalizeApolloDomain(domain: string): string {
  let d = domain.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.split("/")[0] ?? d;
  d = d.replace(/^www\./, "");
  return d;
}

export type CompanyEnrichmentPatch = {
  size_range?: string | null;
  funding_stage?: string | null;
  funding_amount?: string | null;
  funding_date?: string | null;
  linkedin_url?: string | null;
};

function employeesToSizeRange(n: number | undefined): string | null {
  if (n == null || !Number.isFinite(n) || n <= 0) return null;
  if (n <= 50) return "1-50";
  if (n <= 200) return "51-200";
  if (n <= 500) return "201-500";
  return "500+";
}

function parseFundingDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  return value.slice(0, 10);
}

async function fetchWith429Retry(doFetch: () => Promise<Response>): Promise<Response> {
  let res = await doFetch();
  if (res.status === 429) {
    console.warn("[apollo] Rate limited (429), waiting 2s before retry");
    await sleep(2000);
    res = await doFetch();
  }
  return res;
}

/**
 * Organization enrichment (GET). Maps employee count, funding, LinkedIn into `companies` columns.
 * `size_range` is only filled when missing locally — CSV/seed values are not overwritten by Apollo.
 */
export async function enrichCompany(
  domain: string,
  existingSizeRange?: string | null
): Promise<CompanyEnrichmentPatch | null> {
  const key = getApiKey();
  if (!key) {
    console.warn("[apollo] APOLLO_API_KEY is not set — skipping enrichCompany");
    return null;
  }

  const d = normalizeApolloDomain(domain);
  if (!d) return null;

  const url = `${APOLLO_BASE}/organizations/enrich?domain=${encodeURIComponent(d)}`;

  try {
    const res = await fetchWith429Retry(() =>
      fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
          "X-Api-Key": key,
        },
      })
    );

    if (!res.ok) {
      console.warn(`[apollo] enrichCompany(${d}): HTTP ${res.status}`);
      return null;
    }

    const json = (await res.json()) as { organization?: Record<string, unknown> };
    const org = json.organization;
    if (!org) {
      return {};
    }

    const patch: CompanyEnrichmentPatch = {};
    const emp = org.estimated_num_employees;
    const hasLocalSize =
      existingSizeRange != null && String(existingSizeRange).trim() !== "";
    if (!hasLocalSize) {
      const size = employeesToSizeRange(
        typeof emp === "number" ? emp : undefined
      );
      if (size) patch.size_range = size;
    }

    if (typeof org.latest_funding_stage === "string" && org.latest_funding_stage) {
      patch.funding_stage = org.latest_funding_stage;
    }
    if (typeof org.total_funding_printed === "string" && org.total_funding_printed) {
      patch.funding_amount = org.total_funding_printed;
    } else if (typeof org.total_funding === "number" && org.total_funding > 0) {
      patch.funding_amount = String(org.total_funding);
    }

    const fd = parseFundingDate(org.latest_funding_round_date);
    if (fd) patch.funding_date = fd;

    if (typeof org.linkedin_url === "string" && org.linkedin_url) {
      patch.linkedin_url = org.linkedin_url;
    }

    return patch;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[apollo] enrichCompany(${d}): ${msg}`);
    return null;
  }
}

export type ApolloContactRow = {
  id?: string | null;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  seniority: string | null;
};

export function titlesForSignalType(signalType: string): string[] {
  switch (signalType) {
    case "vp_sales":
    case "cro":
      return [
        "CEO",
        "Chief Executive Officer",
        "CRO",
        "Chief Revenue Officer",
        "Chief Sales Officer",
        "VP Sales",
        "Vice President of Sales",
        "VP Revenue",
        "Vice President of Revenue",
      ];
    case "revops":
    case "crm_admin":
      return [
        "Revenue Operations",
        "RevOps",
        "VP Revenue Operations",
        "Sales Operations",
        "Director of Revenue Operations",
        "CRM Administrator",
        "Salesforce Administrator",
        "HubSpot Administrator",
      ];
    case "sdr_team":
    case "ae_team":
      return ["VP Sales", "Head of Sales", "Vice President of Sales"];
    case "sales_enablement":
      return [
        "VP Sales",
        "Head of Sales",
        "Sales Enablement",
        "Director of Sales Enablement",
      ];
    default:
      return ["VP Sales", "Head of Sales"];
  }
}

function inferSeniority(title: string | null): string | null {
  if (!title) return null;
  const t = title.toLowerCase();
  if (/\bchief\b|\bc[eost]o\b|\bcro\b/i.test(title)) return "c_suite";
  if (/\bvp\b|vice president/i.test(t)) return "vp";
  if (/director/i.test(t)) return "director";
  if (/manager|head of/i.test(t)) return "manager";
  return "manager";
}

function mapApolloPerson(p: Record<string, unknown>): ApolloContactRow | null {
  const nestedContact =
    p.contact && typeof p.contact === "object"
      ? (p.contact as Record<string, unknown>)
      : null;
  const id = typeof p.id === "string" ? p.id : null;
  const first =
    (typeof p.first_name === "string" && p.first_name) ||
    (typeof p.first_name_obfuscated === "string" && p.first_name_obfuscated) ||
    null;
  const last =
    (typeof p.last_name === "string" && p.last_name) ||
    (typeof p.last_name_obfuscated === "string" && p.last_name_obfuscated) ||
    null;
  const title = typeof p.title === "string" ? p.title : null;
  const email =
    (typeof p.email === "string" && p.email) ||
    (nestedContact && typeof nestedContact.email === "string"
      ? nestedContact.email
      : null);
  const linkedin_url =
    (typeof p.linkedin_url === "string" && p.linkedin_url) ||
    (typeof p.linkedin === "string" && p.linkedin) ||
    null;

  if (!first && !last && !title && !linkedin_url) {
    return null;
  }

  const seniorityRaw = typeof p.seniority === "string" ? p.seniority : null;
  const allowed = new Set(["vp", "director", "manager", "c_suite"]);
  const seniority =
    seniorityRaw && allowed.has(seniorityRaw)
      ? seniorityRaw
      : inferSeniority(title);

  return {
    id,
    first_name: first,
    last_name: last,
    title,
    email,
    linkedin_url,
    seniority,
  };
}

const APOLLO_PEOPLE_SEARCH_URL = "https://api.apollo.io/api/v1/mixed_people/api_search";
const APOLLO_PEOPLE_MATCH_URL = "https://api.apollo.io/api/v1/people/match";
let hasLoggedApolloRawResponse = false;
let hasLoggedApolloFirstContact = false;

/** Passes on substring alone — excludes "chief" (handled separately). */
const HUNTER_TITLE_STANDALONE_TERMS = [
  "sales",
  "revenue",
  "growth",
  "sdr",
  "bdr",
  "cro",
  "ceo",
  "founder",
] as const;

function titleHasStandaloneAllowlist(lower: string, t: string): boolean {
  if (
    /\bpresident\b/i.test(t) &&
    !/\bvice\s+president\b/i.test(lower)
  ) {
    return true;
  }
  return HUNTER_TITLE_STANDALONE_TERMS.some((term) => lower.includes(term));
}

/** "Chief" only counts with revenue/sales/exec/CEO/CRO — not Chief Product / Risk. */
function chiefPassesWithCombo(lower: string): boolean {
  if (!lower.includes("chief")) return false;
  return (
    lower.includes("revenue") ||
    lower.includes("sales") ||
    lower.includes("executive officer") ||
    lower.includes("ceo") ||
    lower.includes("cro")
  );
}

/** "VP" must pair with GTM terms — not VP Communications. */
const SALES_SPECIFIC_TITLE_TERMS = [
  "sales",
  "revenue",
  "growth",
  "sdr",
  "bdr",
  "cro",
  "business development",
  "account",
  "commercial",
] as const;

function titleHasSalesSpecificTerm(lower: string): boolean {
  return SALES_SPECIFIC_TITLE_TERMS.some((term) => lower.includes(term));
}

function vpPassesWithCombo(lower: string): boolean {
  if (!/\bvp\b/i.test(lower) && !/\bvice\s+president\b/i.test(lower)) {
    return false;
  }
  return titleHasSalesSpecificTerm(lower);
}

function headOfPassesWithCombo(lower: string, t: string): boolean {
  if (!/^head of\b/i.test(t)) return false;
  return (
    titleHasSalesSpecificTerm(lower) || chiefPassesWithCombo(lower)
  );
}

/** CEO / founder / company president — OK for 1–50 only; too senior for cold outreach at larger companies. */
function titleIsExcludedSeniorForMidMarket(lower: string, t: string): boolean {
  if (/\bceo\b/i.test(t)) return true;
  if (lower.includes("chief executive")) return true;
  if (/\bco[- ]?founders?\b/i.test(lower) || /\bcofounder\b/i.test(lower)) {
    return true;
  }
  if (/\bfounder\b/i.test(lower)) return true;
  if (/\bpresident\b/i.test(lower) && !/\bvice\s+president\b/i.test(lower)) {
    return true;
  }
  return false;
}

function isTinyCompanySize(sizeRange: string | null | undefined): boolean {
  return sizeRange?.trim() === "1-50";
}

/** Flat exclusion list that runs before allowlist logic. */
function titleMatchesFlatExclusion(lower: string, t: string): boolean {
  const blockedPhrases = [
    "software development",
    "engineering",
    "marketing",
    "finance",
    "product",
    "design",
    "data",
    "security",
    "legal",
    "procurement",
    "infrastructure",
    "communications",
    "brand",
    "people",
    "talent",
    "recruiting",
    "human resources",
    "people operations",
  ];
  if (blockedPhrases.some((term) => lower.includes(term))) return true;
  if (/\bit\b/i.test(t)) return true;
  if (/\bhr\b/i.test(t)) return true;
  return false;
}

/**
 * Allowlist + prefix rules. Chief and VP have extra constraints (see above).
 * Pass `companySizeRange` so CEO/founder/president titles are only kept for 1–50 headcount.
 */
export function contactTitlePassesHunterFilter(
  title: string | null,
  companySizeRange?: string | null
): boolean {
  if (!title || !title.trim()) return false;
  const t = title.trim();
  const lower = t.toLowerCase();

  if (titleMatchesFlatExclusion(lower, t)) return false;

  if (
    !isTinyCompanySize(companySizeRange) &&
    titleIsExcludedSeniorForMidMarket(lower, t)
  ) {
    return false;
  }

  if (/^director of sales\b/i.test(t)) return true;
  if (/^director of revenue\b/i.test(t)) return true;

  if (titleHasStandaloneAllowlist(lower, t)) return true;

  if (chiefPassesWithCombo(lower)) return true;

  if (headOfPassesWithCombo(lower, t)) return true;

  if (vpPassesWithCombo(lower)) return true;

  return false;
}

function extractPeopleOrContacts(
  json: unknown
): Record<string, unknown>[] | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const people = o.people;
  if (Array.isArray(people) && people.length > 0) {
    return people as Record<string, unknown>[];
  }
  const contacts = o.contacts;
  if (Array.isArray(contacts) && contacts.length > 0) {
    return contacts as Record<string, unknown>[];
  }
  return null;
}

function extractApolloPersonObject(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== "object") return null;
  const objectJson = json as Record<string, unknown>;
  const person = objectJson.person;
  if (person && typeof person === "object") {
    return person as Record<string, unknown>;
  }
  return objectJson;
}

async function revealApolloEmail(
  apiKey: string,
  contact: ApolloContactRow
): Promise<ApolloContactRow | null> {
  if (!contact.id) return contact;

  const body = {
    api_key: apiKey,
    id: contact.id,
    reveal_personal_emails: false,
    reveal_phone_number: false,
  };

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "X-Api-Key": apiKey,
  };

  try {
    const res = await fetchWith429Retry(() =>
      fetch(APOLLO_PEOPLE_MATCH_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })
    );

    const text = await res.text();
    if (!res.ok) {
      console.warn(
        `[apollo] reveal email failed id=${contact.id}: HTTP ${res.status} bodyFirst500=${JSON.stringify(text.slice(0, 500))}`
      );
      return contact;
    }

    let json: unknown;
    try {
      json = text.length ? JSON.parse(text) : null;
    } catch {
      console.warn(`[apollo] reveal email invalid JSON id=${contact.id}`);
      return contact;
    }

    const matched = extractApolloPersonObject(json);
    const mapped = matched ? mapApolloPerson(matched) : null;
    return mapped
      ? {
          ...contact,
          first_name: mapped.first_name ?? contact.first_name,
          last_name: mapped.last_name ?? contact.last_name,
          email: mapped.email ?? contact.email,
          title: mapped.title ?? contact.title,
          linkedin_url: mapped.linkedin_url ?? contact.linkedin_url,
          seniority: mapped.seniority ?? contact.seniority,
        }
      : contact;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[apollo] reveal email threw id=${contact.id}: ${msg}`);
    return contact;
  }
}

/**
 * Apollo People search. POST /api/v1/people/search.
 * Applies title filtering and returns up to 2 contacts.
 */
export async function findContacts(
  domain: string,
  signalType: string,
  companySizeRange?: string | null
): Promise<ApolloContactRow[]> {
  const key = getApiKey();
  if (!key) {
    console.warn("[apollo] APOLLO_API_KEY is not set — skipping findContacts");
    return [];
  }

  const d = normalizeApolloDomain(domain);
  if (!d) return [];

  const personTitles = titlesForSignalType(signalType);
  if (personTitles.length === 0) return [];

  const body = {
    api_key: key,
    q_organization_domains_list: [d],
    person_titles: personTitles,
    per_page: 5,
    contact_email_status_v2: ["verified", "unverified"],
    reveal_personal_emails: true,
    reveal_phone_number: false,
  };

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "X-Api-Key": key,
  };

  try {
    const res = await fetchWith429Retry(() =>
      fetch(APOLLO_PEOPLE_SEARCH_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })
    );

    const text = await res.text();
    let json: unknown;
    try {
      json = text.length ? JSON.parse(text) : null;
    } catch {
      console.warn(
        `[apollo] findContacts domain=${d}: invalid JSON (HTTP ${res.status})`
      );
      return [];
    }

    if (!hasLoggedApolloRawResponse) {
      hasLoggedApolloRawResponse = true;
      console.log("[apollo] raw response:", JSON.stringify(json).slice(0, 1000));
    }

    if (!res.ok) {
      console.warn(
        `[apollo] findContacts domain=${d}: HTTP ${res.status} bodyFirst500=${JSON.stringify(text.slice(0, 500))}`
      );
      return [];
    }

    const raw = extractPeopleOrContacts(json);
    if (!raw || raw.length === 0) {
      console.warn("[apollo] contacts found: 0");
      return [];
    }

    if (!hasLoggedApolloFirstContact) {
      hasLoggedApolloFirstContact = true;
      console.log(
        "[apollo] first contact raw:",
        JSON.stringify(raw[0] ?? null).slice(0, 500)
      );
    }

    const out: ApolloContactRow[] = [];
    for (const item of raw) {
      const row = mapApolloPerson(item);
      if (!row) continue;
      if (!contactTitlePassesHunterFilter(row.title, companySizeRange)) {
        continue;
      }
      out.push(row);
      if (out.length >= 2) break;
    }

    for (const row of out) {
      const hasEmailFlag =
        raw.find((item) => {
          const id = typeof item.id === "string" ? item.id : null;
          return id != null && id === row.id;
        })?.has_email === true;
      if (!hasEmailFlag) continue;

      const revealedContact = await revealApolloEmail(key, row);
      if (revealedContact) {
        row.first_name = revealedContact.first_name;
        row.last_name = revealedContact.last_name;
        row.email = revealedContact.email;
        row.title = revealedContact.title ?? row.title;
      }
      const name = [row.first_name, row.last_name].filter(Boolean).join(" ") || "unknown";
      console.warn(
        `[apollo] revealed email for ${name}: ${row.email ? "yes" : "no"}`
      );
    }

    console.warn(`[apollo] contacts found: ${out.length}`);
    return out;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[apollo] findContacts(${d}) threw: ${msg}`);
    console.warn("[apollo] contacts found: 0");
    return [];
  }
}
