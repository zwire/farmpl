"use client";

import type { MetricsDayRecord, MetricsInterval } from "@/lib/types/planning";

interface WorkersTimelineProps {
  interval: MetricsInterval;
  records: MetricsDayRecord[];
}

export function WorkersTimeline({ interval, records }: WorkersTimelineProps) {
  return (
    <div>
      {records.map((r, i) => {
        const key =
          interval === "day"
            ? String(r.day_index ?? "")
            : String(r.period_key ?? "");
        const used = Number(r.summary?.labor_total_hours ?? 0).toFixed(1);
        const cap = Number(r.summary?.labor_capacity_hours ?? 0).toFixed(1);
        return (
          <div key={i.toString()}>
            <span>{key}</span>
            <span>{` ${used} / ${cap}`}</span>
          </div>
        );
      })}
    </div>
  );
}
