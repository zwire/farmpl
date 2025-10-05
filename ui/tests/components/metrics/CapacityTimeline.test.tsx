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
  it("renders legend and worker totals for day buckets", () => {
    render(
      <CapacityTimeline interval="day" records={dayRecords} mode="workers" />,
    );
    // Legend labels (there can be "Total Used" etc., so allow multiple)
    expect(screen.getAllByText(/Used/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Capacity/i).length).toBeGreaterThan(0);
    // Summary totals (5 + 1 = 6 used across two days)
    expect(screen.getByText("6.0")).toBeInTheDocument();
    // Keys 0 and 1 present
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders decade buckets with period keys", () => {
    const decadeRecords: MetricsDayRecord[] = [
      {
        ...dayRecords[0],
        interval: "decade",
        day_index: null,
        period_key: "000:U",
      },
      {
        ...dayRecords[1],
        interval: "decade",
        day_index: null,
        period_key: "000:M",
      },
    ];
    render(
      <CapacityTimeline
        interval="decade"
        records={decadeRecords}
        mode="lands"
      />,
    );
    expect(screen.getByText("000:U")).toBeInTheDocument();
    expect(screen.getByText("000:M")).toBeInTheDocument();
  });
});
