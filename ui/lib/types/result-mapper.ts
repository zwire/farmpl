import type {
  ApiOptimizationResult,
  OptimizationResultView,
} from "@/lib/types/planning";

const normalizeStageOrder = (stats: ApiOptimizationResult["stats"]) => {
  if (!stats) return [];
  const order = (stats as Record<string, unknown>).stage_order;
  if (Array.isArray(order)) return order as string[];
  const camel = (stats as Record<string, unknown>).stageOrder;
  return Array.isArray(camel) ? (camel as string[]) : [];
};

const normalizeStages = (
  stats: ApiOptimizationResult["stats"],
): { name: string; value: number; locked?: boolean }[] => {
  if (!stats) return [];
  const raw = (stats as Record<string, unknown>).stages;
  if (!Array.isArray(raw)) return [];
  const result: { name: string; value: number; locked?: boolean }[] = [];
  for (const stage of raw) {
    if (typeof stage !== "object" || stage === null) continue;
    const record = stage as Record<string, unknown>;
    const name = (record.name ?? record.stage ?? "") as string;
    if (!name) continue;
    const value = Number(record.value ?? 0);
    const locked = Boolean(record.locked ?? record.is_locked ?? false);
    result.push({ name, value, locked });
  }
  return result;
};

const normalizeConstraintHints = (api: ApiOptimizationResult) => {
  const hints: unknown = api.solution?.constraint_hints;
  if (!Array.isArray(hints)) return [];
  return hints.map((hint, index) => {
    if (typeof hint === "string") {
      return {
        id: String(index),
        priority: index + 1,
        message: hint,
      };
    }
    const record = hint as Record<string, unknown>;
    return {
      id: (record.id as string) ?? String(index),
      priority: Number(record.priority ?? index + 1) || index + 1,
      message: (record.message as string) ?? JSON.stringify(record),
      targetSection:
        (record.targetSection as string) ??
        (record.target_section as string) ??
        undefined,
    };
  });
};

const normalizeTimeline = (
  timeline: ApiOptimizationResult["timeline"],
): OptimizationResultView["timeline"] => {
  if (!timeline) return undefined;
  const entityNames = (timeline as any).entity_names as
    | {
        lands?: Record<string, string>;
        crops?: Record<string, string>;
        workers?: Record<string, string>;
        resources?: Record<string, string>;
        events?: Record<string, string>;
      }
    | undefined;
  const landSpans = Array.isArray(timeline.land_spans)
    ? timeline.land_spans.map((span) => ({
        landId: span.land_id,
        cropId: span.crop_id,
        startDay: span.start_day,
        endDay: span.end_day,
        areaA: span.area_a,
        // 追加の名前情報（存在すれば）
        landName: entityNames?.lands?.[span.land_id],
        cropName: entityNames?.crops?.[span.crop_id],
      }))
    : [];
  const events = Array.isArray(timeline.events)
    ? timeline.events.map((event) => ({
        day: event.day,
        eventId: event.event_id,
        cropId: event.crop_id,
        landId: event.land_id ?? undefined,
        workerIds: event.worker_ids,
        resourceIds: event.resource_ids,
        // 追加の名前情報（存在すれば）
        eventName: entityNames?.events?.[event.event_id],
        cropName: entityNames?.crops?.[event.crop_id],
        landName: event.land_id ? entityNames?.lands?.[event.land_id] : undefined,
        workerNames:
          Array.isArray(event.worker_ids)
            ? event.worker_ids.map((id) => entityNames?.workers?.[id]).filter(Boolean)
            : undefined,
        resourceNames:
          Array.isArray(event.resource_ids)
            ? event.resource_ids
                .map((id) => entityNames?.resources?.[id])
                .filter(Boolean)
            : undefined,
      }))
    : [];
  return { landSpans, events } as any;
};

export const mapApiResultToView = (
  api: ApiOptimizationResult,
): OptimizationResultView => ({
  status: api.status,
  objectiveValue: api.objective_value ?? undefined,
  summary: (api.solution?.summary as Record<string, unknown>) ?? {},
  stats: {
    ...api.stats,
    stageOrder: normalizeStageOrder(api.stats ?? {}),
    stages: normalizeStages(api.stats ?? {}),
  },
  constraintHints: normalizeConstraintHints(api),
  warnings: api.warnings ?? [],
  timeline: normalizeTimeline(api.timeline ?? undefined),
});
