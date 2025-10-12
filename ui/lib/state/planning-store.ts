import { create } from "zustand";
import {
  INITIAL_STEP_ID,
  type WizardStepId,
} from "@/app/(planning)/components/request-wizard/steps";
import { PlanningCalendarService } from "@/lib/domain/planning-calendar";
import type {
  DateRange,
  IsoDateString,
  PlanUiState,
} from "@/lib/domain/planning-ui-types";
import type { JobStatus, OptimizationResultView } from "@/lib/types/planning";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const DEFAULT_STAGE_ORDER = [
  "profit",
  "labor",
  "idle",
  "dispersion",
  "peak",
  "diversity",
];

const WIZARD_STEP_IDS: WizardStepId[] = [
  "horizon",
  "crops",
  "lands",
  "workers",
  "resources",
  "constraints",
  "events",
];

export const DRAFT_STORAGE_KEY = "farmpl-planning-draft-v1";

let draftTtlMs =
  Number(process.env.NEXT_PUBLIC_PLANNING_DRAFT_TTL_DAYS ?? "0") > 0
    ? Number(process.env.NEXT_PUBLIC_PLANNING_DRAFT_TTL_DAYS) * MS_PER_DAY
    : null;

const isDraftExpired = (savedAt: string | null | undefined): boolean => {
  if (draftTtlMs == null) return false;
  if (!savedAt) return true;
  const timestamp = Date.parse(savedAt);
  if (Number.isNaN(timestamp)) return true;
  return Date.now() - timestamp > draftTtlMs;
};

const DEFAULT_PLAN_LENGTH_DAYS = 30;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const formatIsoDate = (date: Date): IsoDateString => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as IsoDateString;
};

const parseIsoDate = (value: string): Date | null => {
  if (!ISO_DATE_PATTERN.test(value)) return null;
  const [yearStr, monthStr, dayStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
};

const addDays = (date: Date, offset: number): Date =>
  new Date(date.getTime() + offset * MS_PER_DAY);

const toTodayIsoDate = (): IsoDateString => {
  const now = new Date();
  const truncated = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  return formatIsoDate(truncated);
};

const buildHorizonFromLength = (length: number): PlanUiState["horizon"] => {
  const startDate = toTodayIsoDate();
  const start = parseIsoDate(startDate);
  if (!start) {
    return buildDefaultHorizon();
  }
  const end = formatIsoDate(addDays(start, Math.max(length, 1) - 1));
  return PlanningCalendarService.recalculateHorizon(startDate, end);
};

const buildDefaultHorizon = () =>
  buildHorizonFromLength(DEFAULT_PLAN_LENGTH_DAYS);

const sanitizeDateList = (dates?: string[]): IsoDateString[] | undefined => {
  if (!dates || dates.length === 0) return undefined;
  const unique = Array.from(
    new Set(
      dates.filter(
        (value): value is IsoDateString =>
          typeof value === "string" && ISO_DATE_PATTERN.test(value),
      ),
    ),
  ).sort();
  return unique.length ? unique : undefined;
};

const sanitizeDateListWithinHorizon = (
  dates: string[] | undefined,
  horizon: PlanUiState["horizon"],
): IsoDateString[] | undefined => {
  const sanitized = sanitizeDateList(dates);
  if (!sanitized) return undefined;
  const horizonStart = parseIsoDate(horizon.startDate);
  const horizonEnd = parseIsoDate(horizon.endDate);
  if (!horizonStart || !horizonEnd) {
    return sanitized;
  }
  const within = sanitized.filter((value) => {
    const date = parseIsoDate(value);
    if (!date) return false;
    return date >= horizonStart && date <= horizonEnd;
  });
  return within.length ? within : undefined;
};

const clampDateToHorizon = (
  value: Date,
  horizonStart: Date,
  horizonEnd: Date,
): Date => {
  if (value < horizonStart) return horizonStart;
  if (value > horizonEnd) return horizonEnd;
  return value;
};

const expandRangesToDateList = (
  ranges: DateRange[] | undefined,
  horizon: PlanUiState["horizon"],
): IsoDateString[] | undefined => {
  if (!ranges || ranges.length === 0) return undefined;
  const horizonStart = parseIsoDate(horizon.startDate);
  const horizonEnd = parseIsoDate(horizon.endDate);
  if (!horizonStart || !horizonEnd) {
    return sanitizeDateList(
      ranges
        .flatMap((range) => [range.start, range.end])
        .filter(
          (value): value is IsoDateString =>
            typeof value === "string" && ISO_DATE_PATTERN.test(value),
        ),
    );
  }
  const allDates: string[] = [];
  for (const range of ranges) {
    const rawStart = range.start ? parseIsoDate(range.start) : horizonStart;
    const rawEnd = range.end ? parseIsoDate(range.end) : horizonEnd;
    if (!rawStart || !rawEnd) continue;
    const clampedStart = clampDateToHorizon(rawStart, horizonStart, horizonEnd);
    const clampedEnd = clampDateToHorizon(rawEnd, horizonStart, horizonEnd);
    if (clampedStart > clampedEnd) continue;
    for (
      let cursor = clampedStart;
      cursor <= clampedEnd;
      cursor = addDays(cursor, 1)
    ) {
      allDates.push(formatIsoDate(cursor));
    }
  }
  return sanitizeDateList(allDates);
};

const collapseDatesToRanges = (
  dates: IsoDateString[] | undefined,
  horizon: PlanUiState["horizon"],
): DateRange[] => {
  const sanitized = sanitizeDateListWithinHorizon(dates, horizon);
  if (!sanitized) return [];
  const ranges: DateRange[] = [];
  let currentStart = sanitized[0];
  let previous = sanitized[0];

  const consecutive = (a: string, b: string): boolean => {
    const dateA = parseIsoDate(a);
    const dateB = parseIsoDate(b);
    if (!dateA || !dateB) return false;
    return (dateB.getTime() - dateA.getTime()) / MS_PER_DAY === 1;
  };

  for (let i = 1; i < sanitized.length; i += 1) {
    const value = sanitized[i];
    if (consecutive(previous, value)) {
      previous = value;
      continue;
    }
    ranges.push({ start: currentStart, end: previous });
    currentStart = value;
    previous = value;
  }

  ranges.push({ start: currentStart, end: previous });
  return ranges;
};

export const PlanningEventDateUtils = {
  sanitizeDateList,
  sanitizeDateListWithinHorizon,
  expandRangesToDateList,
  collapseDatesToRanges,
};

const sanitizeRanges = (ranges?: DateRange[]): DateRange[] =>
  (ranges ?? [])
    .filter((range): range is DateRange => Boolean(range))
    .map((range) => {
      const start =
        typeof range.start === "string" && ISO_DATE_PATTERN.test(range.start)
          ? range.start
          : null;
      const end =
        range.end === null
          ? null
          : typeof range.end === "string" && ISO_DATE_PATTERN.test(range.end)
            ? range.end
            : null;
      return { start, end } satisfies DateRange;
    });

const sanitizePlan = (plan: PlanUiState): PlanUiState => {
  let horizon: PlanUiState["horizon"];
  try {
    horizon = PlanningCalendarService.recalculateHorizon(
      plan.horizon.startDate,
      plan.horizon.endDate,
    );
  } catch {
    horizon = buildDefaultHorizon();
  }

  return {
    ...plan,
    horizon,
    crops: plan.crops.map((crop) => ({ ...crop })),
    lands: plan.lands.map((land) => ({
      ...land,
      blocked: sanitizeRanges(land.blocked),
    })),
    workers: plan.workers.map((worker) => ({
      ...worker,
      blocked: sanitizeRanges(worker.blocked),
    })),
    resources: plan.resources.map((resource) => ({
      ...resource,
      blocked: sanitizeRanges(resource.blocked),
    })),
    events: plan.events.map((event) => ({
      ...event,
      startDates: sanitizeDateListWithinHorizon(event.startDates, horizon),
      endDates: sanitizeDateListWithinHorizon(event.endDates, horizon),
    })),
    cropAreaBounds: plan.cropAreaBounds.map((bound) => ({ ...bound })),
    fixedAreas: plan.fixedAreas.map((fixed) => ({ ...fixed })),
    stages: plan.stages ? { ...plan.stages } : undefined,
  };
};

export const createEmptyPlan = (): PlanUiState =>
  sanitizePlan({
    horizon: buildDefaultHorizon(),
    crops: [],
    lands: [],
    workers: [],
    resources: [],
    events: [],
    cropAreaBounds: [],
    fixedAreas: [],
    stages: {
      stageOrder: DEFAULT_STAGE_ORDER,
      stepToleranceBy: DEFAULT_STAGE_ORDER.reduce<Record<string, number>>(
        (map, stage) => {
          map[stage] = 0.05;
          return map;
        },
        {},
      ),
    },
  });

export interface PlanningDraftData {
  version: "v1";
  plan: PlanUiState;
  savedAt: string;
}

export interface PlanningStoreState {
  plan: PlanUiState;
  currentStep: WizardStepId;
  isDirty: boolean;
  lastSavedAt: string | null;
  isSubmitting: boolean;
  submissionError: string | null;
  lastResult: OptimizationResultView | null;
  lastJobId: string | null;
  jobProgress: number; // 0..1
  jobStatus: JobStatus | null;
  setPlan: (plan: PlanUiState) => void;
  updatePlan: (updater: (prev: PlanUiState) => PlanUiState) => void;
  setCurrentStep: (step: WizardStepId) => void;
  reset: () => void;
  markDirty: (dirty: boolean) => void;
  setLastSavedAt: (savedAt: string | null) => void;
  replacePlan: (plan: PlanUiState) => void;
  setIsSubmitting: (value: boolean) => void;
  setSubmissionError: (message: string | null) => void;
  setLastResult: (result: OptimizationResultView | null) => void;
  setLastJobId: (jobId: string | null) => void;
  setJobProgress: (p: number) => void;
  setJobStatus: (s: JobStatus | null) => void;
}

const STEP_IDS = new Set(WIZARD_STEP_IDS);

const ensureStep = (step: WizardStepId): WizardStepId =>
  STEP_IDS.has(step) ? step : INITIAL_STEP_ID;

export const usePlanningStore = create<PlanningStoreState>((set) => ({
  plan: createEmptyPlan(),
  currentStep: INITIAL_STEP_ID,
  isDirty: false,
  lastSavedAt: null,
  isSubmitting: false,
  submissionError: null,
  lastResult: null,
  lastJobId: null,
  jobProgress: 0,
  jobStatus: null,
  setPlan: (plan) => set({ plan: sanitizePlan(plan), isDirty: true }),
  updatePlan: (updater) =>
    set((state) => ({
      plan: sanitizePlan(updater(state.plan)),
      isDirty: true,
    })),
  setCurrentStep: (step) => set({ currentStep: ensureStep(step) }),
  reset: () =>
    set({
      plan: createEmptyPlan(),
      currentStep: INITIAL_STEP_ID,
      isDirty: false,
      lastSavedAt: null,
      isSubmitting: false,
      submissionError: null,
      lastResult: null,
    }),
  markDirty: (dirty) => set({ isDirty: dirty }),
  setLastSavedAt: (savedAt) => set({ lastSavedAt: savedAt }),
  replacePlan: (plan) =>
    set({
      plan: sanitizePlan(plan),
      isDirty: false,
    }),
  setIsSubmitting: (value) => set({ isSubmitting: value }),
  setSubmissionError: (message) => set({ submissionError: message }),
  setLastResult: (result) => set({ lastResult: result }),
  setLastJobId: (jobId) => set({ lastJobId: jobId }),
  setJobProgress: (p) => set({ jobProgress: Math.min(1, Math.max(0, p)) }),
  setJobStatus: (s) => set({ jobStatus: s }),
}));

const toDraftData = (
  plan: PlanUiState,
  savedAt?: string | null,
): PlanningDraftData => ({
  version: "v1",
  plan: sanitizePlan(plan),
  savedAt: savedAt ?? new Date().toISOString(),
});

const parseDraftEnvelope = (value: string | null): PlanningDraftData | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as PlanningDraftData;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid draft payload");
    }
    if ((parsed as PlanningDraftData).version === "v1") {
      const typed = parsed as PlanningDraftData;
      if (!typed.plan) throw new Error("Missing plan");
      return toDraftData(typed.plan, typed.savedAt);
    }
    throw new Error("Unsupported draft format");
  } catch (error) {
    console.warn("Failed to parse planning draft", error);
    return null;
  }
};

const loadFromStorageKey = (key: string): PlanningDraftData | null => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  const parsed = parseDraftEnvelope(raw);
  if (!parsed && raw) {
    window.localStorage.removeItem(key);
  }
  if (parsed && isDraftExpired(parsed.savedAt)) {
    window.localStorage.removeItem(key);
    return null;
  }
  return parsed;
};

export const planningDraftStorage = {
  load(): PlanningDraftData | null {
    if (typeof window === "undefined") return null;
    const current = loadFromStorageKey(DRAFT_STORAGE_KEY);
    if (current) {
      return current;
    }
    return null;
  },
  save(draft: PlanningDraftData) {
    if (typeof window === "undefined") return;
    const envelope: PlanningDraftData = toDraftData(draft.plan, draft.savedAt);
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(envelope));
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  },
  setTtlDays(days: number | null | undefined) {
    if (days == null || Number(days) <= 0) {
      draftTtlMs = null;
      return;
    }
    draftTtlMs = Number(days) * MS_PER_DAY;
  },
};

export const getPlanningState = () => usePlanningStore.getState();
