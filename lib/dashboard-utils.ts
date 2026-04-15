import type { ConfidenceLevel } from "@/types";

/** Calendar date `days` ago as YYYY-MM-DD (for `week_of` range filters). */
export function isoDateDaysAgo(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday (local) of the week containing `date`, as YYYY-MM-DD for `signals.week_of`. */
export function mondayOfWeekLocalString(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dayNum = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dayNum}`;
}

export function daysAgoLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export function scoreIntentClass(score: number | null | undefined): string {
  const s = score ?? 0;
  if (s >= 90) return "text-emerald-700 bg-emerald-50";
  if (s >= 70) return "text-amber-800 bg-amber-50";
  return "text-neutral-600 bg-neutral-100";
}

export function confidenceLabel(
  level: ConfidenceLevel | string | null | undefined
): string {
  switch (level) {
    case "very_high":
      return "Very high intent";
    case "high":
      return "High intent";
    case "medium":
    default:
      return "Medium intent";
  }
}

export function confidenceBadgeClass(
  level: ConfidenceLevel | string | null | undefined
): string {
  switch (level) {
    case "very_high":
      return "border border-[#F09595] bg-[#FCEBEB] text-[#A32D2D]";
    case "high":
      return "border border-[#EF9F27] bg-[#FAEEDA] text-[#854F0B]";
    case "medium":
    default:
      return "border-[0.5px] border-[#D7D3CA] bg-[#F1EFE8] text-[#5F5E5A]";
  }
}

export const FILTER_SIGNAL_TYPES = [
  { value: "", label: "All types" },
  { value: "vp_sales", label: "VP Sales" },
  { value: "revops", label: "RevOps" },
  { value: "sdr_team", label: "SDR Team" },
  { value: "cro", label: "CRO" },
] as const;

export const FILTER_SCORE_BANDS = [
  { value: "", label: "All scores" },
  { value: "high", label: "High intent (80+)" },
  { value: "medium", label: "Medium (60–79)" },
] as const;

export function signalTypeLabel(type: string): string {
  const map: Record<string, string> = {
    vp_sales: "VP Sales",
    cro: "CRO",
    sdr_team: "SDR Team",
    ae_team: "AE Team",
    revops: "RevOps",
    sales_enablement: "Sales Enablement",
    crm_admin: "CRM Admin",
  };
  return map[type] ?? type;
}

/** Short “best angle” line for the dashboard table (signal_type → outreach framing). */
export function bestAngleForSignalType(signalType: string): string {
  switch (signalType) {
    case "vp_sales":
    case "cro":
      return "Help them build a repeatable sales motion";
    case "sdr_team":
      return "Help SDR teams ramp faster with less tooling overhead";
    case "revops":
      return "Help them get their revenue stack in order";
    case "ae_team":
      return "Help AEs hit quota with better tooling";
    default:
      return "Help their growing sales team close more deals";
  }
}

export function outreachAngle(signalType: string): string {
  switch (signalType) {
    case "vp_sales":
      return "They are hiring senior sales leadership—position HireSignal as a way to prioritize outbound to companies in active sales build-out, timed to their new GTM motion.";
    case "cro":
      return "Revenue leadership hiring usually precedes broader pipeline investment. Lead with hiring-signal context and offer a tight pilot tied to their expansion goals.";
    case "sdr_team":
      return "SDR/BDR hiring signals outbound capacity. Emphasize efficiency: fewer wasted touches, better account prioritization, and faster ramp for new reps.";
    case "ae_team":
      return "AE hiring implies quota capacity and territory coverage. Pitch better territory planning and signal-based prospecting to fill new ramping seats.";
    case "revops":
      return "RevOps hires mean systems and process maturity. Frame HireSignal as feed into CRM workflows, reporting, and rep productivity—not another noisy list.";
    case "sales_enablement":
      return "Enablement investment suggests focus on rep effectiveness. Tie your outreach to onboarding, playbooks, and consistent messaging at scale.";
    case "crm_admin":
      return "CRM/admin hiring shows data hygiene and tooling priorities. Position integrations and clean, attributable signal into their stack.";
    default:
      return "They are actively growing the revenue org—lead with timely, specific hiring context and a clear next step (pilot scope, ICP overlap, or timeline).";
  }
}

export function fundingSummary(
  stage: string | null | undefined,
  amount: string | null | undefined
): string {
  const parts = [stage?.trim(), amount?.trim()].filter(Boolean);
  return parts.length ? parts.join(" · ") : "—";
}

export function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
