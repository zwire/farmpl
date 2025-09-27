import { create } from "zustand";

import { PlanningCalendarService } from "@/lib/domain/planning-calendar";
import type {
  DateRange,
  IsoDateString,
  PlanUiEvent,
  PlanUiLand,
  PlanUiResource,
  PlanUiState,
  PlanUiWorker,
} from "@/lib/domain/planning-ui-types";
import type { OptimizationResultView, PlanFormState } from "@/lib/types/planning";
import {
  INITIAL_STEP_ID,
  type WizardStepId,
} from "@/app/(planning)/components/request-wizard/steps";

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

export const DRAFT_STORAGE_KEY = "farmpl-planning-draft-v2";
export const LEGACY_DRAFT_STORAGE_KEY = "farmpl-planning-draft-v1";

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
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
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
  const start = parseIsoDate(startDate)!;
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
      startDates: sanitizeDateList(event.startDates),
      endDates: sanitizeDateList(event.endDates),
    })),
    cropAreaBounds: plan.cropAreaBounds.map((bound) => ({ ...bound })),
    fixedAreas: plan.fixedAreas.map((fixed) => ({ ...fixed })),
    preferences: plan.preferences ? { ...plan.preferences } : undefined,
    stages: plan.stages ? { ...plan.stages } : undefined,
  };
};

const indicesToRanges = (
  indices: number[] | undefined,
  horizon: PlanUiState["horizon"],
): DateRange[] => {
  if (!indices || indices.length === 0) return [];
  const startDate = parseIsoDate(horizon.startDate);
  if (!startDate) return [];
  const sorted = Array.from(new Set(indices)).sort((a, b) => a - b);
  const ranges: DateRange[] = [];
  let currentStart = sorted[0];
  let previous = sorted[0];

  for (let i = 1; i < sorted.length; i += 1) {
    const value = sorted[i];
    if (value === previous + 1) {
      previous = value;
      continue;
    }
    const rangeStart = PlanningCalendarService.dayIndexToDate(
      horizon.startDate,
      currentStart,
    );
    const rangeEnd = PlanningCalendarService.dayIndexToDate(
      horizon.startDate,
      previous,
    );
    ranges.push({ start: rangeStart, end: rangeEnd });
    currentStart = value;
    previous = value;
  }

  const finalRange: DateRange = {
    start: PlanningCalendarService.dayIndexToDate(
      horizon.startDate,
      currentStart,
    ),
    end: PlanningCalendarService.dayIndexToDate(horizon.startDate, previous),
  };
  ranges.push(finalRange);
  return ranges;
};

const legacyEventToUi = (
  event: PlanFormState["events"][number],
  horizon: PlanUiState["horizon"],
): PlanUiEvent => ({
  id: event.id,
  cropId: event.cropId,
  name: event.name,
  category: event.category,
  startDates: event.startCond?.map((day) =>
    PlanningCalendarService.dayIndexToDate(horizon.startDate, day),
  ),
  endDates: event.endCond?.map((day) =>
    PlanningCalendarService.dayIndexToDate(horizon.startDate, day),
  ),
  frequencyDays: event.frequencyDays ?? undefined,
  precedingEventId: event.precedingEventId ?? undefined,
  lag: event.lag ?? undefined,
  labor: event.labor ?? undefined,
  requiredRoles: event.requiredRoles ?? undefined,
  requiredResources: event.requiredResources ?? undefined,
  usesLand: event.usesLand,
});

const legacyLandToUi = (
  land: PlanFormState["lands"][number],
  horizon: PlanUiState["horizon"],
): PlanUiLand => ({
  id: land.id,
  name: land.name,
  area: land.area,
  tags: land.tags ?? [],
  blocked: indicesToRanges(land.blockedDays ?? [], horizon),
});

const legacyWorkerToUi = (
  worker: PlanFormState["workers"][number],
  horizon: PlanUiState["horizon"],
): PlanUiWorker => ({
  id: worker.id,
  name: worker.name,
  roles: worker.roles,
  capacityPerDay: worker.capacityPerDay,
  blocked: indicesToRanges(worker.blockedDays ?? [], horizon),
});

const legacyResourceToUi = (
  resource: PlanFormState["resources"][number],
  horizon: PlanUiState["horizon"],
): PlanUiResource => ({
  id: resource.id,
  name: resource.name,
  category: resource.category ?? undefined,
  capacityPerDay: resource.capacityPerDay ?? undefined,
  blocked: indicesToRanges(resource.blockedDays ?? [], horizon),
});

const migrateLegacyPlan = (plan: PlanFormState): PlanUiState => {
  const horizon = buildHorizonFromLength(plan.horizon.numDays);
  return sanitizePlan({
    horizon,
    crops: plan.crops.map((crop) => ({ ...crop })),
    lands: plan.lands.map((land) => legacyLandToUi(land, horizon)),
    workers: plan.workers.map((worker) => legacyWorkerToUi(worker, horizon)),
    resources: plan.resources.map((resource) => legacyResourceToUi(resource, horizon)),
    events: plan.events.map((event) => legacyEventToUi(event, horizon)),
    cropAreaBounds: plan.cropAreaBounds.map((bound) => ({ ...bound })),
    fixedAreas: plan.fixedAreas.map((fixed) => ({ ...fixed })),
    preferences: plan.preferences ? { ...plan.preferences } : undefined,
    stages: plan.stages ? { ...plan.stages } : undefined,
  });
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
    preferences: {
      wProfit: 1,
      wLabor: 1,
      wIdle: 1,
      wDispersion: 1,
      wPeak: 1,
      wDiversity: 1,
    },
    stages: {
      stageOrder: DEFAULT_STAGE_ORDER,
      toleranceByStage: {},
      stepToleranceBy: {},
    },
  });

export interface PlanningDraftData {
  version: "ui-v1";
  plan: PlanUiState;
  savedAt: string;
}

interface LegacyPlanningDraftData {
  plan: PlanFormState;
  savedAt?: string;
}

export interface PlanningStoreState {
  plan: PlanUiState;
  currentStep: WizardStepId;
  isDirty: boolean;
  lastSavedAt: string | null;
  isSubmitting: boolean;
  submissionError: string | null;
  lastResult: OptimizationResultView | null;
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
}));

const toDraftData = (plan: PlanUiState, savedAt?: string | null): PlanningDraftData => ({
  version: "ui-v1",
  plan: sanitizePlan(plan),
  savedAt: savedAt ?? new Date().toISOString(),
});

const parseDraftEnvelope = (value: string | null): PlanningDraftData | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as PlanningDraftData | LegacyPlanningDraftData;
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid draft payload");
    }
    if ((parsed as PlanningDraftData).version === "ui-v1") {
      const typed = parsed as PlanningDraftData;
      if (!typed.plan) throw new Error("Missing plan");
      return toDraftData(typed.plan, typed.savedAt);
    }
    if ((parsed as LegacyPlanningDraftData).plan) {
      const legacy = parsed as LegacyPlanningDraftData;
      const migrated = migrateLegacyPlan(legacy.plan);
      return toDraftData(migrated, legacy.savedAt);
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
  return parsed;
};

export const planningDraftStorage = {
  load(): PlanningDraftData | null {
    if (typeof window === "undefined") return null;
    const current = loadFromStorageKey(DRAFT_STORAGE_KEY);
    if (current) {
      return current;
    }
    const legacy = loadFromStorageKey(LEGACY_DRAFT_STORAGE_KEY);
    if (legacy) {
      this.save(legacy);
      window.localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
      return legacy;
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
};

export const getPlanningState = () => usePlanningStore.getState();
