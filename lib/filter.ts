export type SignalType =
  | "vp_sales"
  | "cro"
  | "sdr_team"
  | "ae_team"
  | "revops"
  | "sales_enablement"
  | "crm_admin";

export type SignalStrength = "high" | "medium" | "low";

export type JobClassification = {
  signal_type: SignalType;
  signal_strength: SignalStrength;
  base_score: number;
};

/**
 * Classifies a job title into a buying signal or null.
 * Rules are checked in priority order (first match wins).
 */
export function classifyJob(title: string): JobClassification | null {
  const trimmed = title.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();

  // cro: Chief Revenue, CRO, Chief Sales — score 95, high
  if (
    /\bcro\b/i.test(trimmed) ||
    lower.includes("chief revenue") ||
    lower.includes("chief sales")
  ) {
    return { signal_type: "cro", signal_strength: "high", base_score: 95 };
  }

  // vp_sales: VP Sales, VP of Sales, Head of Sales, Director of Sales — 85, high
  if (
    lower.includes("vp sales") ||
    lower.includes("vp of sales") ||
    lower.includes("head of sales") ||
    lower.includes("director of sales")
  ) {
    return { signal_type: "vp_sales", signal_strength: "high", base_score: 85 };
  }

  // revops: Revenue Operations, RevOps, Sales Operations, Sales Ops — 80, high
  if (
    lower.includes("revenue operations") ||
    lower.includes("revops") ||
    lower.includes("sales operations") ||
    /\bsales ops\b/i.test(lower)
  ) {
    return { signal_type: "revops", signal_strength: "high", base_score: 80 };
  }

  // sales_enablement — 75, high
  if (
    lower.includes("sales enablement") ||
    lower.includes("enablement manager")
  ) {
    return {
      signal_type: "sales_enablement",
      signal_strength: "high",
      base_score: 75,
    };
  }

  // crm_admin: CRM, Salesforce Admin, HubSpot Admin — 72, medium
  if (
    lower.includes("salesforce admin") ||
    lower.includes("hubspot admin") ||
    /\bcrm\b/i.test(lower)
  ) {
    return { signal_type: "crm_admin", signal_strength: "medium", base_score: 72 };
  }

  // sdr_team: SDR, BDR, Business Development Rep, Sales Development — 70, medium
  if (
    /\bsdr\b/i.test(trimmed) ||
    /\bbdr\b/i.test(trimmed) ||
    lower.includes("business development rep") ||
    lower.includes("sales development")
  ) {
    return { signal_type: "sdr_team", signal_strength: "medium", base_score: 70 };
  }

  // ae_team: Account Executive, AE, Account Manager — 65, medium
  if (
    lower.includes("account executive") ||
    /\bae\b/i.test(trimmed) ||
    lower.includes("account manager")
  ) {
    return { signal_type: "ae_team", signal_strength: "medium", base_score: 65 };
  }

  return null;
}

export function bestSignalStrength(
  strengths: SignalStrength[]
): SignalStrength {
  if (strengths.includes("high")) return "high";
  if (strengths.includes("medium")) return "medium";
  return "low";
}

const TYPE_CONTEXT_LABEL: Record<SignalType, string> = {
  vp_sales: "VP of Sales",
  cro: "CRO",
  sdr_team: "SDR",
  ae_team: "Account Executive",
  revops: "RevOps",
  sales_enablement: "Sales Enablement",
  crm_admin: "CRM",
};

/**
 * e.g. "Hiring 3 sales roles this week including VP of Sales and 2 SDRs"
 */
export function buildSignalContext(
  totalRoles: number,
  countsByType: Partial<Record<SignalType, number>>
): string {
  const parts: string[] = [];
  const entries = Object.entries(countsByType).filter(
    ([, n]) => n && n > 0
  ) as [SignalType, number][];

  for (const [type, count] of entries) {
    const label = TYPE_CONTEXT_LABEL[type] ?? type;
    if (count === 1) {
      parts.push(`1 ${label}`);
    } else {
      parts.push(`${count} ${label}s`);
    }
  }

  const including =
    parts.length === 0
      ? "multiple sales roles"
      : parts.length === 1
        ? parts[0]!
        : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;

  const roleWord = totalRoles === 1 ? "role" : "roles";
  return `Hiring ${totalRoles} sales ${roleWord} this week including ${including}`;
}

/** Bonus / penalty from company headcount bucket (CSV / enrichment). */
export function sizeRangeScoreAdjustment(sizeRange: string | null | undefined): number {
  switch (sizeRange?.trim()) {
    case "1-50":
      return 20;
    case "51-200":
      return 15;
    case "201-500":
      return 5;
    case "500+":
      return -15;
    default:
      return 0;
  }
}

export function capScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}

/**
 * True when SDR or RevOps hiring is small (≤2 roles) at a small company — "first hire" motion.
 */
export function isFirstBuilderHire(
  signalType: SignalType,
  jobCount: number,
  sizeRange: string | null | undefined
): boolean {
  if (signalType !== "sdr_team" && signalType !== "revops") return false;
  if (jobCount > 2) return false;
  const s = sizeRange?.trim() ?? "";
  return s === "1-50" || s === "51-200";
}

/** True when company is in the enterprise headcount bucket (stored on signals). */
export function computeEnterpriseFlag(
  sizeRange: string | null | undefined
): boolean {
  return sizeRange?.trim() === "500+";
}

/**
 * One-line narrative per signal row; priority order matches product messaging.
 */
export function computeWhyItMatters(
  signalType: SignalType,
  jobCount: number,
  sizeRange: string | null | undefined,
  countsByType: Partial<Record<SignalType, number>>
): string | null {
  const smallCo =
    sizeRange === "1-50" ||
    sizeRange === "51-200"; /* 1–200 employees */
  const hasSdr = (countsByType.sdr_team ?? 0) >= 1;
  const hasRev = (countsByType.revops ?? 0) >= 1;
  const bothSdrAndRev = hasSdr && hasRev;

  if (signalType === "cro") {
    return "New CRO hired — rebuilding sales stack, actively evaluating CRM and revenue tooling";
  }

  if (bothSdrAndRev && (signalType === "sdr_team" || signalType === "revops")) {
    return "Standing up first outbound motion — likely evaluating sales engagement platforms and CRM tooling";
  }

  if (signalType === "vp_sales" && smallCo) {
    return "Scaling sales org for first time — high intent buyer evaluating full GTM stack";
  }

  if (signalType === "ae_team" && jobCount >= 3) {
    return "Scaling outbound SDR team — likely evaluating sales engagement platforms and CRM tooling";
  }

  if (signalType === "revops" && !bothSdrAndRev) {
    return "Operationalizing revenue team — evaluating RevOps and CRM tooling";
  }

  if (signalType === "sdr_team" && !bothSdrAndRev) {
    return "Building outbound motion from scratch — evaluating sales engagement and sequencing tools";
  }

  if (signalType === "ae_team") {
    return "Expanding sales team — likely adding sales tooling to support growth";
  }

  return null;
}
