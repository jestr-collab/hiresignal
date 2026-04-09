"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  bestAngleForSignalType,
  daysAgoLabel,
  fundingSummary,
  scoreIntentClass,
} from "@/lib/dashboard-utils";
import type { Company, Contact, Signal } from "@/types";

export type DashboardTableRow = {
  signal: Signal;
  company: Company;
  contact: Contact | null;
};

type Props = {
  rows: DashboardTableRow[];
};

const COL_COUNT = 7;

function contactName(c: Contact | null): string {
  if (!c) return "—";
  const parts = [c.first_name, c.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

function isEnterpriseRow(row: DashboardTableRow): boolean {
  return Boolean(row.signal.enterprise_flag);
}

export function SignalTable({ rows }: Props) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyEmail = useCallback((email: string) => {
    void navigator.clipboard.writeText(email);
    setCopied(email);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const { nonEnterprise, enterprise } = useMemo(() => {
    const non: DashboardTableRow[] = [];
    const ent: DashboardTableRow[] = [];
    for (const r of rows) {
      if (isEnterpriseRow(r)) ent.push(r);
      else non.push(r);
    }
    return { nonEnterprise: non, enterprise: ent };
  }, [rows]);

  const showEnterpriseDivider =
    nonEnterprise.length > 0 && enterprise.length > 0;

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-200 bg-white px-6 py-12 text-center text-sm text-neutral-500">
        No signals match your filters for this week.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm">
      <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50 text-xs font-medium uppercase tracking-wide text-neutral-500">
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Signal</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Contact</th>
            <th className="px-4 py-3">Best angle</th>
            <th className="px-4 py-3">Funding</th>
            <th className="px-4 py-3">Detected</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {nonEnterprise.map(({ signal, company, contact }) => (
            <SignalTableRow
              key={signal.id}
              signal={signal}
              company={company}
              contact={contact}
              copied={copied}
              onCopyEmail={copyEmail}
            />
          ))}
          {showEnterpriseDivider ? (
            <tr className="bg-neutral-50/90">
              <td
                colSpan={COL_COUNT}
                className="border-y border-neutral-200 px-4 py-3 text-xs font-medium uppercase tracking-wide text-neutral-500"
              >
                Enterprise opportunities — longer sales cycles
              </td>
            </tr>
          ) : null}
          {enterprise.map(({ signal, company, contact }) => (
            <SignalTableRow
              key={signal.id}
              signal={signal}
              company={company}
              contact={contact}
              copied={copied}
              onCopyEmail={copyEmail}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

type RowProps = {
  signal: Signal;
  company: Company;
  contact: Contact | null;
  copied: string | null;
  onCopyEmail: (email: string) => void;
};

function SignalTableRow({
  signal,
  company,
  contact,
  copied,
  onCopyEmail,
}: RowProps) {
  const score = signal.score ?? 0;
  const email = contact?.email?.trim();
  return (
    <tr className="hover:bg-neutral-50/80">
      <td className="px-4 py-3 align-top">
        <Link
          href={`/signal/${signal.id}`}
          className="font-medium text-neutral-900 hover:underline"
        >
          {company.name}
        </Link>
        {company.size_range ? (
          <span className="ml-2 inline-block rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600">
            {company.size_range}
          </span>
        ) : null}
        {signal.enterprise_flag ? (
          <span className="ml-2 inline-block rounded border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-500">
            Enterprise · long cycle
          </span>
        ) : null}
      </td>
      <td className="max-w-xs px-4 py-3 align-top text-neutral-700">
        <div>
          {signal.context ?? signalTypeFallback(signal.signal_type)}
        </div>
        {signal.why_it_matters ? (
          <p className="mt-1.5 text-xs leading-snug text-neutral-500">
            {signal.why_it_matters}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3 align-top">
        <span
          className={`inline-flex rounded-md px-2.5 py-1 text-xs font-semibold tabular-nums ${scoreIntentClass(signal.score)}`}
        >
          {score}
        </span>
      </td>
      <td className="max-w-[220px] px-4 py-3 align-top text-neutral-700">
        {contact ? (
          <div className="space-y-0.5">
            <div className="font-medium text-neutral-900">
              {contactName(contact)}
            </div>
            {contact.title ? (
              <div className="text-xs text-neutral-500">{contact.title}</div>
            ) : null}
            {email ? (
              <button
                type="button"
                onClick={() => onCopyEmail(email)}
                className="block w-full truncate text-left text-xs text-blue-600 hover:underline"
                title="Copy email"
              >
                {copied === email ? "Copied!" : email}
              </button>
            ) : (
              <span className="text-xs text-neutral-400">No email</span>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <span className="text-neutral-400">—</span>
            <span className="inline-block rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] leading-tight text-neutral-500">
              No sales contact found
            </span>
          </div>
        )}
      </td>
      <td className="max-w-[220px] px-4 py-3 align-top text-sm text-neutral-700">
        {bestAngleForSignalType(signal.signal_type)}
      </td>
      <td className="max-w-[180px] px-4 py-3 align-top text-neutral-600">
        {fundingSummary(company.funding_stage, company.funding_amount)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top text-neutral-600">
        {daysAgoLabel(signal.detected_at)}
      </td>
    </tr>
  );
}

function signalTypeFallback(signalType: string): string {
  return `Signal: ${signalType.replace(/_/g, " ")}`;
}
