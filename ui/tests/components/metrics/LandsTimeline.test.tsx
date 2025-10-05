import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LandsTimeline } from "@/app/(planning)/components/metrics/LandsTimeline";
import type { MetricsDayRecord } from "@/lib/types/planning";

const recs: MetricsDayRecord[] = [
  {
    interval: "decade",
    day_index: null,
    period_key: "000:U",
    events: [],
    workers: [],
    lands: [
      { land_id: "L1", name: "A", utilization: 1.5, capacity: 1.5 },
      { land_id: "L2", name: "B", utilization: 2.0, capacity: 2.0 },
    ],
    summary: {
      labor_total_hours: 0,
      labor_capacity_hours: 0,
      land_total_area: 3.5,
      land_capacity_area: 3.5,
    },
  },
];

describe("LandsTimeline", () => {
  it("shows period key and totals", () => {
    render(<LandsTimeline interval="decade" records={recs} />);
    expect(screen.getByText("000:U")).toBeInTheDocument();
    // total used 3.5 appears multiple times (card + row); allow multiple
    expect(screen.getAllByText("3.5").length).toBeGreaterThan(0);
  });
});
