"use client";

import {
  FILTER_SCORE_BANDS,
  FILTER_SIGNAL_TYPES,
} from "@/lib/dashboard-utils";

export type FilterPreset = "all" | "winnable";

export type SignalFiltersState = {
  signalType: string;
  scoreBand: string;
  search: string;
};

type Props = {
  value: SignalFiltersState;
  onChange: (next: SignalFiltersState) => void;
  preset: FilterPreset;
  onPresetChange: (preset: FilterPreset) => void;
};

export function SignalFilters({
  value,
  onChange,
  preset,
  onPresetChange,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-neutral-600">View</span>
        <div
          className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100/80 p-0.5"
          role="group"
          aria-label="Signal view preset"
        >
          <button
            type="button"
            onClick={() => onPresetChange("all")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              preset === "all"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            All signals
          </button>
          <button
            type="button"
            onClick={() => onPresetChange("winnable")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              preset === "winnable"
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            Winnable now
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex min-w-[160px] flex-col gap-1 text-sm">
        <span className="text-neutral-500">Signal type</span>
        <select
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-neutral-900 shadow-sm focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
          value={value.signalType}
          onChange={(e) =>
            onChange({ ...value, signalType: e.target.value })
          }
        >
          {FILTER_SIGNAL_TYPES.map((o) => (
            <option key={o.value || "all"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[180px] flex-col gap-1 text-sm">
        <span className="text-neutral-500">Score</span>
        <select
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-neutral-900 shadow-sm focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
          value={value.scoreBand}
          onChange={(e) =>
            onChange({ ...value, scoreBand: e.target.value })
          }
        >
          {FILTER_SCORE_BANDS.map((o) => (
            <option key={o.value || "all-score"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm">
        <span className="text-neutral-500">Search company</span>
        <input
          type="search"
          placeholder="Filter by name…"
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-neutral-900 shadow-sm placeholder:text-neutral-400 focus:border-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
        />
      </label>
      </div>
    </div>
  );
}
