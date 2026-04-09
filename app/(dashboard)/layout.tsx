import { SyncSubscriber } from "@/components/SyncSubscriber";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <SyncSubscriber />
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-neutral-900"
          >
            HireSignal
          </Link>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
