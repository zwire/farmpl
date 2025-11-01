"use client";

import { useMemo } from "react";

import { usePlanningStore } from "@/lib/state/planning-store";
import type { OptimizationResultView } from "@/lib/types/planning";
import { MetricsCharts } from "../metrics/MetricsCharts";
import { ConstraintHints } from "./index";

interface ResultDashboardProps {
  onNavigateToSection?: (sectionId: string) => void;
}

export function ResultDashboard({ onNavigateToSection }: ResultDashboardProps) {
  const result = usePlanningStore((state) => state.lastResult);
  const jobId = usePlanningStore((state) => state.lastJobId);
  const isSubmitting = usePlanningStore((state) => state.isSubmitting);

  const summary = useMemo(() => buildSummary(result), [result]);

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <header className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-900">
          結果ダッシュボード
        </h2>
        <p className="text-xs text-slate-500">
          最適化結果の主要メトリクスと制約のヒントを表示します。
        </p>
      </header>

      {isSubmitting && (
        <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          最適化を実行中です…
        </div>
      )}

      <MetricsCharts
        result={isSubmitting ? null : result}
        jobId={jobId ?? undefined}
      />

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        {summary}
      </div>

      <ConstraintHints
        hints={result?.constraintHints}
        onNavigate={onNavigateToSection}
      />
    </section>
  );
}

const buildSummary = (result: OptimizationResultView | null) => {
  if (!result) {
    return "まだ最適化は実行されていません。プランを送信すると結果が表示されます。";
  }

  const parts: string[] = [`ステータス: ${result.status}`];
  if (result.objectiveValue != null) {
    parts.push(`目的値: ${result.objectiveValue}`);
  }
  if (result.warnings && result.warnings.length > 0) {
    parts.push(`警告: ${result.warnings.join(" / ")}`);
  }
  return parts.join(" / ");
};
