import { beforeEach, describe, expect, it } from "vitest";

import {
  createEmptyPlan,
  planningDraftStorage,
  usePlanningStore,
} from "@/lib/state/planning-store";
import type { PlanFormState } from "@/lib/types/planning";

const samplePlan: PlanFormState = {
  horizon: { numDays: 30 },
  crops: [
    {
      id: "crop-1",
      name: "レタス",
      category: "葉菜",
      price: { unit: "a", value: 800 },
    },
  ],
  events: [
    {
      id: "event-1",
      cropId: "crop-1",
      name: "定植",
      usesLand: true,
    },
  ],
  lands: [
    {
      id: "land-1",
      name: "第1圃場",
      area: { unit: "a", value: 5 },
      tags: [],
      blockedDays: [],
    },
  ],
  workers: [],
  resources: [],
  cropAreaBounds: [],
  fixedAreas: [],
  preferences: undefined,
  stages: undefined,
};

beforeEach(() => {
  usePlanningStore.getState().reset();
  planningDraftStorage.clear();
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
    store.updatePlan(() => samplePlan);
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
    planningDraftStorage.save({
      plan: samplePlan,
      savedAt,
    });

    const loaded = planningDraftStorage.load();
    expect(loaded).not.toBeNull();
    expect(loaded?.savedAt).toBe(savedAt);
    expect(loaded?.plan.crops[0].id).toBe("crop-1");
  });
});
