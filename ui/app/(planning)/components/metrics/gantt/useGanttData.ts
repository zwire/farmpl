import { useMemo } from "react";
import type { PlanUiState } from "@/lib/domain/planning-ui-types";
import type { OptimizationTimelineView } from "@/lib/types/planning";
import { computeThirdRanges, paintSpanOnDayCells, thirdStartDay } from "@/lib/utils/thirds";

export interface LandPeriodCell {
  cropId?: string;
  cropName?: string;
  cropStart?: boolean;
  cropEnd?: boolean;
  events: GanttEventMarker[];
}

export interface GanttSpan {
  id: string;
  landId: string;
  landName: string;
  cropId: string;
  cropName: string;
  startIndex: number;
  endIndex: number;
  areaA: number;
}

export interface GanttEventMarker {
  id: string;
  index: number;
  cropId: string;
  landId?: string;
  label: string;
  workerUsages: { workerId: string; hours: number }[];
  resourceUsages: { resourceId: string; quantity: number; unit: string }[];
}

export interface GanttViewModel {
  spans: GanttSpan[];
  events: GanttEventMarker[];
  totalDays: number;
  startDateIso: string;
  landOrder: string[];
  landNameById: Record<string, string>;
  cropNameById: Record<string, string>;
  landPeriodCells: Record<string, LandPeriodCell[]>;
  workerNameById: Record<string, string>;
  resourceNameById: Record<string, string>;
}

const spanId = (land: string, crop: string, start: number, end: number) =>
  `${land}-${crop}-${start}-${end}`;

export const useGanttData = (
  timeline: OptimizationTimelineView | undefined,
  plan: PlanUiState | undefined,
): GanttViewModel | null => {
  return useMemo(() => {
    if (!timeline) return null;

    const startDateIso =
      timeline?.startDateIso ??
      plan?.horizon.startDate ??
      new Date().toISOString().slice(0, 10);

    const spans: GanttSpan[] = timeline.landSpans.map((span) => ({
      id: spanId(span.landId, span.cropId, span.startIndex, span.endIndex),
      landId: span.landId,
      landName: span.landName ?? "",
      cropId: span.cropId,
      cropName: span.cropName ?? "",
      startIndex: span.startIndex,
      endIndex: span.endIndex,
      areaA: span.areaA,
    }));

    const events: GanttEventMarker[] =
      timeline.events.flatMap<GanttEventMarker>((event) => {
        const base = {
          index: event.index,
          cropId: event.cropId,
          label: event.eventName ?? "",
          workerUsages: event.workerUsages,
          resourceUsages: event.resourceUsages,
        };
        const landIds =
          event.landIds && event.landIds.length > 0 ? event.landIds : undefined;
        if (!landIds) {
          return [
            {
              id: `${event.eventId}-${event.index}`,
              ...base,
            },
          ];
        }
        return landIds.map((landId) => ({
          id: `${event.eventId}-${event.index}-${landId}`,
          landId,
          ...base,
        }));
      });

    const totalDays = plan?.horizon.totalDays ?? 0;
    // Build third → day-range mapping (consistent with chart scale)
    const thirdRanges = computeThirdRanges(startDateIso, totalDays);
    const landOrder = Array.from(new Set(spans.map((span) => span.landId)));
    const landNameById: Record<string, string> = {};
    for (const span of spans) {
      if (!(span.landId in landNameById))
        landNameById[span.landId] = span.landName;
    }
    const cropNameById: Record<string, string> = {};
    for (const span of spans) {
      if (!(span.cropId in cropNameById))
        cropNameById[span.cropId] = span.cropName;
    }

    const planLandIds = plan ? plan.lands.map((land) => land.id) : [];
    const mergedLandOrder = landOrder.length > 0 ? landOrder : planLandIds;

    const landPeriodCells: Record<string, LandPeriodCell[]> = {};
    mergedLandOrder.forEach((landId) => {
      landPeriodCells[landId] = Array.from({ length: totalDays }, () => ({
        events: [],
      }));
    });

    spans.forEach((span) => {
      const cells = landPeriodCells[span.landId];
      if (!cells) return;
      paintSpanOnDayCells(cells, span, thirdRanges);
    });

    events.forEach((event) => {
      if (!event.landId) return;
      const cells = landPeriodCells[event.landId];
      if (!cells) return;
      const dayIndex = thirdStartDay(thirdRanges, event.index); // first day of the third
      if (dayIndex < 0 || !cells[dayIndex]) return;
      cells[dayIndex] = {
        ...cells[dayIndex],
        events: [...cells[dayIndex].events, event],
      };
    });

    return {
      spans,
      events,
      totalDays,
      startDateIso,
      landOrder: mergedLandOrder,
      landNameById,
      cropNameById,
      landPeriodCells,
      workerNameById: plan
        ? Object.fromEntries(plan.workers.map((w) => [w.id, w.name]))
        : {},
      resourceNameById: plan
        ? Object.fromEntries(plan.resources.map((r) => [r.id, r.name]))
        : {},
    };
  }, [plan, timeline]);
};
