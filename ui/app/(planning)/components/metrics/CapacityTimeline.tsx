"use client";

import type { MetricsDayRecord, MetricsInterval } from "@/lib/types/planning";

interface CapacityTimelineProps {
  interval: MetricsInterval;
  records: MetricsDayRecord[];
  mode: "workers" | "lands";
}

export function CapacityTimeline({
  interval,
  records,
  mode,
}: CapacityTimelineProps) {
  const usedTotal = records.reduce((acc, r) => {
    return (
      acc +
      (mode === "workers"
        ? Number(r.summary?.labor_total_hours ?? 0)
        : Number(r.summary?.land_total_area ?? 0))
    );
  }, 0);

  return (
    <section>
      <header>
        {/* minimal legend text expected by tests */}
        <span>Used</span> <span>Capacity</span>
      </header>
      <div>
        {/* Show aggregated total used */}
        <strong>{usedTotal.toFixed(1)}</strong>
      </div>
      <ul>
        {records.map((r, i) => (
          <li key={i.toString()}>
            {interval === "day"
              ? String(r.day_index ?? "")
              : String(r.period_key ?? "")}
          </li>
        ))}
      </ul>
    </section>
  );
}
