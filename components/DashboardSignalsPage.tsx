"use client";

import { ExportButton } from "@/components/ExportButton";
import type { FilterPreset, SignalFiltersState } from "@/components/SignalFilters";
import { SignalTable, type DashboardTableRow } from "@/components/SignalTable";
import { FILTER_SCORE_BANDS, isoDateDaysAgo } from "@/lib/dashboard-utils";
import { supabase } from "@/lib/supabase";
import type { Company, Contact, Signal } from "@/types";
import { useEffect, useMemo, useRef, useState } from "react";

type CompanyWithContacts = Company & { contacts?: Contact[] | null };

type SignalWithNested = Signal & {
  companies: CompanyWithContacts | null;
};

const TYPE_CHIPS: { key: string; label: string }[] = [
  { key: "sdr_team", label: "Outbound" },
  { key: "cro", label: "New exec" },
  { key: "sales_enablement", label: "Enablement" },
];

function confidencePriority(level: Signal["confidence_level"]): number {
  switch (level) {
    case "very_high":
      return 3;
    case "high":
      return 2;
    case "medium":
    default:
      return 1;
  }
}

function shouldReplaceForCompany(next: Signal, current: Signal): boolean {
  const nextConfidence = confidencePriority(next.confidence_level);
  const currentConfidence = confidencePriority(current.confidence_level);
  if (nextConfidence !== currentConfidence) {
    return nextConfidence > currentConfidence;
  }

  const nextScore = next.score ?? 0;
  const currentScore = current.score ?? 0;
  if (nextScore !== currentScore) {
    return nextScore > currentScore;
  }

  const nextDetectedAt = next.detected_at
    ? new Date(next.detected_at).getTime()
    : 0;
  const currentDetectedAt = current.detected_at
    ? new Date(current.detected_at).getTime()
    : 0;
  return nextDetectedAt > currentDetectedAt;
}

function pickPrimaryContact(contacts: Contact[]): Contact | null {
  if (contacts.length === 0) return null;
  const sorted = [...contacts].sort((a, b) => {
    const ta = a.enriched_at ? new Date(a.enriched_at).getTime() : 0;
    const tb = b.enriched_at ? new Date(b.enriched_at).getTime() : 0;
    return tb - ta;
  });
  return sorted[0] ?? null;
}

function splitHeadline(why: string | null | undefined): string | null {
  const line = (why ?? "")
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  return line ?? null;
}

function rowMatchesSearch(r: DashboardTableRow, q: string): boolean {
  const headline = splitHeadline(r.signal.why_it_matters);
  const c = r.contact;
  const name = c
    ? [c.first_name, c.last_name].filter(Boolean).join(" ")
    : "";
  const hay = [
    r.company.name,
    name,
    c?.title,
    c?.email,
    headline,
    r.signal.context,
    r.signal.signal_type.replace(/_/g, " "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function isWinnableRow(r: DashboardTableRow): boolean {
  if (r.company.size_range?.trim() === "500+") return false;
  if (!r.contact) return false;
  const cl = r.signal.confidence_level;
  if (cl !== "high" && cl !== "very_high") return false;
  return true;
}

export function DashboardSignalsPage() {
  const minWeekOf = useMemo(() => isoDateDaysAgo(28), []);
  const searchRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<DashboardTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<FilterPreset>("winnable");
  const [filters, setFilters] = useState<SignalFiltersState>({
    signalType: "",
    scoreBand: "",
    search: "",
    veryHighOnly: false,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: signals, error: sigErr } = await supabase
        .from("signals")
        .select("*, companies (*, contacts (*))")
        .gte("week_of", minWeekOf)
        .order("score", { ascending: false })
        .limit(50);

      if (cancelled) return;

      if (sigErr) {
        setError(sigErr.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const list = (signals ?? []) as SignalWithNested[];

      const bestByCompanyId = new Map<string, SignalWithNested>();
      for (const s of list) {
        if (!s.companies || !s.company_id) continue;
        const existing = bestByCompanyId.get(s.company_id);
        if (!existing || shouldReplaceForCompany(s, existing)) {
          bestByCompanyId.set(s.company_id, s);
        }
      }

      const built: DashboardTableRow[] = [];
      for (const s of Array.from(bestByCompanyId.values())) {
        if (!s.companies) continue;
        const { contacts: nestedContacts, ...companyFields } = s.companies;
        const company = companyFields as Company;
        const contact = pickPrimaryContact(nestedContacts ?? []);

        const { companies: _co, ...signalRest } = s;
        void _co;
        built.push({
          signal: signalRest as Signal,
          company,
          contact,
        });
      }

      built.sort((a, b) => {
        const confidenceDiff =
          confidencePriority(b.signal.confidence_level) -
          confidencePriority(a.signal.confidence_level);
        if (confidenceDiff !== 0) return confidenceDiff;
        return (b.signal.score ?? 0) - (a.signal.score ?? 0);
      });

      if (!cancelled) {
        setRows(built);
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [minWeekOf]);

  const winnableCount = useMemo(
    () => rows.filter((r) => isWinnableRow(r)).length,
    [rows]
  );

  const stats = useMemo(() => {
    const n = rows.length;
    const veryHigh = rows.filter(
      (r) => r.signal.confidence_level === "very_high"
    ).length;
    const avgScore =
      n > 0
        ? rows.reduce((a, r) => a + (r.signal.score ?? 0), 0) / n
        : 0;
    const contactsVerified = rows.filter((r) =>
      Boolean(r.contact?.email?.trim())
    ).length;
    return {
      activeSignals: n,
      veryHigh,
      avgScore,
      contactsVerified,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (preset === "winnable") {
        if (!isWinnableRow(r)) return false;
      }
      if (
        filters.signalType &&
        r.signal.signal_type !== filters.signalType
      ) {
        return false;
      }
      const sc = r.signal.score ?? 0;
      if (filters.scoreBand === "high" && sc < 80) return false;
      if (filters.scoreBand === "medium" && (sc < 60 || sc > 79)) {
        return false;
      }
      if (filters.search.trim()) {
        const q = filters.search.trim().toLowerCase();
        if (!rowMatchesSearch(r, q)) return false;
      }
      if (
        filters.veryHighOnly &&
        r.signal.confidence_level !== "very_high"
      ) {
        return false;
      }
      return true;
    });
  }, [rows, filters, preset]);

  function toggleSignalType(key: string) {
    setFilters((f) => ({
      ...f,
      signalType: f.signalType === key ? "" : key,
    }));
  }

  return (
    <div className="dash-page">
      <div className="dash-page-header">
        <div className="dash-page-title-block">
          <div className="dash-title-row">
            <h1>Signals</h1>
            <span className="dash-live-pill">
              <span className="dot" aria-hidden />
              Live
            </span>
          </div>
          <p className="dash-page-meta">
            Last 4 weeks (week_of ≥ {minWeekOf}) · up to 50 rows · one row per
            company
          </p>
        </div>
        <div className="dash-page-actions">
          <ExportButton
            rows={filtered}
            disabled={loading}
            className="btn btn-ghost"
          />
        </div>
      </div>

      <div className="dash-stats">
        <div className="dash-stat">
          <div className="dash-stat-label">Active signals</div>
          <div className="dash-stat-value">
            {stats.activeSignals}
            <span className="unit">signals</span>
          </div>
          <div className="dash-stat-trend muted">
            Last 4 weeks · week_of ≥ {minWeekOf}
          </div>
        </div>
        <button
          type="button"
          className={`dash-stat dash-stat--toggle${
            filters.veryHighOnly ? " is-active" : ""
          }`}
          onClick={() =>
            setFilters((f) => ({ ...f, veryHighOnly: !f.veryHighOnly }))
          }
          aria-pressed={filters.veryHighOnly}
        >
          <div className="dash-stat-label">Very high intent</div>
          <div className="dash-stat-value">
            {stats.veryHigh}
            {stats.activeSignals > 0 ? (
              <span className="unit">/ {stats.activeSignals}</span>
            ) : null}
          </div>
          <div className="dash-stat-trend muted">
            {filters.veryHighOnly
              ? "Showing very high only · click to clear"
              : "Click to filter table"}
          </div>
        </button>
        <div className="dash-stat">
          <div className="dash-stat-label">Avg. score</div>
          <div className="dash-stat-value">
            {stats.activeSignals > 0 ? stats.avgScore.toFixed(1) : "—"}
            <span className="unit">/100</span>
          </div>
          <div className="dash-stat-trend muted">Across loaded signals</div>
        </div>
        <div className="dash-stat">
          <div className="dash-stat-label">Contacts verified</div>
          <div className="dash-stat-value">{stats.contactsVerified}</div>
          <div className="dash-stat-trend muted">With email on file</div>
        </div>
      </div>

      <div className="dash-toolbar">
        <div className="dash-tabs" role="group" aria-label="View">
          <button
            type="button"
            className={`dash-tab${preset === "winnable" ? " is-active" : ""}`}
            onClick={() => setPreset("winnable")}
          >
            Winnable now
            <span className="count">{winnableCount}</span>
          </button>
          <button
            type="button"
            className={`dash-tab${preset === "all" ? " is-active" : ""}`}
            onClick={() => setPreset("all")}
          >
            All signals
            <span className="count">{rows.length}</span>
          </button>
        </div>

        <span className="dash-tb-divider" aria-hidden />

        {TYPE_CHIPS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`dash-filter${
              filters.signalType === key ? " is-active" : ""
            }`}
            onClick={() => toggleSignalType(key)}
          >
            <span>{label}</span>
          </button>
        ))}

        <select
          className="dash-filter-select"
          aria-label="Score band"
          value={filters.scoreBand}
          onChange={(e) =>
            setFilters((f) => ({ ...f, scoreBand: e.target.value }))
          }
        >
          {FILTER_SCORE_BANDS.map((o) => (
            <option key={o.value || "all-score"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <span className="dash-tb-divider" aria-hidden />

        <label className="dash-search">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path
              d="m20 20-3.5-3.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <input
            ref={searchRef}
            placeholder="Search companies, roles, contacts…"
            value={filters.search}
            onChange={(e) =>
              setFilters((f) => ({ ...f, search: e.target.value }))
            }
            type="search"
            autoComplete="off"
          />
          <span className="dash-kbd">⌘K</span>
        </label>
      </div>

      {error ? <div className="dash-error">{error}</div> : null}

      {loading ? (
        <div className="dash-loading" role="status" aria-live="polite">
          <div className="dash-spinner" aria-hidden />
          <p className="dash-page-meta">Loading signals…</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="dash-empty">
          No signals found — run the filter pipeline
        </div>
      ) : (
        <SignalTable rows={filtered} totalRowCount={rows.length} />
      )}
    </div>
  );
}
