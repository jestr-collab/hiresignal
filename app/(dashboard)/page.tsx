"use client";

import { ExportButton } from "@/components/ExportButton";
import {
  SignalFilters,
  type FilterPreset,
  type SignalFiltersState,
} from "@/components/SignalFilters";
import { SignalTable, type DashboardTableRow } from "@/components/SignalTable";
import { isoDateDaysAgo } from "@/lib/dashboard-utils";
import { supabase } from "@/lib/supabase";
import type { Company, Contact, Signal } from "@/types";
import { useEffect, useMemo, useState } from "react";

type CompanyWithContacts = Company & { contacts?: Contact[] | null };

type SignalWithNested = Signal & {
  companies: CompanyWithContacts | null;
};

function pickPrimaryContact(contacts: Contact[]): Contact | null {
  if (contacts.length === 0) return null;
  const sorted = [...contacts].sort((a, b) => {
    const ta = a.enriched_at ? new Date(a.enriched_at).getTime() : 0;
    const tb = b.enriched_at ? new Date(b.enriched_at).getTime() : 0;
    return tb - ta;
  });
  return sorted[0] ?? null;
}

function LoadingSpinner() {
  return (
    <div
      className="flex min-h-[220px] flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
    >
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-700"
        aria-hidden
      />
      <p className="text-sm text-neutral-500">Loading signals…</p>
    </div>
  );
}

export default function DashboardPage() {
  const minWeekOf = useMemo(() => isoDateDaysAgo(28), []);
  const [rows, setRows] = useState<DashboardTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<FilterPreset>("winnable");
  const [filters, setFilters] = useState<SignalFiltersState>({
    signalType: "",
    scoreBand: "",
    search: "",
  });

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

      const built: DashboardTableRow[] = [];
      const seenCompanyId = new Set<string>();
      for (const s of list) {
        if (!s.companies || !s.company_id) continue;
        if (seenCompanyId.has(s.company_id)) continue;
        seenCompanyId.add(s.company_id);

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

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (preset === "winnable") {
        if (r.company.size_range?.trim() === "500+") return false;
        if (!r.contact) return false;
      }
      if (
        filters.signalType &&
        r.signal.signal_type !== filters.signalType
      ) {
        return false;
      }
      const sc = r.signal.score ?? 0;
      if (filters.scoreBand === "high" && sc < 80) return false;
      if (
        filters.scoreBand === "medium" &&
        (sc < 60 || sc > 79)
      ) {
        return false;
      }
      if (filters.search.trim()) {
        const q = filters.search.trim().toLowerCase();
        if (!r.company.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, filters, preset]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-neutral-900">
            Signals
          </h1>
          <p className="text-sm text-neutral-500">
            Last 4 weeks (week_of ≥ {minWeekOf}) · up to 50 rows · one row per
            company
          </p>
        </div>
        <ExportButton rows={filtered} disabled={loading} />
      </div>
      <SignalFilters
        value={filters}
        onChange={setFilters}
        preset={preset}
        onPresetChange={setPreset}
      />
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      {loading ? <LoadingSpinner /> : <SignalTable rows={filtered} />}
    </div>
  );
}
