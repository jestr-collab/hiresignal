"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef } from "react";

/**
 * One-shot POST to /api/auth/sync after sign-in so Supabase has a subscriber row.
 */
export function SyncSubscriber() {
  const { isLoaded, userId } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (!isLoaded || !userId || ran.current) return;
    ran.current = true;
    fetch("/api/auth/sync", { method: "POST" }).catch(() => {});
  }, [isLoaded, userId]);

  return null;
}
