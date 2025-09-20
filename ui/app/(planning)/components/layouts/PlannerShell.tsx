"use client";

import { usePlanningStore } from "@/lib/state/planning-store";

interface PlannerShellProps {
  children: React.ReactNode;
}

export function PlannerShell({ children }: PlannerShellProps) {
  const isSubmitting = usePlanningStore((state) => state.isSubmitting);

  return (
    <section className="relative mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      {isSubmitting && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-2xl bg-white/80 backdrop-blur">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <span className="h-3 w-3 animate-ping rounded-full bg-sky-500" />
            <span>最適化を実行中です…</span>
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
