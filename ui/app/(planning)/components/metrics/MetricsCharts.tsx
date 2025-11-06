"use client";

import { extent } from "d3-array";
import { useMemo } from "react";

import type { OptimizationResultView } from "@/lib/types/planning";

import { GanttChart as TimelineGanttChart } from "./gantt/GanttChart";

interface MetricsChartsProps {
  result: OptimizationResultView | null;
  jobId?: string;
}

interface MetricDatum {
  id: string;
  label: string;
  value: number;
}

const MAX_BARS = 6;

export function MetricsCharts({ result, jobId }: MetricsChartsProps) {
  const datasets = useMemo(() => mapMetricsFromResult(result), [result]);

  if (!result && !jobId) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-slate-900">
          メトリクス可視化
        </h3>
        <p className="text-xs text-slate-500">
          最適化の結果やジョブ進捗に応じて主要なメトリクスを確認できます。
        </p>
      </header>

      {jobId ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <TimelineGanttChart jobId={jobId} jobResult={result} />
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {datasets.map((dataset) => (
          <MetricsBarChart
            key={dataset.title}
            title={dataset.title}
            data={dataset.values}
          />
        ))}
        {datasets.length === 0 && !jobId ? (
          <p className="text-xs text-slate-500">
            表示できるメトリクスがありません。
          </p>
        ) : null}
      </div>
    </section>
  );
}

interface MetricsDataset {
  title: string;
  values: MetricDatum[];
}

const mapMetricsFromResult = (
  result: OptimizationResultView | null,
): MetricsDataset[] => {
  if (!result) return [];

  const stageMetrics = (result.stats.stages ?? [])
    .filter(
      (stage): stage is { name: string; value: number } =>
        typeof stage?.value === "number" && Number.isFinite(stage.value),
    )
    .slice(0, MAX_BARS)
    .map((stage) => ({
      id: stage.name,
      label: stage.name,
      value: stage.value,
    }));

  const summaryMetrics = Object.entries(result.summary ?? {})
    .filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1]),
    )
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    .slice(0, MAX_BARS)
    .map(([key, value]) => ({
      id: key,
      label: key,
      value,
    }));

  const datasets: MetricsDataset[] = [];
  if (stageMetrics.length > 0) {
    datasets.push({ title: "ステージ評価", values: stageMetrics });
  }
  if (summaryMetrics.length > 0) {
    datasets.push({ title: "サマリメトリクス", values: summaryMetrics });
  }
  return datasets;
};

interface MetricsBarChartProps {
  title: string;
  data: MetricDatum[];
}

const MetricsBarChart = ({ title, data }: MetricsBarChartProps) => {
  const values = data.map((item) => item.value);
  const [min, max] = extent(values) as [number, number];
  const domain = Math.max(Math.abs(min ?? 0), Math.abs(max ?? 0), 1);

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/70 p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      <dl className="flex flex-col gap-3">
        {data.map((datum) => {
          const width = `${Math.min(Math.abs(datum.value) / domain, 1) * 100}%`;
          return (
            <div key={datum.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400">
                <dt>{datum.label}</dt>
                <dd>{datum.value.toFixed(3)}</dd>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-sky-500 transition-all"
                  style={{ width }}
                />
              </div>
            </div>
          );
        })}
      </dl>
    </article>
  );
};

export { mapMetricsFromResult };
