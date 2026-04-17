import { DashboardShell } from "@/components/DashboardShell";
import { DashboardSignalsPage } from "@/components/DashboardSignalsPage";
import { LandingPage } from "@/components/LandingPage";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    return (
      <DashboardShell>
        <DashboardSignalsPage />
      </DashboardShell>
    );
  }

  return <LandingPage />;
}
