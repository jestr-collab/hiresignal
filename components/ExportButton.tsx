"use client";

import type { Company } from "@/types";
import {
  confidenceLabel,
  daysAgoLabel,
  escapeCsvCell,
  fundingSummary,
  mondayOfWeekLocalString,
} from "@/lib/dashboard-utils";
import type { DashboardTableRow } from "@/components/SignalTable";

function contactNameParts(c: DashboardTableRow["contact"]) {
  if (!c) return { name: "", title: "", email: "" };
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
  return {
    name: name || "",
    title: c.title ?? "",
    email: c.email ?? "",
  };
}

/** Prefer Greenhouse when both exist. */
function jobBoardUrl(company: Company): string {
  const g = company.greenhouse_url?.trim();
  const l = company.lever_url?.trim();
  if (g) return g;
  if (l) return l;
  return "";
}

function signalSummaryText(
  context: string | null | undefined,
  signalType: string
): string {
  if (context?.trim()) return context.trim();
  return `Hiring signal: ${signalType.replace(/_/g, " ")}`;
}

/** First line = Why Now; second line = Best fit (strip optional "Best fit:" prefix). */
function whyMattersParts(why: string | null | undefined): {
  whyNow: string;
  bestFit: string;
} {
  const lines = (why ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const whyNow = lines[0] ?? "";
  let bestFit = "";
  if (lines.length > 1) {
    const line = lines[1];
    bestFit = line.replace(/^Best fit:\s*/i, "").trim() || line;
  }
  return { whyNow, bestFit };
}

type Props = {
  rows: DashboardTableRow[];
  disabled?: boolean;
};

export function ExportButton({ rows, disabled }: Props) {
  function download() {
    const weekOf =
      rows[0]?.signal.week_of?.trim() || mondayOfWeekLocalString(new Date());

    const header = [
      "Company",
      "Size",
      "Signal",
      "Why Now",
      "Best Fit",
      "Score",
      "Confidence",
      "Job Board URL",
      "Contact Name",
      "Contact Title",
      "Email",
      "Funding",
      "Detected",
    ];
    const lines = [header.map(escapeCsvCell).join(",")];
    for (const { signal, company, contact } of rows) {
      const { name, title, email } = contactNameParts(contact);
      const { whyNow, bestFit } = whyMattersParts(signal.why_it_matters);
      const row = [
        company.name,
        company.size_range ?? "",
        signalSummaryText(signal.context, signal.signal_type),
        whyNow,
        bestFit,
        String(signal.score ?? ""),
        confidenceLabel(signal.confidence_level),
        jobBoardUrl(company),
        name,
        title,
        email,
        fundingSummary(company.funding_stage, company.funding_amount),
        daysAgoLabel(signal.detected_at),
      ].map((cell) => escapeCsvCell(cell ?? ""));
      lines.push(row.join(","));
    }
    const csv = lines.join("\r\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hiresignal-week-of-${weekOf}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={disabled || rows.length === 0}
      className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Export CSV
    </button>
  );
}
