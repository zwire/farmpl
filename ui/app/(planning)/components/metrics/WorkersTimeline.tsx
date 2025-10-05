"use client";

import type { MetricsDayRecord, MetricsInterval } from "@/lib/types/planning";
import { CapacityTimeline } from "./CapacityTimeline";

export function WorkersTimeline({
  interval,
  records,
}: {
  interval: MetricsInterval;
  records: MetricsDayRecord[];
}) {
  return (
    <CapacityTimeline interval={interval} records={records} mode="workers" />
  );
}
