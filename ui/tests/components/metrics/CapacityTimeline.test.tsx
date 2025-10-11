import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CapacityTimeline } from "@/app/(planning)/components/metrics/CapacityTimeline";
import type { MetricsDayRecord } from "@/lib/types/planning";

const dayRecords: MetricsDayRecord[] = [
  {
    interval: "day",
    day_index: 0,
    period_key: null,
    events: [],
    workers: [
      { worker_id: "W1", name: "A", utilization: 2, capacity: 8 },
      { worker_id: "W2", name: "B", utilization: 3, capacity: 6 },
    ],
    lands: [
      { land_id: "L1", name: "x", utilization: 1.5, capacity: 1.5 },
      { land_id: "L2", name: "y", utilization: 2.0, capacity: 2.0 },
    ],
    summary: {
      labor_total_hours: 5,
      labor_capacity_hours: 14,
      land_total_area: 3.5,
      land_capacity_area: 3.5,
    },
  },
  {
    interval: "day",
    day_index: 1,
    period_key: null,
    events: [],
    workers: [
      { worker_id: "W1", name: "A", utilization: 1, capacity: 8 },
      { worker_id: "W2", name: "B", utilization: 0, capacity: 6 },
    ],
    lands: [
      { land_id: "L1", name: "x", utilization: 0.5, capacity: 1.5 },
      { land_id: "L2", name: "y", utilization: 1.0, capacity: 2.0 },
    ],
    summary: {
      labor_total_hours: 1,
      labor_capacity_hours: 14,
      land_total_area: 1.5,
      land_capacity_area: 3.5,
    },
  },
];

describe("CapacityTimeline", () => {
  it("renders worker totals and day buckets", () => {
    render(
      <CapacityTimeline interval="day" records={dayRecords} mode="workers" />,
    );
    expect(screen.getByText(/作業者稼働サマリ/)).toBeInTheDocument();
    expect(screen.getByText(/合計 6\.0h \/ 28\.0h/)).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders third buckets with period keys", () => {
    const thirdRecords: MetricsDayRecord[] = [
      {
        ...dayRecords[0],
        interval: "third",
        day_index: null,
        period_key: "2024-03:U",
      },
      {
        ...dayRecords[1],
        interval: "third",
        day_index: null,
        period_key: "2024-03:M",
      },
    ];
    render(
      <CapacityTimeline interval="third" records={thirdRecords} mode="lands" />,
    );
    expect(screen.getByText("2024-03:U")).toBeInTheDocument();
    expect(screen.getByText("2024-03:M")).toBeInTheDocument();
  });
});
