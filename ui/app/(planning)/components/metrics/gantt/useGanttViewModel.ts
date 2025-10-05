import { useMemo } from "react";
import type { GanttViewMode } from "@/lib/state/view-preferences";
import type { GanttViewModel, LandDayCell } from "./useGanttData";

// Re-exporting LandDayCell as GanttViewCell for semantic clarity in the view model.
export type GanttViewCell = LandDayCell;

export interface GanttViewModelTransformed {
  rowOrder: string[];
  rowLabelById: Record<string, string>;
  cellsByRow: Record<string, GanttViewCell[]>;
}

const EMPTY_MODEL: GanttViewModelTransformed = {
  rowOrder: [],
  rowLabelById: {},
  cellsByRow: {},
};

export const useGanttViewModel = (
  baseData: GanttViewModel | null,
  mode: GanttViewMode,
): GanttViewModelTransformed => {
  return useMemo(() => {
    if (!baseData) {
      return EMPTY_MODEL;
    }

    if (mode === "land") {
      return {
        rowOrder: baseData.landOrder,
        rowLabelById: baseData.landNameById,
        cellsByRow: baseData.landDayCells,
      };
    }

    // mode === 'crop'
    const cropRowOrder = Array.from(
      new Set(baseData.spans.map((span) => span.cropId)),
    );

    const cropCellsByRow: Record<string, GanttViewCell[]> = {};
    for (const cropId of cropRowOrder) {
      cropCellsByRow[cropId] = Array.from(
        { length: baseData.totalDays },
        () => ({
          events: [],
        }),
      );
    }

    for (const span of baseData.spans) {
      const rowCells = cropCellsByRow[span.cropId];
      if (!rowCells) continue;

      for (let day = span.startDay; day <= span.endDay; day++) {
        if (day >= baseData.totalDays) continue;

        const cell = rowCells[day];
        if (!cell.cropId) {
          cell.cropId = span.cropId;
          cell.cropName = span.cropName;
        }
        if (day === span.startDay) {
          cell.cropStart = true;
        }
        if (day === span.endDay) {
          cell.cropEnd = true;
        }
      }
    }

    for (const event of baseData.events) {
      const rowCells = cropCellsByRow[event.cropId];
      if (rowCells && event.day < baseData.totalDays && rowCells[event.day]) {
        rowCells[event.day].events.push(event);
      }
    }

    return {
      rowOrder: cropRowOrder,
      rowLabelById: baseData.cropNameById,
      cellsByRow: cropCellsByRow,
    };
  }, [baseData, mode]);
};
