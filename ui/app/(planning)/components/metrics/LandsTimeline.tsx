"use client";

import type { MetricsDayRecord, MetricsInterval } from "@/lib/types/planning";

import { TimelineUsageList } from "./TimelineUsageList";

interface LandsTimelineProps {
  interval: MetricsInterval;
  records: MetricsDayRecord[];
}

export function LandsTimeline({ interval, records }: LandsTimelineProps) {
  return (
    <TimelineUsageList
      title="圃場利用状況"
      interval={interval}
      records={records}
      unitLabel="a"
      extract={(record) => ({
        used: Number(record.summary?.land_total_area ?? 0),
        capacity: Number(record.summary?.land_capacity_area ?? 0),
        description:
          record.lands.length > 0
            ? `${record.lands.length}圃場の利用`
            : undefined,
      })}
    />
  );
}
