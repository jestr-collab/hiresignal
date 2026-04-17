import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/cron(.*)",
  "/upgrade(.*)",
  "/api/webhooks(.*)",
]);

function skipTrialRedirect(pathname: string): boolean {
  return (
    pathname.startsWith("/upgrade") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up")
  );
}

function isRootPath(pathname: string): boolean {
  return pathname === "/" || pathname === "";
}

/**
 * Returns true only when the subscriber row clearly indicates an expired trial.
 * Never throws; on any failure logs and returns false (fail open).
 */
async function trialExpiredForUser(clerkUserId: string): Promise<boolean> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    if (!url || !serviceKey) {
      console.error(
        "[middleware] Trial check skipped: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing or empty"
      );
      return false;
    }

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("subscribers")
      .select("plan, trial_ends_at")
      .eq("clerk_user_id", clerkUserId)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(
        "[middleware] Trial check Supabase error:",
        error.message,
        error.code ?? ""
      );
      return false;
    }

    if (!data) return false;
    if (data.plan !== "trial") return false;
    if (!data.trial_ends_at) return false;

    return new Date(data.trial_ends_at) < new Date();
  } catch (e) {
    console.error("[middleware] Trial expiry check failed (fail open):", e);
    return false;
  }
}

export default clerkMiddleware(async (auth, req) => {
  const pathname = req.nextUrl.pathname;

  // Marketing landing at / for guests; signed-in users still get trial enforcement
  if (isRootPath(pathname)) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.next();
    }
    await auth.protect();
    let shouldRedirectToUpgrade = false;
    try {
      shouldRedirectToUpgrade = await trialExpiredForUser(userId);
    } catch (e) {
      console.error("[middleware] Trial redirect branch failed (fail open):", e);
    }
    if (shouldRedirectToUpgrade) {
      return NextResponse.redirect(new URL("/upgrade", req.url));
    }
    return NextResponse.next();
  }

  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  await auth.protect();

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.next();
  }

  if (skipTrialRedirect(pathname)) {
    return NextResponse.next();
  }

  let shouldRedirectToUpgrade = false;
  try {
    shouldRedirectToUpgrade = await trialExpiredForUser(userId);
  } catch (e) {
    console.error("[middleware] Trial redirect branch failed (fail open):", e);
  }

  if (shouldRedirectToUpgrade) {
    return NextResponse.redirect(new URL("/upgrade", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
