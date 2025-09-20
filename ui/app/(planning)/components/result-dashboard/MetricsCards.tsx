"use client";

import type { OptimizationResultView } from "@/lib/types/planning";

const statusColor: Record<OptimizationResultView["status"], string> = {
  ok: "text-green-600 dark:text-green-300",
  infeasible: "text-orange-600 dark:text-orange-300",
  timeout: "text-amber-600 dark:text-amber-300",
  error: "text-red-600 dark:text-red-300",
};

interface MetricsCardsProps {
  result: OptimizationResultView | null;
}

export function MetricsCards({ result }: MetricsCardsProps) {
  if (!result) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SkeletonCard title="ステータス" />
        <SkeletonCard title="目的値" />
      </div>
    );
  }

  const stageMetrics = result.stats.stages ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          ステータス
        </h3>
        <p
          className={`mt-2 text-lg font-semibold ${statusColor[result.status]}`}
        >
          {renderStatusLabel(result.status)}
        </p>
        {result.warnings && result.warnings.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-600 dark:text-amber-300">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          目的値
        </h3>
        <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
          {result.objectiveValue?.toLocaleString() ?? "—"}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          主要目的関数（profit）が存在する場合は最適値を表示します。
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          ステージ順序
        </h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {(
            result.stats.stageOrder ?? ["profit", "labor", "idle", "dispersion"]
          ).map((stage) => (
            <span
              key={stage}
              className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300"
            >
              {stage}
            </span>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          ステージ評価
        </h3>
        <StageList stages={stageMetrics} />
      </div>
    </div>
  );
}

interface SkeletonCardProps {
  title: string;
}

const SkeletonCard = ({ title }: SkeletonCardProps) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {title}
    </h3>
    <div className="mt-3 h-8 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
  </div>
);

const renderStatusLabel = (status: OptimizationResultView["status"]) => {
  switch (status) {
    case "ok":
      return "OK (可行解)";
    case "infeasible":
      return "INFEASIBLE (不可行)";
    case "timeout":
      return "TIMEOUT (タイムアウト)";
    case "error":
      return "ERROR (エラー)";
    default:
      return status;
  }
};

interface StageListProps {
  stages: OptimizationResultView["stats"]["stages"];
}

const StageList = ({ stages }: StageListProps) => {
  if (!stages || stages.length === 0) {
    return (
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        ステージ評価は未取得です。
      </p>
    );
  }
  return (
    <ul className="mt-2 space-y-2">
      {stages.map((stage) => (
        <li
          key={stage.name}
          className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-slate-600 dark:text-slate-300"
        >
          <span>{stage.name}</span>
          <span className="font-semibold">{stage.value.toFixed(3)}</span>
        </li>
      ))}
    </ul>
  );
};
