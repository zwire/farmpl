"use client";

import type { MetricsDayRecord, MetricsInterval } from "@/lib/types/planning";

import { TimelineUsageList } from "./TimelineUsageList";

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
  const unitLabel = mode === "workers" ? "h" : "a";

  return (
    <TimelineUsageList
      title={mode === "workers" ? "作業者稼働サマリ" : "圃場利用サマリ"}
      interval={interval}
      records={records}
      unitLabel={unitLabel}
      extract={(record) => ({
        used:
          mode === "workers"
            ? Number(record.summary?.labor_total_hours ?? 0)
            : Number(record.summary?.land_total_area ?? 0),
        capacity:
          mode === "workers"
            ? Number(record.summary?.labor_capacity_hours ?? 0)
            : Number(record.summary?.land_capacity_area ?? 0),
      })}
    />
  );
}
