"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  bestAngleForSignalType,
  companyInitials,
  daysAgoLabel,
  fundingSummary,
  intentTagShort,
} from "@/lib/dashboard-utils";
import type { Company, Contact, Signal } from "@/types";

export type DashboardTableRow = {
  signal: Signal;
  company: Company;
  contact: Contact | null;
};

type Props = {
  rows: DashboardTableRow[];
  /** Total companies in view before list filters (for footer “of N”). */
  totalRowCount: number;
};

function contactName(c: Contact | null): string {
  if (!c) return "—";
  const parts = [c.first_name, c.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

function isEnterpriseRow(row: DashboardTableRow): boolean {
  return Boolean(row.signal.enterprise_flag);
}

function splitWhyItMatters(value: string | null | undefined): {
  headline: string | null;
  bestFit: string | null;
} {
  const lines = (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    headline: lines[0] ?? null,
    bestFit: lines[1] ?? null,
  };
}

function bestFitPillText(value: string | null): string | null {
  if (!value) return null;
  return value.startsWith("Best fit:") ? value : `Best fit: ${value}`;
}

function intentClass(level: Signal["confidence_level"]): string {
  switch (level) {
    case "very_high":
      return "dash-intent-vh";
    case "high":
      return "dash-intent-h";
    case "medium":
    default:
      return "dash-intent-m";
  }
}

function useMeterInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, inView] as const;
}

function signalTypeFallback(signalType: string): string {
  return signalType.replace(/_/g, " ");
}

export function SignalTable({ rows, totalRowCount }: Props) {
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
      <div className="dash-table-wrap">
        <div className="dash-empty dash-empty--in-table">
          No signals match your filters for this week.
        </div>
      </div>
    );
  }

  return (
    <div className="dash-table-wrap">
      <div className="dash-th-row">
        <span className="dash-th">Company</span>
        <span className="dash-th">Signal</span>
        <span className="dash-th">Score</span>
        <span className="dash-th">Contact</span>
        <span className="dash-th">Funding</span>
        <span className="dash-th">Detected</span>
        <span />
      </div>
      {nonEnterprise.map(({ signal, company, contact }, i) => (
        <SignalGridRow
          key={signal.id}
          signal={signal}
          company={company}
          contact={contact}
          copied={copied}
          onCopyEmail={copyEmail}
          index={i}
        />
      ))}
      {showEnterpriseDivider ? (
        <div className="dash-enterprise-label">
          Enterprise opportunities — longer sales cycles
        </div>
      ) : null}
      {enterprise.map(({ signal, company, contact }, i) => (
        <SignalGridRow
          key={signal.id}
          signal={signal}
          company={company}
          contact={contact}
          copied={copied}
          onCopyEmail={copyEmail}
          index={nonEnterprise.length + i}
        />
      ))}
      <div className="dash-list-foot">
        Showing {rows.length} of {totalRowCount}
        {rows.length < totalRowCount
          ? " · Adjust filters to see more"
          : null}
      </div>
    </div>
  );
}

type RowProps = {
  signal: Signal;
  company: Company;
  contact: Contact | null;
  copied: string | null;
  onCopyEmail: (email: string) => void;
  index: number;
};

function SignalGridRow({
  signal,
  company,
  contact,
  copied,
  onCopyEmail,
  index,
}: RowProps) {
  const router = useRouter();
  const [meterRef, meterInView] = useMeterInView();
  const score = signal.score ?? 0;
  const email = contact?.email?.trim();
  const { headline, bestFit } = splitWhyItMatters(signal.why_it_matters);
  const bestFitText = bestFitPillText(bestFit);
  const angle = bestAngleForSignalType(signal.signal_type);
  const detected = daysAgoLabel(signal.detected_at);
  const fresh = detected === "Today";

  const go = () => {
    router.push(`/signal/${signal.id}`);
  };

  return (
    <div
      className="dash-row"
      style={{ animationDelay: `${index * 40}ms` }}
      role="link"
      tabIndex={0}
      onClick={go}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          go();
        }
      }}
    >
      <div className="dash-col-co">
        <div className="dash-co-logo" aria-hidden>
          {companyInitials(company.name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="dash-co-name">{company.name}</div>
          {company.size_range ? (
            <span className="dash-co-size">{company.size_range}</span>
          ) : null}
          {signal.enterprise_flag ? (
            <span className="dash-ent-badge">Enterprise · long cycle</span>
          ) : null}
        </div>
      </div>

      <div className="dash-col-signal">
        {headline ? (
          <div className="dash-signal-head">{headline}</div>
        ) : null}
        {bestFitText ? (
          <div className="dash-signal-fit">
            <svg
              className="icon"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {bestFitText}
          </div>
        ) : null}
        <div className="dash-signal-meta">
          {signal.context ?? signalTypeFallback(signal.signal_type)}
        </div>
      </div>

      <div className="dash-col-score" ref={meterRef}>
        <div className="dash-score-top">
          <span className="dash-score-big">{score}</span>
          {signal.confidence_level ? (
            <span
              className={`dash-intent-tag ${intentClass(signal.confidence_level)}`}
            >
              {intentTagShort(signal.confidence_level)}
            </span>
          ) : null}
        </div>
        <div className="dash-score-meter">
          <span
            className="dash-score-meter-fill"
            style={{ width: meterInView ? `${Math.min(100, score)}%` : "0%" }}
          />
        </div>
      </div>

      <div className="dash-col-contact">
        {contact ? (
          <>
            <div className="dash-contact-name">{contactName(contact)}</div>
            {contact.title ? (
              <div className="dash-contact-role">{contact.title}</div>
            ) : null}
            {email ? (
              <button
                type="button"
                className="dash-contact-email"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyEmail(email);
                }}
              >
                {copied === email ? "Copied!" : email}
              </button>
            ) : (
              <span className="dash-muted" style={{ fontSize: 12 }}>
                No email
              </span>
            )}
            <div className="dash-angle">{angle}</div>
          </>
        ) : (
          <>
            <span className="dash-muted">—</span>
            <div
              className="dash-signal-fit"
              style={{ marginTop: 6, fontSize: 10 }}
            >
              No sales contact found
            </div>
            <div className="dash-angle">{angle}</div>
          </>
        )}
      </div>

      <div className="dash-col-funding">
        {fundingSummary(company.funding_stage, company.funding_amount) ===
        "—" ? (
          <span className="dash-muted">—</span>
        ) : (
          fundingSummary(company.funding_stage, company.funding_amount)
        )}
      </div>

      <div className={`dash-col-detected${fresh ? " fresh" : ""}`}>
        {detected}
      </div>

      <div className="dash-row-arrow" aria-hidden>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </div>
  );
}
