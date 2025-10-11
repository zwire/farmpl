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
  it("shows usage summary and entry", () => {
    render(<WorkersTimeline interval="day" records={recs} />);
    expect(screen.getByText(/作業者稼働状況/)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getAllByText(/6\.0h \/ 14\.0h/).length).toBeGreaterThan(0);
  });
});
