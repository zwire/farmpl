"use client";

import { useEffect } from "react";
import { useTemplatesStore } from "@/lib/state/templates-store";

/**
 * Bootstraps master data on initial load (templates/crops).
 * Runs once on first mount; safe to include in RootLayout.
 */
export function TemplatesBootstrap() {
  const fetchCropsOnce = useTemplatesStore((s) => s.fetchCropsOnce);
  useEffect(() => {
    fetchCropsOnce();
  }, [fetchCropsOnce]);
  return null;
}

