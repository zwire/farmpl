"use client";

import { useEffect } from "react";

/**
 * Fire-and-forget warm-up ping to the API.
 * - Uses GET /healthz to avoid server changes
 * - Adds a cache-busting query to bypass CDNs
 * - Uses no-cors + keepalive and does not await
 * - Defers to idle time when possible
 */
export function WarmupPing() {
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_FARMPL_API_BASE?.replace(/\/$/, "");
    if (!base) return;

    // Avoid caching at the edge and ensure origin hit
    const url = `${base}/warmup?t=${Date.now()}`;

    const send = () => {
      try {
        // Fire-and-forget; ignore the returned promise
        fetch(url, {
          method: "GET",
          mode: "no-cors",
          cache: "no-store",
          keepalive: true,
        }).catch(() => {});
      } catch {
        // As a last resort, use an image GET to avoid CORS concerns
        try {
          const img = new Image();
          img.referrerPolicy = "no-referrer";
          img.src = url;
        } catch {
          /* noop */
        }
      }
    };

    // Defer to idle time to not compete with critical resources
    // @ts-ignore - requestIdleCallback may not exist in all browsers
    if (typeof requestIdleCallback === "function") {
      // @ts-ignore
      requestIdleCallback(send, { timeout: 2000 });
    } else {
      setTimeout(send, 0);
    }
  }, []);

  return null;
}
