"use client";

import clsx from "clsx";

import type { MetricsDayRecord, MetricsInterval } from "@/lib/types/planning";

interface TimelineUsageListProps {
  title: string;
  interval: MetricsInterval;
  records: MetricsDayRecord[];
  unitLabel: string;
  emptyMessage?: string;
  renderSummary?: (totals: UsageTotals) => string;
  extract: (record: MetricsDayRecord) => UsageMetrics;
}

interface UsageMetrics {
  used: number;
  capacity?: number;
  description?: string;
}

interface UsageTotals {
  used: number;
  capacity?: number;
}

const formatKey = (record: MetricsDayRecord, interval: MetricsInterval) => {
  if (interval === "day") {
    return record.day_index != null ? `${record.day_index}` : "-";
  }
  return record.period_key ?? "-";
};

const formatNumber = (value: number) => value.toFixed(1);

const defaultSummary = (totals: UsageTotals, unitLabel: string) => {
  if (typeof totals.capacity === "number") {
    return `合計 ${formatNumber(totals.used)}${unitLabel} / ${formatNumber(totals.capacity)}${unitLabel}`;
  }
  return `合計 ${formatNumber(totals.used)}${unitLabel}`;
};

const usageRatio = (used: number, capacity?: number) => {
  if (typeof capacity !== "number" || capacity <= 0) return 0;
  return Math.min(used / capacity, 1);
};

export function TimelineUsageList({
  title,
  interval,
  records,
  unitLabel,
  emptyMessage = "表示できるデータがありません。",
  renderSummary,
  extract,
}: TimelineUsageListProps) {
  const totals = records.reduce<UsageTotals>(
    (acc, record) => {
      const { used, capacity } = extract(record);
      acc.used += used;
      if (typeof capacity === "number") {
        acc.capacity = (acc.capacity ?? 0) + capacity;
      }
      return acc;
    },
    { used: 0, capacity: records.length ? 0 : undefined },
  );

  const summary = renderSummary
    ? renderSummary(totals)
    : defaultSummary(totals, unitLabel);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
      <header className="flex flex-col gap-1">
        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400">{summary}</p>
      </header>
      {records.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {emptyMessage}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {records.map((record) => {
            const key = formatKey(record, interval);
            const { used, capacity, description } = extract(record);
            const ratio = usageRatio(used, capacity);
            return (
              <li
                key={`${key}-${record.interval}`}
                className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-900/40"
              >
                <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-300">
                  <span>{key}</span>
                  <span>
                    {formatNumber(used)}
                    {unitLabel}
                    {typeof capacity === "number"
                      ? ` / ${formatNumber(capacity)}${unitLabel}`
                      : null}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className={clsx(
                      "h-full rounded-full",
                      ratio >= 0.95
                        ? "bg-red-500"
                        : ratio >= 0.75
                          ? "bg-amber-500"
                          : "bg-sky-500",
                    )}
                    style={{ width: `${Math.max(ratio * 100, 4)}%` }}
                  />
                </div>
                {description ? (
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    {description}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export type { UsageTotals, UsageMetrics };
