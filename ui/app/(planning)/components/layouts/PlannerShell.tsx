"use client";

import { useState } from "react";
import { usePlanningStore } from "@/lib/state/planning-store";

interface PlannerShellProps {
  children: React.ReactNode;
}

export function PlannerShell({ children }: PlannerShellProps) {
  const isSubmitting = usePlanningStore((state) => state.isSubmitting);
  const jobProgress = usePlanningStore((state) => state.jobProgress);
  const jobStatus = usePlanningStore((state) => state.jobStatus);
  const lastJobId = usePlanningStore((state) => state.lastJobId);
  const setIsSubmitting = usePlanningStore((s) => s.setIsSubmitting);
  const setSubmissionError = usePlanningStore((s) => s.setSubmissionError);
  const setLastJobId = usePlanningStore((s) => s.setLastJobId);
  const setJobStatus = usePlanningStore((s) => s.setJobStatus);
  const setJobProgress = usePlanningStore((s) => s.setJobProgress);

  const [isCancelling, setIsCancelling] = useState(false);

  const API_BASE_URL = process.env.NEXT_PUBLIC_FARMPL_API_BASE ?? "";
  const API_KEY = process.env.NEXT_PUBLIC_FARMPL_API_KEY ?? "";
  const BEARER_TOKEN = process.env.NEXT_PUBLIC_FARMPL_BEARER_TOKEN ?? "";

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      if (API_BASE_URL && lastJobId) {
        const url = `${API_BASE_URL.replace(/\/$/, "")}/v1/jobs/${lastJobId}`;
        const headers: Record<string, string> = {};
        if (API_KEY) headers["X-API-Key"] = API_KEY;
        if (BEARER_TOKEN) headers.Authorization = `Bearer ${BEARER_TOKEN}`;
        await fetch(url, { method: "DELETE", headers });
      }
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "キャンセル要求に失敗しました";
      setSubmissionError(msg);
    } finally {
      setIsCancelling(false);
      setIsSubmitting(false);
      setLastJobId(null);
      setJobStatus(null);
      setJobProgress(0);
    }
  };

  return (
    <section className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      {isSubmitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur">
          <div className="w-[min(28rem,92%)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
              <span className="h-3 w-3 animate-ping rounded-full bg-sky-500" />
              <span>最適化を実行中です…</span>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>状態: {jobStatus ?? "running"}</span>
              <span>{Math.round((jobProgress ?? 0) * 100)}%</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded bg-slate-100">
              <div
                className="h-full bg-sky-500 transition-[width] duration-300"
                style={{
                  width: `${Math.max(3, Math.round((jobProgress ?? 0) * 100))}%`,
                }}
              />
            </div>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling}
              className="mt-4 rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {isCancelling ? "キャンセル中…" : "キャンセル"}
            </button>
          </div>
        </div>
      )}
      <header className="flex flex-col gap-2 text-slate-700">
        <h1 className="text-3xl font-semibold text-slate-900">
          FarmPL 営農プランニング
        </h1>
      </header>
      <div className="flex flex-col gap-6">{children}</div>
    </section>
  );
}
