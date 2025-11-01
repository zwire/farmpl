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
    <main className="relative mx-auto flex w-full max-w-screen-2xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      {isSubmitting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="flex items-center gap-3 text-lg font-medium text-white">
            <svg
              className="h-5 w-5 animate-spin text-sky-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <title>最適化を実行中です</title>
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>最適化を実行中です…</span>
          </div>
          <div className="mt-4 w-80 text-center text-sm text-slate-300">
            状態: {jobStatus ?? "running"} (
            {Math.round((jobProgress ?? 0) * 100)}%)
          </div>
          <div className="mt-2 h-2 w-80 overflow-hidden rounded-full bg-slate-700">
            <div
              className="h-full bg-sky-400 transition-[width] duration-300"
              style={{
                width: `${Math.max(3, Math.round((jobProgress ?? 0) * 100))}%`,
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isCancelling}
            className="mt-6 rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
          >
            {isCancelling ? "キャンセル中…" : "キャンセル"}
          </button>
        </div>
      )}
      <header className="border-b border-slate-300/80 pb-6 dark:border-slate-700/80">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          営農計画プランナー
        </h1>
        <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
          FarmPLエンジンを使って、最適な営農計画を作成します。
        </p>
      </header>
      <div className="flex flex-col gap-10">{children}</div>
    </main>
  );
}
