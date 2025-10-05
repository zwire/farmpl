import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WorkersTimeline } from "@/app/(planning)/components/metrics/WorkersTimeline";
import type { MetricsDayRecord } from "@/lib/types/planning";

const recs: MetricsDayRecord[] = [
  {
    interval: "day",
    day_index: 2,
    period_key: null,
    events: [],
    workers: [
      { worker_id: "W1", name: "A", utilization: 4, capacity: 8 },
      { worker_id: "W2", name: "B", utilization: 2, capacity: 6 },
    ],
    lands: [],
    summary: {
      labor_total_hours: 6,
      labor_capacity_hours: 14,
      land_total_area: 0,
      land_capacity_area: 0,
    },
  },
];

describe("WorkersTimeline", () => {
  it("shows used/capacity text and key", () => {
    render(<WorkersTimeline interval="day" records={recs} />);
    // key 2 label present
    expect(screen.getByText("2")).toBeInTheDocument();
    // shows "6.0 / 14.0"
    expect(screen.getByText(/6\.0\s*\/\s*14\.0/)).toBeInTheDocument();
  });
});
