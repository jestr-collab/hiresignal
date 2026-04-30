"use client";

import { SyncSubscriber } from "@/components/SyncSubscriber";
import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import "../app/dashboard.css";

export function DashboardShell({ children }: { children: React.ReactNode }) {
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
