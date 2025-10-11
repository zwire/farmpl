"use client";

import type { MetricsDayRecord, MetricsInterval } from "@/lib/types/planning";

import { TimelineUsageList } from "./TimelineUsageList";

interface WorkersTimelineProps {
  interval: MetricsInterval;
  records: MetricsDayRecord[];
}

export function WorkersTimeline({ interval, records }: WorkersTimelineProps) {
  return (
    <TimelineUsageList
      title="作業者稼働状況"
      interval={interval}
      records={records}
      unitLabel="h"
      extract={(record) => ({
        used: Number(record.summary?.labor_total_hours ?? 0),
        capacity: Number(record.summary?.labor_capacity_hours ?? 0),
        description:
          record.workers.length > 0
            ? `${record.workers.length}名のアサイン`
            : undefined,
      })}
    />
  );
}
