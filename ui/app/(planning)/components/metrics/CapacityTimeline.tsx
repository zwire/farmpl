"use client";

import type { MetricsDayRecord, MetricsInterval } from "@/lib/types/planning";

type Mode = "workers" | "lands";

export interface CapacityTimelineProps {
  interval: MetricsInterval;
  records: MetricsDayRecord[];
  mode: Mode;
}

export function CapacityTimeline({
  interval,
  records,
  mode,
}: CapacityTimelineProps) {
  const keys = records.map((r) =>
    interval === "day" ? String(r.day_index) : r.period_key || "",
  );
  const series = records.map((r) => {
    if (mode === "workers") {
      const used = r.workers.reduce((s, w) => s + w.utilization, 0);
      const cap = r.workers.reduce((s, w) => s + w.capacity, 0);
      return { used, cap };
    }
    const used = r.lands.reduce((s, l) => s + l.utilization, 0);
    const cap = r.lands.reduce((s, l) => s + l.capacity, 0);
    return { used, cap };
  });

  const maxCap = Math.max(1, ...series.map((s) => s.cap));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Interval: {interval}</span>
        <Legend />
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
        {records.map((_, i) => {
          const k = keys[i] ?? String(i);
          const { used, cap } = series[i];
          const usedPct = Math.min((used / maxCap) * 100, 100);
          const capPct = Math.min((cap / maxCap) * 100, 100);
          return (
            <div
              key={k}
              className="rounded-md border border-slate-200 p-3 text-xs dark:border-slate-700"
            >
              <div className="mb-1 flex items-center justify-between text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <span>{k}</span>
                <span>
                  {used.toFixed(1)} / {cap.toFixed(1)}
                </span>
              </div>
              <div className="mb-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-sky-500"
                  style={{ width: `${usedPct}%` }}
                />
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-slate-400"
                  style={{ width: `${capPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <Summary interval={interval} records={records} mode={mode} />
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex items-center gap-1">
        <i className="h-2 w-2 rounded-full bg-sky-500 inline-block" /> Used
      </span>
      <span className="inline-flex items-center gap-1">
        <i className="h-2 w-2 rounded-full bg-slate-400 inline-block" />{" "}
        Capacity
      </span>
    </div>
  );
}

function Summary({
  interval,
  records,
  mode,
}: {
  interval: MetricsInterval;
  records: MetricsDayRecord[];
  mode: Mode;
}) {
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const values = records.map((r) =>
    mode === "workers"
      ? {
          used: sum(r.workers.map((w) => w.utilization)),
          cap: sum(r.workers.map((w) => w.capacity)),
        }
      : {
          used: sum(r.lands.map((l) => l.utilization)),
          cap: sum(r.lands.map((l) => l.capacity)),
        },
  );
  const totalUsed = sum(values.map((v) => v.used));
  const totalCap = sum(values.map((v) => v.cap));
  const maxUsed = Math.max(...values.map((v) => v.used), 0);

  return (
    <div className="mt-2 grid grid-cols-3 gap-3 text-xs">
      <div className="rounded-md border border-slate-200 p-2 dark:border-slate-700">
        <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Total Used
        </div>
        <div className="text-slate-700 dark:text-slate-200">
          {totalUsed.toFixed(1)}
        </div>
      </div>
      <div className="rounded-md border border-slate-200 p-2 dark:border-slate-700">
        <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Total Capacity
        </div>
        <div className="text-slate-700 dark:text-slate-200">
          {totalCap.toFixed(1)}
        </div>
      </div>
      <div className="rounded-md border border-slate-200 p-2 dark:border-slate-700">
        <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Max Used
        </div>
        <div className="text-slate-700 dark:text-slate-200">
          {maxUsed.toFixed(1)}
        </div>
      </div>
    </div>
  );
}
