import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GanttViewModel } from "@/app/(planning)/components/gantt/useGanttData";
import { useGanttViewModel } from "@/app/(planning)/components/gantt/useGanttViewModel";

const mockBaseData: GanttViewModel = {
  spans: [
    {
      id: "s1",
      landId: "L1",
      landName: "Land 1",
      cropId: "C1",
      cropName: "Crop 1",
      startDay: 0,
      endDay: 10,
      areaA: 1,
      startDateIso: "2024-01-01",
      endDateIso: "2024-01-11",
    },
    {
      id: "s2",
      landId: "L2",
      landName: "Land 2",
      cropId: "C1",
      cropName: "Crop 1",
      startDay: 5,
      endDay: 15,
      areaA: 1,
      startDateIso: "2024-01-06",
      endDateIso: "2024-01-16",
    },
    {
      id: "s3",
      landId: "L1",
      landName: "Land 1",
      cropId: "C2",
      cropName: "Crop 2",
      startDay: 12,
      endDay: 20,
      areaA: 1,
      startDateIso: "2024-01-13",
      endDateIso: "2024-01-21",
    },
  ],
  events: [
    {
      id: "e1",
      day: 2,
      cropId: "C1",
      landId: "L1",
      label: "Event 1",
      dateIso: "2024-01-03",
    },
    {
      id: "e2",
      day: 8,
      cropId: "C1",
      label: "Event 2 (no land)",
      dateIso: "2024-01-09",
    },
    {
      id: "e3",
      day: 15,
      cropId: "C2",
      landId: "L1",
      label: "Event 3",
      dateIso: "2024-01-16",
    },
  ],
  maxDay: 20,
  totalDays: 30,
  startDateIso: "2024-01-01",
  dayLabels: [], // Not used by the hook
  landOrder: ["L1", "L2"],
  landNameById: { L1: "Land 1", L2: "Land 2" },
  cropNameById: { C1: "Crop 1", C2: "Crop 2" },
  landDayCells: {
    L1: Array.from({ length: 30 }, () => ({ events: [] })),
    L2: Array.from({ length: 30 }, () => ({ events: [] })),
  },
};

describe("useGanttViewModel", () => {
  it("should return land-based view model when mode is 'land'", () => {
    const { result } = renderHook(() =>
      useGanttViewModel(mockBaseData, "land"),
    );

    expect(result.current.rowOrder).toEqual(["L1", "L2"]);
    expect(result.current.rowLabelById).toEqual({ L1: "Land 1", L2: "Land 2" });
    expect(result.current.cellsByRow).toBe(mockBaseData.landDayCells);
  });

  it("should return crop-based view model when mode is 'crop'", () => {
    const { result } = renderHook(() =>
      useGanttViewModel(mockBaseData, "crop"),
    );

    expect(result.current.rowOrder).toEqual(["C1", "C2"]);
    expect(result.current.rowLabelById).toEqual({ C1: "Crop 1", C2: "Crop 2" });

    const cells = result.current.cellsByRow;
    expect(Object.keys(cells)).toEqual(["C1", "C2"]);

    // Check C1 row
    const c1Cells = cells.C1;
    expect(c1Cells.length).toBe(30);
    for (let i = 0; i <= 15; i++) {
      expect(c1Cells[i].cropId).toBe("C1");
    }
    expect(c1Cells[16].cropId).toBeUndefined();
    expect(c1Cells[0].cropStart).toBe(true);
    expect(c1Cells[5].cropStart).toBe(true);
    expect(c1Cells[10].cropEnd).toBe(true);
    expect(c1Cells[15].cropEnd).toBe(true);
    expect(c1Cells[2].events).toHaveLength(1);
    expect(c1Cells[2].events[0].id).toBe("e1");
    expect(c1Cells[8].events).toHaveLength(1);
    expect(c1Cells[8].events[0].id).toBe("e2");

    // Check C2 row
    const c2Cells = cells.C2;
    expect(c2Cells[15].events).toHaveLength(1);
    expect(c2Cells[15].events[0].id).toBe("e3");
    expect(c2Cells[12].cropStart).toBe(true);
    expect(c2Cells[20].cropEnd).toBe(true);
  });

  it("should return empty model for null base data", () => {
    const { result } = renderHook(() => useGanttViewModel(null, "land"));
    expect(result.current).toEqual({
      rowOrder: [],
      rowLabelById: {},
      cellsByRow: {},
    });
  });
});
