import { useMemo } from "react";
import type { PlanUiState } from "@/lib/domain/planning-ui-types";
import type { OptimizationTimelineView } from "@/lib/types/planning";

export interface DayLabel {
  day: number;
  dateIso: string;
  label: string;
  isMajor: boolean;
}

export interface LandDayCell {
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
  startDay: number;
  endDay: number;
  areaA: number;
  startDateIso: string;
  endDateIso: string;
}

export interface GanttEventMarker {
  id: string;
  day: number;
  cropId: string;
  landId?: string;
  label: string;
  dateIso: string;
  workerUsages: { workerId: string; hours: number }[];
  resourceUsages: { resourceId: string; quantity: number; unit: string }[];
}

export interface GanttViewModel {
  spans: GanttSpan[];
  events: GanttEventMarker[];
  maxDay: number;
  totalDays: number;
  startDateIso: string;
  dayLabels: DayLabel[];
  landOrder: string[];
  landNameById: Record<string, string>;
  cropNameById: Record<string, string>;
  landDayCells: Record<string, LandDayCell[]>;
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

    const dayToIso = (day: number) => addDaysIso(startDateIso, day);

    const spans: GanttSpan[] = timeline.landSpans.map((span) => ({
      id: spanId(span.landId, span.cropId, span.startDay, span.endDay),
      landId: span.landId,
      landName: span.landName ?? "",
      cropId: span.cropId,
      cropName: span.cropName ?? "",
      startDay: span.startDay,
      endDay: span.endDay,
      areaA: span.areaA,
      startDateIso: dayToIso(span.startDay),
      endDateIso: dayToIso(span.endDay),
    }));

    const events: GanttEventMarker[] =
      timeline.events.flatMap<GanttEventMarker>((event) => {
        const base = {
          day: event.day,
          cropId: event.cropId,
          label: event.eventName ?? "",
          dateIso: dayToIso(event.day),
          workerUsages: event.workerUsages,
          resourceUsages: event.resourceUsages,
        };
        const landIds =
          event.landIds && event.landIds.length > 0 ? event.landIds : undefined;
        if (!landIds) {
          return [
            {
              id: `${event.eventId}-${event.day}`,
              ...base,
            },
          ];
        }
        return landIds.map((landId) => ({
          id: `${event.eventId}-${event.day}-${landId}`,
          landId,
          ...base,
        }));
      });

    const maxDayFromSpans = spans.length
      ? Math.max(...spans.map((span) => span.endDay))
      : 0;
    const maxDayFromEvents = events.length
      ? Math.max(...events.map((event) => event.day))
      : 0;
    const maxDay = Math.max(maxDayFromSpans, maxDayFromEvents);
    const computedTotalDays = Math.max(
      plan?.horizon.totalDays ?? maxDay + 1,
      maxDay + 1,
    );

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

    const dayLabels: DayLabel[] = Array.from(
      { length: computedTotalDays },
      (_, day) => {
        const dateIso = addDaysIso(startDateIso, day);
        const date = parseIsoToDate(dateIso);
        const label = formatShortDate(date);
        const isMajor = date.getUTCDate() === 1 || day === 0;
        return { day, dateIso, label, isMajor };
      },
    );

    const landDayCells: Record<string, LandDayCell[]> = {};
    mergedLandOrder.forEach((landId) => {
      landDayCells[landId] = Array.from({ length: computedTotalDays }, () => ({
        events: [],
      }));
    });

    spans.forEach((span) => {
      const cells = landDayCells[span.landId];
      if (!cells) return;
      for (
        let day = span.startDay;
        day <= span.endDay && day < cells.length;
        day += 1
      ) {
        const current = cells[day];
        cells[day] = {
          ...current,
          cropId: span.cropId,
          cropName: span.cropName,
          cropStart: day === span.startDay,
          cropEnd: day === span.endDay,
          events: current.events,
        };
      }
    });

    events.forEach((event) => {
      if (!event.landId) return;
      const cells = landDayCells[event.landId];
      if (!cells) return;
      if (!cells[event.day]) return;
      cells[event.day] = {
        ...cells[event.day],
        events: [...cells[event.day].events, event],
      };
    });

    return {
      spans,
      events,
      maxDay,
      totalDays: computedTotalDays,
      startDateIso,
      dayLabels,
      landOrder: mergedLandOrder,
      landNameById,
      cropNameById,
      landDayCells,
      workerNameById: plan
        ? Object.fromEntries(plan.workers.map((w) => [w.id, w.name]))
        : {},
      resourceNameById: plan
        ? Object.fromEntries(plan.resources.map((r) => [r.id, r.name]))
        : {},
    };
  }, [plan, timeline]);
};

const addDaysIso = (iso: string, offset: number): string => {
  const [year, month, day] = iso.split("-").map(Number);
  const base = Date.UTC(year, (month || 1) - 1, day || 1);
  const next = new Date(base + offset * 24 * 60 * 60 * 1000);
  const nextYear = next.getUTCFullYear();
  const nextMonth = String(next.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(next.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
};

const parseIsoToDate = (iso: string): Date => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
};

const formatShortDate = (date: Date): string => {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
};
