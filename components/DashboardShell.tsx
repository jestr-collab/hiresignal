"use client";

import { SyncSubscriber } from "@/components/SyncSubscriber";
import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import "../app/dashboard.css";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const signalsActive =
    pathname === "/" || pathname.startsWith("/signal");

  return (
    <div className="dashboard-skin">
      <SyncSubscriber />
      <header className="dash-nav">
        <div className="dash-nav-inner">
          <Link href="/" className="dash-brand">
            <span className="dash-brand-mark">
              <Image
                src="/logo.png"
                alt=""
                width={1536}
                height={1024}
                className="h-8 w-auto max-w-[32px] object-contain"
                sizes="32px"
                quality={95}
                priority
              />
            </span>
            HireSignal
          </Link>
          <nav className="dash-nav-tabs" aria-label="Primary">
            <Link
              href="/"
              className={`dash-nav-tab${signalsActive ? " is-active" : ""}`}
            >
              Signals
            </Link>
            <button type="button" className="dash-nav-tab" disabled>
              Exports
            </button>
            <button type="button" className="dash-nav-tab" disabled>
              Settings
            </button>
          </nav>
          <div className="dash-nav-right">
            <a className="dash-billing" href="/api/stripe/portal">
              Manage billing
            </a>
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
