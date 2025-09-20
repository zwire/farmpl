import { create } from "zustand";

import type {
  OptimizationResultView,
  PlanFormState,
} from "@/lib/types/planning";
import {
  INITIAL_STEP_ID,
  type WizardStepId,
} from "@/app/(planning)/components/request-wizard/steps";

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

const DRAFT_STORAGE_KEY = "farmpl-planning-draft-v1";

const sanitizePlan = (plan: PlanFormState): PlanFormState => {
  const sanitizedEvents = plan.events.map((event) => {
    const clone = { ...event } as PlanFormState["events"][number] & {
      landId?: string;
    };
    if ("landId" in clone) {
      delete clone.landId;
    }
    return clone as PlanFormState["events"][number];
  });

  return {
    ...plan,
    events: sanitizedEvents,
  };
};

export const createEmptyPlan = (): PlanFormState => ({
  horizon: { numDays: 30 },
  crops: [],
  events: [],
  lands: [],
  workers: [],
  resources: [],
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
  plan: PlanFormState;
  savedAt: string;
}

export interface PlanningStoreState {
  plan: PlanFormState;
  currentStep: WizardStepId;
  isDirty: boolean;
  lastSavedAt: string | null;
  isSubmitting: boolean;
  submissionError: string | null;
  lastResult: OptimizationResultView | null;
  setPlan: (plan: PlanFormState) => void;
  updatePlan: (updater: (prev: PlanFormState) => PlanFormState) => void;
  setCurrentStep: (step: WizardStepId) => void;
  reset: () => void;
  markDirty: (dirty: boolean) => void;
  setLastSavedAt: (savedAt: string | null) => void;
  replacePlan: (plan: PlanFormState) => void;
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

export const planningDraftStorage = {
  load(): PlanningDraftData | null {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as PlanningDraftData;
      if (!parsed || !parsed.plan) {
        throw new Error("Invalid draft payload");
      }
      return {
        plan: sanitizePlan(parsed.plan),
        savedAt: parsed.savedAt ?? new Date().toISOString(),
      };
    } catch (error) {
      console.warn("Failed to parse planning draft", error);
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      return null;
    }
  },
  save(draft: PlanningDraftData) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  },
};

export const getPlanningState = () => usePlanningStore.getState();
