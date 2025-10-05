"use client";

import { extent } from "d3-array";

import { useEffect, useMemo, useState } from "react";
import type {
  MetricsInterval,
  MetricsTimelineResponse,
  OptimizationResultView,
} from "@/lib/types/planning";
import { mapTimelineResponse } from "@/lib/types/result-mapper";
import { GanttChart } from "./gantt/GanttChart";
import { LandsTimeline } from "./LandsTimeline";
import { WorkersTimeline } from "./WorkersTimeline";

interface MetricsChartsProps {
  result: OptimizationResultView | null;
  jobId?: string; // optional: when provided, enables timeline fetch
}

interface MetricDatum {
  id: string;
  label: string;
  value: number;
  category: "stage" | "summary";
}

const MAX_BARS = 6;
const API_BASE_URL = process.env.NEXT_PUBLIC_FARMPL_API_BASE ?? "";
const API_KEY = process.env.NEXT_PUBLIC_FARMPL_API_KEY ?? "";
const BEARER_TOKEN = process.env.NEXT_PUBLIC_FARMPL_BEARER_TOKEN ?? "";

export function MetricsCharts({ result, jobId }: MetricsChartsProps) {
  const [tab, setTab] = useState<"events" | "workers" | "lands">("events");
  const [bucket, setBucket] = useState<MetricsInterval>("decade");
  const [timeline, setTimeline] = useState<MetricsTimelineResponse | null>(
    null,
  );

  const { startDay, endDay } = useMemo(() => {
    // Derive a sensible default range from the current result timeline (if any)
    const tl = result?.timeline;
    if (!tl) return { startDay: 0, endDay: 29 };
    const dayVals: number[] = [];
    for (const e of tl.events ?? []) {
      dayVals.push(e.day - 1);
    }
    for (const s of tl.landSpans ?? []) {
      dayVals.push(s.startDay - 1);
      dayVals.push(s.endDay - 1);
    }
    const min = Math.max(0, Math.min(...(dayVals.length ? dayVals : [0])));
    const max = Math.max(...(dayVals.length ? dayVals : [29]));
    return { startDay: min, endDay: max };
  }, [result]);

  const finished = result?.status === "ok";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // ジョブ未完了 or jobIdなし or API_BASE未設定なら問い合わせない
      if (!jobId || !finished || !API_BASE_URL) {
        setTimeline(null);
        return;
      }
      const params = new URLSearchParams({
        job_id: jobId,
        start_day: String(startDay),
        end_day: String(endDay),
        bucket,
      });
      const endpoint = `${API_BASE_URL.replace(/\/$/, "")}/v1/metrics/timeline?${params.toString()}`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (API_KEY) {
        headers["X-API-Key"] = API_KEY;
      }
      if (BEARER_TOKEN) {
        headers.Authorization = `Bearer ${BEARER_TOKEN}`;
      }
      const res = await fetch(endpoint, { headers });
      if (!res.ok) {
        setTimeline(null);
        return;
      }
      const json = await res.json();
      if (!cancelled) setTimeline(mapTimelineResponse(json));
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [jobId, finished, startDay, endDay, bucket]);

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
      {/* Timelines (optional, only when jobId is provided) */}
      {jobId ? (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                className={tabBtn(tab === "events")}
                onClick={() => setTab("events")}
              >
                イベント
              </button>
              <button
                type="button"
                className={tabBtn(tab === "workers")}
                onClick={() => setTab("workers")}
              >
                作業者
              </button>
              <button
                type="button"
                className={tabBtn(tab === "lands")}
                onClick={() => setTab("lands")}
              >
                土地
              </button>
            </div>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                className={tabBtn(bucket === "decade")}
                onClick={() => setBucket("decade")}
              >
                旬
              </button>
              <button
                type="button"
                className={tabBtn(bucket === "day")}
                onClick={() => setBucket("day")}
              >
                日
              </button>
            </div>
          </div>
          {tab === "events" ? (
            // 既存のガントチャートをそのまま再利用
            <GanttChart />
          ) : timeline ? (
            tab === "workers" ? (
              <WorkersTimeline
                interval={timeline.interval}
                records={timeline.records}
              />
            ) : (
              <LandsTimeline
                interval={timeline.interval}
                records={timeline.records}
              />
            )
          ) : (
            <p className="text-xs text-slate-500">
              ジョブ完了後にタイムラインを表示します。
            </p>
          )}
        </div>
      ) : null}
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

function tabBtn(active: boolean) {
  return (
    "rounded-md border px-2 py-1 " +
    (active
      ? "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300"
      : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400")
  );
}
