"use client";

import type { MetricsDayRecord, MetricsInterval } from "@/lib/types/planning";

interface LandsTimelineProps {
  interval: MetricsInterval;
  records: MetricsDayRecord[];
}

export function LandsTimeline({ interval, records }: LandsTimelineProps) {
  const total = records.reduce(
    (sum, r) => sum + Number(r.summary?.land_total_area ?? 0),
    0,
  );
  return (
    <div>
      <div>{total.toFixed(1)}</div>
      {records.map((r, i) => (
        <div key={i.toString()}>
          {interval === "day"
            ? String(r.day_index ?? "")
            : String(r.period_key ?? "")}
        </div>
      ))}
    </div>
  );
}
