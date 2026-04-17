"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { confidenceBadgeClass } from "@/lib/dashboard-utils";

function useSmoothScroll() {
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = "smooth";
    return () => {
      html.style.scrollBehavior = prev;
    };
  }, []);
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function IconPerson({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconBolt({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function Avatar({ initials }: { initials: string }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#16A34A] text-xs font-semibold text-white">
      {initials}
    </div>
  );
}

function ProductSignalCard({
  company,
  sizeRange,
  headline,
  bestFit,
  hiring,
  initials,
  contactName,
  contactTitle,
  contactEmail,
}: {
  company: string;
  sizeRange: string;
  headline: string;
  bestFit: string;
  hiring: string;
  initials: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
}) {
  return (
    <article className="rounded-xl border border-[#F3F4F6] bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-[#0A0A0A]">{company}</span>
          <span className="inline-flex rounded-md bg-[#F3F4F6] px-2 py-0.5 text-xs font-medium text-[#6B7280]">
            {sizeRange}
          </span>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none ${confidenceBadgeClass("very_high")}`}
        >
          Very high intent
        </span>
      </div>
      <p className="text-[17px] font-semibold leading-snug tracking-tight text-[#0A0A0A]">
        {headline}
      </p>
      <span className="mt-2 inline-block rounded-full bg-[#DCFCE7] px-2.5 py-1 text-xs font-medium text-[#16A34A]">
        Best fit: {bestFit}
      </span>
      <p className="mt-3 text-xs leading-relaxed text-[#6B7280]">{hiring}</p>
      <div className="my-5 h-px bg-[#F3F4F6]" aria-hidden />
      <div className="flex gap-3">
        <Avatar initials={initials} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#0A0A0A]">{contactName}</p>
          <p className="mt-0.5 text-xs text-[#6B7280]">{contactTitle}</p>
          <a
            href={`mailto:${contactEmail}`}
            className="mt-1 block truncate text-xs font-medium text-[#16A34A] underline-offset-2 hover:underline"
          >
            {contactEmail}
          </a>
        </div>
      </div>
    </article>
  );
}

export function LandingPage() {
  useSmoothScroll();

  return (
    <div className="min-h-screen bg-[#FFFFFF] font-sans text-[#0A0A0A] antialiased">
      {/* Section 1 — Announcement */}
      <Link
        href="/sign-up"
        className="block bg-[#0A0A0A] px-4 py-2.5 text-center text-[11px] font-medium uppercase tracking-[0.12em] text-white transition hover:bg-[#171717]"
      >
        Early access pricing — $199/month for founding members · Spots limited
        →
      </Link>

      {/* Section 2 — Navbar */}
      <header className="sticky top-0 z-50 border-b border-[#F3F4F6] bg-[#FFFFFF]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-bold tracking-tight text-[#0A0A0A] sm:text-lg"
          >
            <Image
              src="/logo.png"
              alt="HireSignal"
              width={1536}
              height={1024}
              className="h-16 w-auto shrink-0 object-contain"
              sizes="128px"
              quality={100}
              priority
            />
            HireSignal
          </Link>
          <div className="flex shrink-0 gap-2 sm:gap-3">
            <Link
              href="/sign-in"
              className="rounded-lg border border-[#0A0A0A] bg-white px-3 py-2 text-sm font-semibold text-[#0A0A0A] transition hover:bg-[#F9FAFB] sm:px-4"
            >
              Log in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-[#0A0A0A] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#262626] sm:px-4"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Section 3 — Hero */}
        <section className="px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mb-8 inline-flex items-center gap-2 rounded-full bg-[#DCFCE7] px-3.5 py-1.5 text-xs font-semibold text-[#16A34A]">
              <span className="text-[10px]" aria-hidden>
                ●
              </span>
              Live signals updated weekly
            </p>
            <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-[#0A0A0A] sm:text-5xl md:text-6xl md:leading-[1.02]">
              <span className="block">Your next customer</span>
              <span className="block">just posted a job.</span>
              <span className="mt-2 block font-medium text-[#6B7280]">
                You&apos;re not calling them yet.
              </span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-[#6B7280] sm:text-lg sm:leading-relaxed">
              Every week, B2B SaaS companies hire VP Sales, build SDR teams, and
              bring in CROs. That&apos;s when they buy tools. HireSignal finds
              them automatically — scores them, ranks them, and hands you the
              right contact before your competitors notice.
            </p>
            <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center rounded-lg bg-[#0A0A0A] px-8 py-4 text-sm font-semibold text-white transition hover:bg-[#262626] sm:text-base"
              >
                Start free trial
              </Link>
              <a
                href="#product"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#0A0A0A] bg-white px-8 py-4 text-sm font-semibold text-[#0A0A0A] transition hover:bg-[#F9FAFB] sm:text-base"
              >
                See how it works
                <span aria-hidden>→</span>
              </a>
            </div>
            <p className="mt-8 text-center text-xs text-[#6B7280]">
              14-day free trial · No credit card required · Cancel anytime
            </p>
          </div>
        </section>

        {/* Section 4 — Product mock */}
        <section
          id="product"
          className="scroll-mt-24 border-t border-[#F3F4F6] bg-[#F9FAFB] px-4 py-20 sm:px-6 sm:py-28"
        >
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <p className="inline-flex rounded-full bg-[#DCFCE7] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#16A34A]">
                What you get every Monday
              </p>
              <h2 className="mt-6 text-3xl font-bold tracking-tight text-[#0A0A0A] sm:text-4xl">
                Monday morning clarity.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-[#6B7280] sm:text-lg">
                Open your inbox and know exactly who to call this week and why.
              </p>
            </div>
            <div className="mt-14 grid gap-6 lg:grid-cols-2 lg:gap-8">
              <ProductSignalCard
                company="Brex"
                sizeRange="201-500"
                headline="New CRO hired → rebuilding sales stack (30 days)"
                bestFit="CRM, revenue intelligence, forecasting tools"
                hiring="Hiring 39 sales roles this week including 17 AEs, 1 CRO, 12 SDRs, 4 Sales Enablements"
                initials="GM"
                contactName="Garrett Marker"
                contactTitle="Chief Revenue Officer"
                contactEmail="garrett@brex.com"
              />
              <ProductSignalCard
                company="Intercom"
                sizeRange="51-200"
                headline="Standing up outbound from scratch → buying sales tools now (30 days)"
                bestFit="Sales engagement / sequencing (Outreach, Salesloft, Apollo)"
                hiring="Hiring 31 sales roles this week including 20 AEs, 7 SDRs, 1 RevOps"
                initials="MK"
                contactName="Megan Killion"
                contactTitle="Head of Sales, Americas"
                contactEmail="megan.killion@intercom.io"
              />
            </div>
            <p className="mt-10 text-center text-sm text-[#6B7280]">
              + 23 more signals in this week&apos;s feed
            </p>
          </div>
        </section>

        {/* Section 5 — Value props */}
        <section className="border-t border-[#F3F4F6] bg-[#FFFFFF] px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-6xl">
            <p className="text-center text-[11px] font-bold uppercase tracking-[0.16em] text-[#16A34A]">
              Why HireSignal
            </p>
            <div className="mt-14 grid gap-12 sm:grid-cols-3 sm:gap-10 lg:gap-14">
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[#F3F4F6] bg-[#F9FAFB] text-[#0A0A0A]">
                  <IconCalendar className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#0A0A0A]">
                  Monday morning clarity
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#6B7280]">
                  Open your inbox and know exactly who to call this week and why.
                  No more spending mornings hunting for prospects.
                </p>
              </div>
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[#F3F4F6] bg-[#F9FAFB] text-[#0A0A0A]">
                  <IconPerson className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#0A0A0A]">
                  VP-level contacts, verified
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#6B7280]">
                  Every signal includes the name, title, and real email of the
                  person who owns the budget. Not a generic inbox.
                </p>
              </div>
              <div>
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[#F3F4F6] bg-[#F9FAFB] text-[#0A0A0A]">
                  <IconBolt className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-bold text-[#0A0A0A]">
                  Walk in prepared
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#6B7280]">
                  We tell you what they&apos;re evaluating, why now, and the
                  exact angle to use. Show up to every call knowing more than they
                  expect.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6 — How it works */}
        <section className="border-t border-[#F3F4F6] bg-[#F9FAFB] px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-6xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-[#0A0A0A] sm:text-4xl">
              Set it and forget it.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-[#6B7280] sm:text-lg">
              HireSignal runs in the background so you don&apos;t have to.
            </p>
          </div>
          <div className="mx-auto mt-16 grid max-w-6xl gap-12 md:grid-cols-3 md:gap-8 lg:gap-12">
            <div>
              <p className="text-5xl font-bold leading-none text-[#E5E7EB] sm:text-6xl">
                01
              </p>
              <h3 className="mt-4 text-lg font-bold text-[#0A0A0A]">
                We scan 100+ job boards nightly
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#6B7280]">
                Every night we check hiring activity across B2B SaaS companies
                — flagging VP Sales hires, SDR buildouts, RevOps additions, and
                CRO appointments.
              </p>
            </div>
            <div>
              <p className="text-5xl font-bold leading-none text-[#E5E7EB] sm:text-6xl">
                02
              </p>
              <h3 className="mt-4 text-lg font-bold text-[#0A0A0A]">
                Signals are scored and ranked
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#6B7280]">
                Companies are ranked by intent level, size, and signal strength.
                The most winnable targets rise to the top — enterprise noise sinks.
              </p>
            </div>
            <div>
              <p className="text-5xl font-bold leading-none text-[#E5E7EB] sm:text-6xl">
                03
              </p>
              <h3 className="mt-4 text-lg font-bold text-[#0A0A0A]">
                You get the list Monday morning
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#6B7280]">
                A clean digest lands in your inbox with contacts attached. Log in
                anytime to see the full feed, filter by signal type, and export to
                CSV.
              </p>
            </div>
          </div>
        </section>

        {/* Section 7 — Pricing */}
        <section className="border-t border-[#F3F4F6] bg-[#FFFFFF] px-4 py-20 sm:px-6 sm:py-28">
          <div className="mx-auto max-w-md text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6B7280]">
              Pricing
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#0A0A0A] sm:text-4xl">
              One plan. Everything included.
            </h2>
            <div className="mt-10 rounded-2xl border border-[#F3F4F6] bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.08)] sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">
                HireSignal Pro
              </p>
              <p className="mt-2 text-5xl font-bold tracking-tight text-[#0A0A0A] sm:text-6xl">
                $199
                <span className="text-xl font-medium text-[#6B7280] sm:text-2xl">
                  /month
                </span>
              </p>
              <p className="mt-3 text-sm text-[#6B7280]">Start free for 14 days</p>
              <ul className="mt-8 space-y-3 text-left text-sm text-[#0A0A0A]">
                {[
                  "25+ buying signals every week",
                  "Verified VP Sales and CRO contacts",
                  "Monday morning email digest",
                  "Winnable now filter",
                  "CSV export for your CRM",
                  "Cancel anytime",
                ].map((line) => (
                  <li key={line} className="flex gap-3">
                    <span className="font-semibold text-[#16A34A]" aria-hidden>
                      ✓
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className="mt-8 flex w-full items-center justify-center rounded-lg bg-[#0A0A0A] py-3.5 text-sm font-semibold text-white transition hover:bg-[#262626]"
              >
                Start your free trial
              </Link>
              <p className="mt-4 text-center text-xs text-[#6B7280]">
                No credit card required
              </p>
            </div>
          </div>
        </section>

        {/* Section 8 — Final CTA */}
        <section className="bg-[#0A0A0A] px-4 py-16 text-center sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-2xl font-bold leading-tight text-white sm:text-3xl md:text-4xl">
              Your next customer is hiring right now.
            </h2>
            <p className="mt-4 text-base text-neutral-300 sm:text-lg">
              Find out who before your competitors do.
            </p>
            <Link
              href="/sign-up"
              className="mt-8 inline-flex items-center justify-center rounded-lg bg-[#16A34A] px-8 py-3.5 text-sm font-semibold text-white transition hover:bg-[#15803d] sm:text-base"
            >
              Start free trial
            </Link>
          </div>
        </section>
      </main>

      {/* Section 9 — Footer */}
      <footer className="border-t border-[#F3F4F6] bg-[#FFFFFF] px-4 py-10 sm:px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 text-sm text-[#6B7280] sm:grid-cols-3 sm:items-center">
          <div className="font-bold text-[#0A0A0A] sm:justify-self-start">
            HireSignal
          </div>
          <div className="hidden sm:block" aria-hidden />
          <div className="sm:justify-self-end">
            <a
              href="mailto:support@hiresignal.com"
              className="font-medium text-[#0A0A0A] hover:text-[#16A34A]"
            >
              support@hiresignal.com
            </a>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-6xl text-center text-xs text-[#9CA3AF] sm:mt-10">
          © 2026 HireSignal. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
