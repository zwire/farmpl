import { useMemo } from "react";

import type {
  OptimizationTimelineView,
  PlanFormState,
} from "@/lib/types/planning";

export interface GanttFilters {
  landId: string | "all";
  cropId: string | "all";
}

export interface GanttSpan {
  id: string;
  landId: string;
  landName: string;
  cropId: string;
  cropName: string;
  startDay: number;
  endDay: number;
  areaA: number;
}

export interface GanttEventMarker {
  id: string;
  day: number;
  cropId: string;
  landId?: string;
  label: string;
}

export interface GanttViewModel {
  spans: GanttSpan[];
  events: GanttEventMarker[];
  maxDay: number;
  landOrder: string[];
  cropOptions: string[];
  landOptions: string[];
  landNameById: Record<string, string>;
  cropNameById: Record<string, string>;
}

const spanId = (land: string, crop: string, start: number, end: number) =>
  `${land}-${crop}-${start}-${end}`;

export const useGanttData = (
  timeline: OptimizationTimelineView | undefined,
  plan: PlanFormState | undefined,
): GanttViewModel | null => {
  return useMemo(() => {
    if (!timeline) return null;

    const spans: GanttSpan[] = timeline.landSpans.map((span) => ({
      id: spanId(span.landId, span.cropId, span.startDay, span.endDay),
      landId: span.landId,
      landName: span.landName ?? "",
      cropId: span.cropId,
      cropName: span.cropName ?? "",
      startDay: span.startDay,
      endDay: span.endDay,
      areaA: span.areaA,
    }));

    const events: GanttEventMarker[] = timeline.events.map((event) => ({
      id: `${event.eventId}-${event.day}`,
      day: event.day,
      cropId: event.cropId,
      landId: event.landId ?? undefined,
      label: event.eventName ?? "",
    }));

    const maxDayFromSpans = spans.length
      ? Math.max(...spans.map((span) => span.endDay))
      : 0;
    const maxDayFromEvents = events.length
      ? Math.max(...events.map((event) => event.day))
      : 0;
    const maxDay = Math.max(maxDayFromSpans, maxDayFromEvents);

    const landOrder = Array.from(new Set(spans.map((span) => span.landId)));
    const cropOptions = Array.from(new Set(spans.map((span) => span.cropId)));

    const landNameById: Record<string, string> = {};
    for (const span of spans) {
      if (!(span.landId in landNameById)) landNameById[span.landId] = span.landName;
    }
    const cropNameById: Record<string, string> = {};
    for (const span of spans) {
      if (!(span.cropId in cropNameById)) cropNameById[span.cropId] = span.cropName;
    }

    const planLandIds = plan ? plan.lands.map((land) => land.id) : [];
    const mergedLandOrder = landOrder.length > 0 ? landOrder : planLandIds;

    return {
      spans,
      events,
      maxDay,
      landOrder: mergedLandOrder,
      cropOptions,
      landOptions: mergedLandOrder,
      landNameById,
      cropNameById,
    };
  }, [plan, timeline]);
};
