import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { GanttViewModel } from "@/app/(planning)/components/metrics/gantt/useGanttData";
import { useGanttViewModel } from "@/app/(planning)/components/metrics/gantt/useGanttViewModel";

const mockBaseData: GanttViewModel = {
  spans: [
    {
      id: "s1",
      landId: "L1",
      landName: "Land 1",
      cropId: "C1",
      cropName: "Crop 1",
      startIndex: 0,
      endIndex: 1,
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
      startIndex: 0,
      endIndex: 1,
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
      startIndex: 1,
      endIndex: 2,
      areaA: 1,
      startDateIso: "2024-01-13",
      endDateIso: "2024-01-21",
    },
  ],
  events: [
    {
      id: "e1-0-L1",
      index: 0,
      cropId: "C1",
      landId: "L1",
      label: "Event 1",
      workerUsages: [],
      resourceUsages: [],
    },
    {
      id: "e2-1",
      index: 1,
      cropId: "C1",
      label: "Event 2 (no land)",
      workerUsages: [],
      resourceUsages: [],
    },
    {
      id: "e3-2-L1",
      index: 2,
      cropId: "C2",
      landId: "L1",
      label: "Event 3",
      workerUsages: [],
      resourceUsages: [],
    },
  ],
  totalDays: 30,
  startDateIso: "2024-01-01",
  landOrder: ["L1", "L2"],
  landNameById: { L1: "Land 1", L2: "Land 2" },
  cropNameById: { C1: "Crop 1", C2: "Crop 2" },
  landPeriodCells: {
    L1: Array.from({ length: 30 }, () => ({ events: [] })),
    L2: Array.from({ length: 30 }, () => ({ events: [] })),
  },
  workerNameById: {},
  resourceNameById: {},
};

describe("useGanttViewModel", () => {
  it("should return land-based view model when mode is 'land'", () => {
    const { result } = renderHook(() =>
      useGanttViewModel(mockBaseData, "land"),
    );

    const rows = result.current.rowOrder;
    // special capacity rows may be appended; only assert the primary rows first
    expect(rows.slice(0, 2)).toEqual(["L1", "L2"]);
    // primary labels should be correct
    expect(result.current.rowLabelById.L1).toEqual("Land 1");
    expect(result.current.rowLabelById.L2).toEqual("Land 2");
    expect(result.current.cellsByRow).toEqual(mockBaseData.landPeriodCells);
  });

  it("should return crop-based view model when mode is 'crop'", () => {
    const { result } = renderHook(() =>
      useGanttViewModel(mockBaseData, "crop"),
    );

    const rows = result.current.rowOrder;
    expect(rows.slice(0, 2)).toEqual(["C1", "C2"]);
    expect(result.current.rowLabelById.C1).toEqual("Crop 1");
    expect(result.current.rowLabelById.C2).toEqual("Crop 2");

    const cells = result.current.cellsByRow;
    // filter out special rows
    const normalKeys = Object.keys(cells).filter((k) => !k.startsWith("__"));
    expect(normalKeys).toEqual(["C1", "C2"]);

    // Check C1 row
    const c1Cells = cells.C1;
    expect(c1Cells.length).toBe(30);
    expect(Array.isArray(c1Cells)).toBe(true);

    // Check C2 row
    expect(Array.isArray(cells.C2)).toBe(true);
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
