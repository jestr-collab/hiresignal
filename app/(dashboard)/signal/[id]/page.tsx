"use client";

import {
  daysAgoLabel,
  fundingSummary,
  outreachAngle,
  signalTypeLabel,
} from "@/lib/dashboard-utils";
import { supabase } from "@/lib/supabase";
import type { Company, Contact, Job, Signal } from "@/types";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type SignalWithCompany = Signal & { companies: Company | null };

export default function SignalDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Invalid signal id");
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: sigRow, error: sigErr } = await supabase
        .from("signals")
        .select("*, companies (*)")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;

      if (sigErr || !sigRow) {
        setError(sigErr?.message ?? "Signal not found");
        setSignal(null);
        setCompany(null);
        setJobs([]);
        setContacts([]);
        setLoading(false);
        return;
      }

      const row = sigRow as SignalWithCompany;
      const { companies: companyRow, ...sigOnly } = row;
      setSignal(sigOnly as Signal);
      setCompany(companyRow);

      const jobIds = (row.job_ids ?? []).filter(Boolean);
      if (jobIds.length > 0) {
        const { data: jobRows, error: jErr } = await supabase
          .from("jobs")
          .select("*")
          .in("id", jobIds);
        if (!jErr && jobRows) {
          setJobs(jobRows as Job[]);
        } else {
          setJobs([]);
        }
      } else {
        setJobs([]);
      }

      if (row.company_id) {
        const { data: contactRows, error: ctErr } = await supabase
          .from("contacts")
          .select("*")
          .eq("company_id", row.company_id)
          .order("enriched_at", { ascending: false });
        if (!ctErr && contactRows) {
          setContacts(contactRows as Contact[]);
        } else {
          setContacts([]);
        }
      } else {
        setContacts([]);
      }

      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) {
    return null;
  }

  if (loading) {
    return (
      <p className="text-sm text-neutral-500">Loading signal…</p>
    );
  }

  if (error || !signal || !company) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-700">{error ?? "Not found"}</p>
        <Link
          href="/"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Back to signals
        </Link>
      </div>
    );
  }

  const angle = outreachAngle(signal.signal_type);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          ← Signals
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">
          {company.name}
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          {signalTypeLabel(signal.signal_type)} · Score{" "}
          <span className="font-medium text-neutral-800">
            {signal.score ?? "—"}
          </span>
          · {daysAgoLabel(signal.detected_at)}
        </p>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Company
        </h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-neutral-500">Domain</dt>
            <dd className="font-medium text-neutral-900">{company.domain}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Size</dt>
            <dd className="text-neutral-900">{company.size_range ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Funding</dt>
            <dd className="text-neutral-900">
              {fundingSummary(
                company.funding_stage,
                company.funding_amount
              )}
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">LinkedIn</dt>
            <dd className="truncate text-neutral-900">
              {company.linkedin_url ? (
                <a
                  href={company.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Company page
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
        {signal.context ? (
          <p className="mt-4 border-t border-neutral-100 pt-4 text-sm text-neutral-700">
            {signal.context}
          </p>
        ) : null}
        {signal.why_it_matters ? (
          <p className="mt-3 text-sm text-neutral-500">{signal.why_it_matters}</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Jobs in this signal
        </h2>
        {jobs.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            No job rows linked (job_ids empty or jobs removed).
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100 text-sm">
            {jobs.map((j) => (
              <li key={j.id} className="py-2 first:pt-0 last:pb-0">
                <div className="font-medium text-neutral-900">{j.title}</div>
                <div className="text-xs text-neutral-500">
                  {[j.location, j.board].filter(Boolean).join(" · ") || "—"}
                </div>
                {j.job_url ? (
                  <a
                    href={j.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-blue-600 hover:underline"
                  >
                    Open posting
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Contacts
        </h2>
        {contacts.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">No contacts yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-neutral-100 text-sm">
            {contacts.map((c) => (
              <li key={c.id} className="py-3 first:pt-0 last:pb-0">
                <div className="font-medium text-neutral-900">
                  {[c.first_name, c.last_name].filter(Boolean).join(" ") ||
                    "—"}
                </div>
                {c.title ? (
                  <div className="text-neutral-600">{c.title}</div>
                ) : null}
                {c.email ? (
                  <div className="text-neutral-600">{c.email}</div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-blue-100 bg-blue-50/60 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-blue-900/70">
          Suggested outreach angle
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-blue-950">{angle}</p>
      </section>
    </div>
  );
}
