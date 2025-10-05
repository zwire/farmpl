"use client";

import type { MetricsDayRecord, MetricsInterval } from "@/lib/types/planning";
import { CapacityTimeline } from "./CapacityTimeline";

export function LandsTimeline({
  interval,
  records,
}: {
  interval: MetricsInterval;
  records: MetricsDayRecord[];
}) {
  return (
    <CapacityTimeline interval={interval} records={records} mode="lands" />
  );
}
