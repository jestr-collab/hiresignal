"use client";

import {
  daysAgoLabel,
  escapeCsvCell,
  fundingSummary,
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

type Props = {
  rows: DashboardTableRow[];
  disabled?: boolean;
};

export function ExportButton({ rows, disabled }: Props) {
  function download() {
    const header = [
      "Company",
      "Domain",
      "Signal",
      "Score",
      "Contact Name",
      "Contact Title",
      "Email",
      "Funding",
      "Detected",
    ];
    const lines = [header.map(escapeCsvCell).join(",")];
    for (const { signal, company, contact } of rows) {
      const { name, title, email } = contactNameParts(contact);
      const signalText =
        signal.context ??
        `Signal: ${signal.signal_type.replace(/_/g, " ")}`;
      const row = [
        company.name,
        company.domain,
        signalText,
        String(signal.score ?? ""),
        name,
        title,
        email,
        fundingSummary(company.funding_stage, company.funding_amount),
        daysAgoLabel(signal.detected_at),
      ].map((cell) => escapeCsvCell(cell ?? ""));
      lines.push(row.join(","));
    }
    const blob = new Blob([lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hiresignal-signals-${new Date().toISOString().slice(0, 10)}.csv`;
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
