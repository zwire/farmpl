import type {
  ApiOptimizationResult,
  ApiOptimizationTimeline,
  MetricsDayRecord,
  MetricsEventMetric,
  MetricsInterval,
  MetricsLandMetric,
  MetricsTimelineResponse,
  MetricsWorkerMetric,
  OptimizationResultView,
  OptimizationTimelineView,
} from "./planning";

function isInterval(v: unknown): v is MetricsInterval {
  return v === "day" || v === "decade";
}

function asNumber(x: any, def = 0): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : def;
}

function mapEvent(e: any): MetricsEventMetric {
  return {
    id: String(e?.id ?? ""),
    label: String(e?.label ?? ""),
    start_day: asNumber(e?.start_day, 0),
    end_day: e?.end_day == null ? null : asNumber(e.end_day),
    type: e?.type == null ? null : String(e.type),
  };
}

function mapWorker(w: any): MetricsWorkerMetric {
  return {
    worker_id: String(w?.worker_id ?? ""),
    name: String(w?.name ?? ""),
    utilization: asNumber(w?.utilization, 0),
    capacity: asNumber(w?.capacity, 0),
  };
}

function mapLand(l: any): MetricsLandMetric {
  return {
    land_id: String(l?.land_id ?? ""),
    name: String(l?.name ?? ""),
    utilization: asNumber(l?.utilization, 0),
    capacity: asNumber(l?.capacity, 0),
  };
}

function mapRecord(interval: MetricsInterval, r: any): MetricsDayRecord {
  const rec: MetricsDayRecord = {
    interval,
    day_index: r?.day_index ?? null,
    period_key: r?.period_key ?? null,
    events: Array.isArray(r?.events) ? r.events.map(mapEvent) : [],
    workers: Array.isArray(r?.workers) ? r.workers.map(mapWorker) : [],
    lands: Array.isArray(r?.lands) ? r.lands.map(mapLand) : [],
    summary: {
      labor_total_hours: asNumber(r?.summary?.labor_total_hours, 0),
      labor_capacity_hours: asNumber(r?.summary?.labor_capacity_hours, 0),
      land_total_area: asNumber(r?.summary?.land_total_area, 0),
      land_capacity_area: asNumber(r?.summary?.land_capacity_area, 0),
    },
  };

  // Sanity: enforce day vs decade invariants
  if (interval === "day") {
    rec.day_index = asNumber(rec.day_index, 0);
    rec.period_key = null;
  } else {
    rec.day_index = null;
    rec.period_key = String(rec.period_key ?? "");
  }
  return rec;
}

export function mapTimelineResponse(json: unknown): MetricsTimelineResponse {
  const obj: any = json ?? {};
  const interval: unknown = obj.interval;
  if (!isInterval(interval)) {
    throw new Error("metrics timeline: invalid interval");
  }
  const recordsSrc: any[] = Array.isArray(obj.records) ? obj.records : [];
  const records: MetricsDayRecord[] = recordsSrc.map((r) =>
    mapRecord(interval, r),
  );
  return { interval, records };
}

// ========================= API → View mapper (existing UI path) ========================= //

function mapApiTimeline(
  tl: ApiOptimizationTimeline | null | undefined,
): OptimizationTimelineView | undefined {
  if (!tl) return undefined;
  return {
    landSpans: (tl.land_spans ?? []).map((s) => ({
      landId: s.land_id,
      cropId: s.crop_id,
      startDay: s.start_day,
      endDay: s.end_day,
      areaA: s.area_a,
      landName: tl.entity_names?.lands?.[s.land_id],
      cropName: tl.entity_names?.crops?.[s.crop_id],
    })),
    events: (tl.events ?? []).map((e) => {
      const landIds = e.land_ids ?? (e.land_id ? [e.land_id] : []);
      return {
        day: e.day,
        eventId: e.event_id,
        cropId: e.crop_id,
        landIds,
        workerIds: e.worker_ids ?? [],
        resourceIds: e.resource_ids ?? [],
        eventName: tl.entity_names?.events?.[e.event_id],
        cropName: tl.entity_names?.crops?.[e.crop_id],
        landNames: landIds.map((id) => tl.entity_names?.lands?.[id]),
        workerNames: (e.worker_ids ?? []).map(
          (id) => tl.entity_names?.workers?.[id],
        ),
        resourceNames: (e.resource_ids ?? []).map(
          (id) => tl.entity_names?.resources?.[id],
        ),
      };
    }),
  };
}

export function mapApiResultToView(
  api: ApiOptimizationResult,
): OptimizationResultView {
  return {
    status: api.status,
    objectiveValue: api.objective_value ?? undefined,
    stats: {
      ...(api.stats ?? {}),
      stages: (api.stats as any)?.stages ?? undefined,
      stageOrder: (api.stats as any)?.stage_order ?? undefined,
    },
    summary: (api as any).summary ?? undefined,
    constraintHints: (api as any).constraint_hints ?? undefined,
    warnings: api.warnings ?? [],
    timeline: mapApiTimeline(api.timeline ?? undefined),
  };
}
