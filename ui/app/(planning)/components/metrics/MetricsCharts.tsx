"use client";

import { extent } from "d3-array";

import type { OptimizationResultView } from "@/lib/types/planning";

interface MetricsChartsProps {
  result: OptimizationResultView | null;
}

interface MetricDatum {
  id: string;
  label: string;
  value: number;
  category: "stage" | "summary";
}

const MAX_BARS = 6;

export function MetricsCharts({ result }: MetricsChartsProps) {
  if (!result) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          メトリクス可視化
        </h3>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          最適化を実行するとメトリクスが表示されます。
        </p>
      </section>
    );
  }

  const { stageMetrics, summaryMetrics } = extractMetrics(result);
  const datasets: Array<{ title: string; values: MetricDatum[] }> = [];
  if (stageMetrics.length > 0) {
    datasets.push({ title: "ステージ評価", values: stageMetrics });
  }
  if (summaryMetrics.length > 0) {
    datasets.push({ title: "サマリメトリクス", values: summaryMetrics });
  }

  if (datasets.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
        メトリクス可視化
      </h3>
      <div className="grid gap-6 md:grid-cols-2">
        {datasets.map((dataset) => (
          <BarChart
            key={dataset.title}
            title={dataset.title}
            data={dataset.values}
          />
        ))}
      </div>
    </section>
  );
}

const extractMetrics = (result: OptimizationResultView) => {
  const stages: MetricDatum[] = (result.stats.stages ?? [])
    .filter(
      (stage) =>
        typeof stage.value === "number" && Number.isFinite(stage.value),
    )
    .map((stage) => ({
      id: stage.name,
      label: stage.name,
      value: stage.value,
      category: "stage" as const,
    }))
    .slice(0, MAX_BARS);

  const summaryMetrics: MetricDatum[] = [];
  if (result.summary) {
    Object.entries(result.summary).forEach(([key, value]) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        summaryMetrics.push({
          id: key,
          label: key,
          value,
          category: "summary",
        });
      }
    });
  }

  summaryMetrics.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  return {
    stageMetrics: stages,
    summaryMetrics: summaryMetrics.slice(0, MAX_BARS),
  };
};

interface BarChartProps {
  title: string;
  data: MetricDatum[];
}

const BarChart = ({ title, data }: BarChartProps) => {
  const values = data.map((item) => item.value);
  const [min, max] = extent(values) as [number, number];
  const domainMax = Math.max(Math.abs(min), Math.abs(max), 1);

  return (
    <div className="flex flex-col gap-3">
      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
        {title}
      </h4>
      <div className="flex flex-col gap-2">
        {data.map((datum) => {
          const widthPct = Math.min(Math.abs(datum.value) / domainMax, 1) * 100;
          return (
            <div key={datum.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <span>{datum.label}</span>
                <span>{datum.value.toFixed(3)}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-sky-500 transition"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export { extractMetrics };
