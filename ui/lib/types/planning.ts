/**
 * Planning domain type definitions shared across the FarmPL planning UI.
 *
 * This module intentionally mirrors the FastAPI/Pydantic schemas under
 * `api/schemas/optimization.py` while also exposing UI-friendly view models
 * described in the design specification (PlanFormState / OptimizationResultView).
 */

// ========================= API payload models ========================= //

export type OptimizationResultStatus =
  | "ok"
  | "infeasible"
  | "timeout"
  | "error";
export type JobStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "timeout"
  | "canceled";

export interface ApiHorizon {
  num_days: number;
}

export interface ApiCrop {
  id: string;
  name: string;
  category?: string | null;
  price_per_a?: number | null;
  price_per_10a?: number | null;
}

export interface ApiEvent {
  id: string;
  crop_id: string;
  name: string;
  category?: string | null;
  start_cond?: number[] | null;
  end_cond?: number[] | null;
  frequency_days?: number | null;
  preceding_event_id?: string | null;
  lag_min_days?: number | null;
  lag_max_days?: number | null;
  people_required?: number | null;
  labor_total_per_a?: number | null;
  labor_daily_cap?: number | null;
  required_roles?: string[] | null;
  required_resources?: string[] | null;
  uses_land: boolean;
}

export interface ApiLand {
  id: string;
  name: string;
  area_a?: number | null;
  area_10a?: number | null;
  tags?: string[] | null;
  blocked_days?: number[] | null;
}

export interface ApiWorker {
  id: string;
  name: string;
  roles: string[];
  capacity_per_day: number;
  blocked_days?: number[] | null;
}

export interface ApiResource {
  id: string;
  name: string;
  category?: string | null;
  capacity_per_day?: number | null;
  blocked_days?: number[] | null;
}

export interface ApiCropAreaBound {
  crop_id: string;
  min_area_a?: number | null;
  min_area_10a?: number | null;
  max_area_a?: number | null;
  max_area_10a?: number | null;
}

export interface ApiFixedArea {
  land_id: string;
  crop_id: string;
  area_a?: number | null;
  area_10a?: number | null;
}

export interface ApiOptimizationStagesConfig {
  stage_order?: string[];
  step_tolerance_by?: Record<string, number> | null;
}

export interface ApiPlan {
  horizon: ApiHorizon;
  crops: ApiCrop[];
  events: ApiEvent[];
  lands: ApiLand[];
  workers: ApiWorker[];
  resources: ApiResource[];
  crop_area_bounds?: ApiCropAreaBound[] | null;
  fixed_areas?: ApiFixedArea[] | null;
  stages?: ApiOptimizationStagesConfig | null;
}

export interface ApiOptimizationRequest {
  idempotency_key?: string | null;
  plan?: ApiPlan | null;
  params?: Record<string, unknown> | null;
  timeout_ms?: number | null;
  priority?: number | null;
}

export interface ApiOptimizationTimelineLandSpan {
  land_id: string;
  crop_id: string;
  start_day: number;
  end_day: number;
  area_a: number;
}

export interface ApiWorkerUsageItem {
  worker_id: string;
  hours: number;
}

export interface ApiResourceUsageItem {
  resource_id: string;
  quantity: number;
  unit: string;
}

export interface ApiOptimizationTimelineEventItem {
  day: number;
  event_id: string;
  crop_id: string;
  land_ids: string[];
  worker_usages: ApiWorkerUsageItem[];
  resource_usages: ApiResourceUsageItem[];
  event_name?: string;
}

export interface ApiOptimizationTimeline {
  start_date?: string | null;
  land_spans: ApiOptimizationTimelineLandSpan[];
  events: ApiOptimizationTimelineEventItem[];
  entity_names?: {
    lands?: Record<string, string>;
    crops?: Record<string, string>;
    workers?: Record<string, string>;
    resources?: Record<string, string>;
    events?: Record<string, string>;
    [key: string]: Record<string, string> | undefined;
  };
}

export interface ApiOptimizationResult {
  status: OptimizationResultStatus;
  objective_value?: number | null;
  solution?: Record<string, unknown> | null;
  stats: Record<string, unknown>;
  warnings: string[];
  timeline?: ApiOptimizationTimeline | null;
}

export interface ApiJobInfo {
  job_id: string;
  status: JobStatus;
  progress: number;
  result?: ApiOptimizationResult | null;
  submitted_at: string;
  completed_at?: string | null;
}

// ========================= UI form/view models ========================= //

export type AreaUnit = "a" | "10a";
export type PriceUnit = "a" | "10a";

export interface AreaMeasurement {
  unit: AreaUnit;
  value: number;
}

export interface PriceMeasurement {
  unit: PriceUnit;
  value: number;
}

export interface PlanFormCrop {
  id: string;
  name: string;
  category?: string;
  price?: PriceMeasurement;
}

export interface PlanFormEvent {
  id: string;
  cropId: string;
  name: string;
  category?: string;
  startCond?: number[];
  endCond?: number[];
  frequencyDays?: number;
  precedingEventId?: string;
  lag?: {
    min?: number;
    max?: number;
  };
  labor?: {
    peopleRequired?: number;
    totalPerA?: number;
    dailyCap?: number;
  };
  requiredRoles?: string[];
  requiredResources?: string[];
  usesLand: boolean;
}

export interface PlanFormLand {
  id: string;
  name: string;
  area: AreaMeasurement;
  tags?: string[];
  blockedDays?: number[];
}

export interface PlanFormWorker {
  id: string;
  name: string;
  roles: string[];
  capacityPerDay: number;
  blockedDays?: number[];
}

export interface PlanFormResource {
  id: string;
  name: string;
  category?: string;
  capacityPerDay?: number;
  blockedDays?: number[];
}

export interface PlanFormCropAreaBound {
  cropId: string;
  minArea?: AreaMeasurement;
  maxArea?: AreaMeasurement;
}

export interface PlanFormFixedArea {
  landId: string;
  cropId: string;
  area: AreaMeasurement;
}

export interface PlanFormStagesConfig {
  stageOrder: string[];
  stepToleranceBy?: Record<string, number>;
}

export interface PlanFormState {
  horizon: {
    numDays: number;
  };
  crops: PlanFormCrop[];
  events: PlanFormEvent[];
  lands: PlanFormLand[];
  workers: PlanFormWorker[];
  resources: PlanFormResource[];
  cropAreaBounds: PlanFormCropAreaBound[];
  fixedAreas: PlanFormFixedArea[];
  stages?: PlanFormStagesConfig;
}

export interface OptimizationStageMetric {
  name: string;
  value: number;
  locked?: boolean;
}

export interface ConstraintHintView {
  id: string;
  priority: number;
  message: string;
  targetSection?: string;
}

export interface OptimizationResultSummaryView {
  status: OptimizationResultStatus;
  objectiveValue?: number;
  stats: {
    stages?: OptimizationStageMetric[];
    stageOrder?: string[];
    [key: string]: unknown;
  };
  summary?: Record<string, unknown>;
  constraintHints?: ConstraintHintView[];
  warnings?: string[];
}

export interface TimelineLandSpanView {
  landId: string;
  cropId: string;
  startDay: number;
  endDay: number;
  areaA: number;
  landName?: string;
  cropName?: string;
}

export interface TimelineEventView {
  day: number;
  eventId: string;
  cropId: string;
  landIds: string[];
  workerUsages: { workerId: string; hours: number }[];
  resourceUsages: { resourceId: string; quantity: number; unit: string }[];
  eventName?: string;
  cropName?: string;
  landNames?: (string | undefined)[];
  workerNames?: (string | undefined)[];
  resourceNames?: (string | undefined)[];
}

export interface OptimizationTimelineView {
  startDateIso: string;
  landSpans: TimelineLandSpanView[];
  events: TimelineEventView[];
}

export interface OptimizationResultView extends OptimizationResultSummaryView {
  timeline?: OptimizationTimelineView;
}

export interface JobInfoView {
  jobId: string;
  status: JobStatus;
  progress: number;
  result?: OptimizationResultView;
  submittedAt: string;
  completedAt?: string;
}

export interface OptimizationRequestDraft {
  idempotencyKey?: string;
  plan: PlanFormState;
  timeoutMs?: number;
  priority?: number;
}

// Utility types for downstream selectors / helpers
export type IdMap<T extends { id: string }> = Record<string, T>;

// ========================= Metrics timeline types ========================= //

export type MetricsInterval = "third" | "day";

export interface MetricsEventMetric {
  id: string;
  label: string;
  start_day: number; // 0-based day index
  end_day?: number | null;
  type?: string | null;
}

export interface MetricsWorkerMetric {
  worker_id: string;
  name: string;
  utilization: number; // hours used within bucket
  capacity: number; // capacity hours within bucket
}

export interface MetricsLandMetric {
  land_id: string;
  name: string;
  utilization: number; // area used within bucket
  capacity: number; // capacity area within bucket
}

export interface MetricsDaySummary {
  labor_total_hours: number;
  labor_capacity_hours: number;
  land_total_area: number;
  land_capacity_area: number;
}

export interface MetricsDayRecord {
  interval: MetricsInterval;
  day_index?: number | null; // present when interval=day
  period_key?: string | null; // present when interval=third (e.g., 2024-03:U)
  events: MetricsEventMetric[];
  workers: MetricsWorkerMetric[];
  lands: MetricsLandMetric[];
  summary: MetricsDaySummary;
}

export interface MetricsTimelineResponse {
  interval: MetricsInterval;
  records: MetricsDayRecord[];
}
