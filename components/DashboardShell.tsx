import { SyncSubscriber } from "@/components/SyncSubscriber";
import { UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <SyncSubscriber />
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight text-neutral-900"
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
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
