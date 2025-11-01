import type {
  ApiOptimizationResult,
  ApiOptimizationTimeline,
  ConstraintHintView,
  MetricsEventMetric,
  MetricsLandMetric,
  MetricsPeriodRecord,
  MetricsTimelineResponse,
  MetricsWorkerMetric,
  OptimizationResultView,
  OptimizationStageMetric,
  OptimizationTimelineView,
} from "./planning";

function asNumber(x: unknown, def = 0): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : def;
}

function mapEvent(e: unknown): MetricsEventMetric {
  const obj = e && typeof e === "object" ? (e as Record<string, unknown>) : {};
  return {
    id: String(obj.id ?? ""),
    label: String(obj.label ?? ""),
    start_index: asNumber(obj.start_index, 0),
    end_index: obj.end_index == null ? null : asNumber(obj.end_index),
    type: obj.type == null ? null : String(obj.type),
  };
}

function mapWorker(w: unknown): MetricsWorkerMetric {
  const obj = w && typeof w === "object" ? (w as Record<string, unknown>) : {};
  return {
    worker_id: String(obj.worker_id ?? ""),
    name: String(obj.name ?? ""),
    utilization: asNumber(obj.utilization, 0),
    capacity: asNumber(obj.capacity, 0),
  };
}

function mapLand(l: unknown): MetricsLandMetric {
  const obj = l && typeof l === "object" ? (l as Record<string, unknown>) : {};
  return {
    land_id: String(obj.land_id ?? ""),
    name: String(obj.name ?? ""),
    utilization: asNumber(obj.utilization, 0),
    capacity: asNumber(obj.capacity, 0),
  };
}

function mapRecord(r: unknown): MetricsPeriodRecord {
  const obj = r && typeof r === "object" ? (r as Record<string, unknown>) : {};
  const periodKeyRaw = (obj as { period_key?: unknown }).period_key;
  const rec: MetricsPeriodRecord = {
    period_key: periodKeyRaw == null ? null : String(periodKeyRaw),
    events: Array.isArray(obj.events) ? obj.events.map(mapEvent) : [],
    workers: Array.isArray(obj.workers) ? obj.workers.map(mapWorker) : [],
    lands: Array.isArray(obj.lands) ? obj.lands.map(mapLand) : [],
    summary: {
      labor_total_hours: asNumber(
        (obj.summary as Record<string, unknown> | undefined)?.labor_total_hours,
        0,
      ),
      labor_capacity_hours: asNumber(
        (obj.summary as Record<string, unknown> | undefined)
          ?.labor_capacity_hours,
        0,
      ),
      land_total_area: asNumber(
        (obj.summary as Record<string, unknown> | undefined)?.land_total_area,
        0,
      ),
      land_capacity_area: asNumber(
        (obj.summary as Record<string, unknown> | undefined)
          ?.land_capacity_area,
        0,
      ),
    },
  };

  rec.period_key = String(rec.period_key ?? "");
  return rec;
}

export function mapTimelineResponse(json: unknown): MetricsTimelineResponse {
  const obj =
    json && typeof json === "object" ? (json as Record<string, unknown>) : {};
  const recordsSrc: unknown[] = Array.isArray(obj.records) ? obj.records : [];
  const records: MetricsPeriodRecord[] = recordsSrc.map((r) => mapRecord(r));
  return { records };
}

// ========================= API → View mapper (existing UI path) ========================= //

function mapApiTimeline(
  tl: ApiOptimizationTimeline | null | undefined,
): OptimizationTimelineView | undefined {
  if (!tl) return undefined;
  return {
    startDateIso:
      (tl.start_date as string | undefined) ??
      new Date().toISOString().slice(0, 10),
    landSpans: (tl.land_spans ?? []).map((s) => ({
      landId: s.land_id,
      cropId: s.crop_id,
      startIndex: s.start_index,
      endIndex: s.end_index,
      areaA: s.area_a,
      landName: tl.entity_names?.lands?.[s.land_id],
      cropName: tl.entity_names?.crops?.[s.crop_id],
    })),
    events: (tl.events ?? []).map((e) => {
      const landIds = Array.isArray(e.land_ids) ? e.land_ids : [];
      return {
        index: e.index,
        eventId: e.event_id,
        cropId: e.crop_id,
        landIds,
        workerUsages: (e.worker_usages ?? []).map((u) => ({
          workerId: u.worker_id,
          hours: Number(u.hours ?? 0),
        })),
        resourceUsages: (e.resource_usages ?? []).map((u) => ({
          resourceId: u.resource_id,
          quantity: Number(u.quantity ?? 0),
          unit: String(u.unit ?? ""),
        })),
        eventName: e.event_name ?? tl.entity_names?.events?.[e.event_id],
        cropName: tl.entity_names?.crops?.[e.crop_id],
        landNames: landIds.map((id) => tl.entity_names?.lands?.[id]),
        workerNames: (e.worker_usages ?? []).map(
          (u) => tl.entity_names?.workers?.[u.worker_id],
        ),
        resourceNames: (e.resource_usages ?? []).map(
          (u) => tl.entity_names?.resources?.[u.resource_id],
        ),
      };
    }),
  };
}

export function mapApiResultToView(
  api: ApiOptimizationResult,
): OptimizationResultView {
  const statsRaw = api.stats ?? {};
  const statsRec = statsRaw as Record<string, unknown> & {
    stages?: unknown;
    stage_order?: unknown;
  };
  const stagesUnknown = statsRec.stages;
  const stageOrderUnknown = statsRec.stage_order;
  let stages: OptimizationStageMetric[] | undefined;
  if (Array.isArray(stagesUnknown)) {
    stages = stagesUnknown.map((s): OptimizationStageMetric => {
      const o =
        s && typeof s === "object" ? (s as Record<string, unknown>) : {};
      const out: OptimizationStageMetric = {
        name: String(o.name ?? ""),
        value: asNumber(o.value, 0),
      };
      if (typeof o.locked === "boolean") out.locked = o.locked;
      return out;
    });
  }
  const stageOrder = Array.isArray(stageOrderUnknown)
    ? (stageOrderUnknown.filter((x) => typeof x === "string") as string[])
    : undefined;

  const solution = api.solution as Record<string, unknown> | null | undefined;
  const summary =
    solution && typeof solution === "object"
      ? ((solution as { summary?: Record<string, unknown> }).summary ??
        undefined)
      : undefined;
  const constraintHints =
    solution && typeof solution === "object"
      ? ((solution as { constraint_hints?: ConstraintHintView[] })
          .constraint_hints ?? undefined)
      : undefined;

  return {
    status: api.status,
    objectiveValue: api.objective_value ?? undefined,
    stats: {
      ...(api.stats ?? {}),
      stages,
      stageOrder,
    },
    summary,
    constraintHints,
    warnings: api.warnings ?? [],
    timeline: mapApiTimeline(api.timeline ?? undefined),
  };
}
