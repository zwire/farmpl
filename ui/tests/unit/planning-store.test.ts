import { beforeEach, describe, expect, it } from "vitest";

import {
  DRAFT_STORAGE_KEY,
  LEGACY_DRAFT_STORAGE_KEY,
  createEmptyPlan,
  planningDraftStorage,
  usePlanningStore,
} from "@/lib/state/planning-store";
import type { PlanUiState } from "@/lib/domain/planning-ui-types";
import type { PlanFormState } from "@/lib/types/planning";

const createSamplePlan = (): PlanUiState => {
  const empty = createEmptyPlan();
  return {
    ...empty,
    crops: [
      ...empty.crops,
      {
        id: "crop-1",
        name: "レタス",
        category: "葉菜",
        price: { unit: "a", value: 800 },
      },
    ],
    events: [
      ...empty.events,
      {
        id: "event-1",
        cropId: "crop-1",
        name: "定植",
        startDates: [empty.horizon.startDate],
        usesLand: true,
      },
    ],
  };
};

const clearDraftStorage = () => {
  planningDraftStorage.clear();
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LEGACY_DRAFT_STORAGE_KEY);
  }
};

beforeEach(() => {
  usePlanningStore.getState().reset();
  clearDraftStorage();
});

describe("planning-store basic behaviour", () => {
  it("updates plan and marks dirty", () => {
    const updatePlan = usePlanningStore.getState().updatePlan;
    updatePlan((prev) => ({
      ...prev,
      crops: [
        ...prev.crops,
        {
          id: "crop-2",
          name: "キャベツ",
          category: "葉菜",
          price: { unit: "a", value: 700 },
        },
      ],
    }));

    const state = usePlanningStore.getState();
    expect(state.plan.crops).toHaveLength(1);
    expect(state.isDirty).toBe(true);
  });

  it("resets to an empty plan and clears submission state", () => {
    const store = usePlanningStore.getState();
    const samplePlan = createSamplePlan();
    store.replacePlan(samplePlan);
    store.setIsSubmitting(true);
    store.setSubmissionError("err");
    store.setLastResult(null);
    store.reset();

    const state = usePlanningStore.getState();
    expect(state.plan).toEqual(createEmptyPlan());
    expect(state.isDirty).toBe(false);
    expect(state.isSubmitting).toBe(false);
    expect(state.submissionError).toBeNull();
    expect(state.lastResult).toBeNull();
  });
});

describe("planningDraftStorage", () => {
  it("saves and loads draft data via localStorage", () => {
    const savedAt = new Date("2025-01-01T00:00:00Z").toISOString();
    const samplePlan = createSamplePlan();
    planningDraftStorage.save({
      version: "ui-v1",
      plan: samplePlan,
      savedAt,
    });

    const loaded = planningDraftStorage.load();
    expect(loaded).not.toBeNull();
    expect(loaded?.savedAt).toBe(savedAt);
    expect(loaded?.plan.crops[0].id).toBe("crop-1");

    if (typeof window !== "undefined") {
      expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toBeTruthy();
    }
  });

  it("migrates legacy plan data to the UI format", () => {
    if (typeof window === "undefined") {
      expect(true).toBe(true);
      return;
    }

    const legacyPlan: PlanFormState = {
      horizon: { numDays: 10 },
      crops: [
        {
          id: "legacy-crop",
          name: "小松菜",
          category: "葉菜",
          price: { unit: "a", value: 600 },
        },
      ],
      events: [
        {
          id: "legacy-event",
          cropId: "legacy-crop",
          name: "播種",
          startCond: [0, 1],
          endCond: [3],
          usesLand: true,
        },
      ],
      lands: [
        {
          id: "land-1",
          name: "旧第1圃場",
          area: { unit: "a", value: 5 },
          tags: [],
          blockedDays: [0, 1, 5],
        },
      ],
      workers: [],
      resources: [],
      cropAreaBounds: [],
      fixedAreas: [],
      preferences: undefined,
      stages: undefined,
    };

    window.localStorage.setItem(
      LEGACY_DRAFT_STORAGE_KEY,
      JSON.stringify({ plan: legacyPlan, savedAt: "2025-01-02T00:00:00Z" }),
    );

    const migrated = planningDraftStorage.load();
    expect(migrated).not.toBeNull();
    expect(migrated?.plan.horizon.totalDays).toBe(legacyPlan.horizon.numDays);
    expect(migrated?.plan.crops[0].id).toBe("legacy-crop");
    expect(migrated?.plan.events[0].startDates?.length).toBe(2);
    expect(migrated?.plan.lands[0].blocked.length).toBeGreaterThan(0);
  });
});
