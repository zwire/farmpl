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

export type OccupancyEffect = "start" | "hold" | "end" | "none";

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
  occupancy_effect?: OccupancyEffect | null;
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

export interface ApiPreferences {
  w_profit?: number;
  w_labor?: number;
  w_idle?: number;
  w_dispersion?: number;
  w_peak?: number;
  w_diversity?: number;
}

export interface ApiOptimizationStagesConfig {
  stage_order?: string[];
  tolerance_by_stage?: Record<string, number> | null;
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
  preferences?: ApiPreferences | null;
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

export interface ApiOptimizationTimelineEventItem {
  day: number;
  event_id: string;
  crop_id: string;
  land_id?: string | null;
  worker_ids: string[];
  resource_ids: string[];
}

export interface ApiOptimizationTimeline {
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
  occupancyEffect?: Exclude<OccupancyEffect, "none"> | "none";
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

export interface PlanFormPreferences {
  wProfit: number;
  wLabor: number;
  wIdle: number;
  wDispersion: number;
  wPeak: number;
  wDiversity: number;
}

export interface PlanFormStagesConfig {
  stageOrder: string[];
  toleranceByStage?: Record<string, number>;
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
  preferences?: PlanFormPreferences;
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
  landId?: string;
  workerIds: string[];
  resourceIds: string[];
  eventName?: string;
  cropName?: string;
  landName?: string;
  workerNames?: (string | undefined)[];
  resourceNames?: (string | undefined)[];
}

export interface OptimizationTimelineView {
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
