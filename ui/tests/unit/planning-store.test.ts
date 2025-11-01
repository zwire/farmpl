import { describe, expect, it } from "vitest";
import { PlanningCalendarService } from "@/lib/domain/planning-calendar";
import type {
  DateRange,
  IsoDateString,
  PlanUiState,
} from "@/lib/domain/planning-ui-types";
import {
  createEmptyPlan,
  DRAFT_STORAGE_KEY,
  PlanningEventDateUtils,
  planningDraftStorage,
  usePlanningStore,
} from "@/lib/state/planning-store";

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
});

describe("PlanningEventDateUtils", () => {
  const horizon = PlanningCalendarService.recalculateHorizon(
    "2025-03-01",
    "2025-03-10",
  );

  it("expands ranges into deduplicated sorted date arrays", () => {
    const ranges: DateRange[] = [
      { start: "2025-03-02", end: "2025-03-04" },
      { start: "2025-03-04", end: "2025-03-05" },
    ];

    const expanded = PlanningEventDateUtils.expandRangesToDateList(
      ranges,
      horizon,
    );

    expect(expanded).toEqual([
      "2025-03-02",
      "2025-03-03",
      "2025-03-04",
      "2025-03-05",
    ]);
  });

  it("clamps open-ended ranges to the planning horizon", () => {
    const ranges: DateRange[] = [
      { start: null, end: "2025-02-25" },
      { start: "2025-03-09", end: null },
    ];

    const expanded = PlanningEventDateUtils.expandRangesToDateList(
      ranges,
      horizon,
    );

    expect(expanded).toEqual(["2025-03-01", "2025-03-09", "2025-03-10"]);
  });

  it("collapses consecutive dates into minimal ranges", () => {
    const dates = [
      "2025-03-01",
      "2025-03-02",
      "2025-03-05",
      "2025-03-06",
      "2025-03-07",
    ];

    const ranges = PlanningEventDateUtils.collapseDatesToRanges(
      dates as IsoDateString[],
      horizon,
    );

    expect(ranges).toEqual([
      { start: "2025-03-01", end: "2025-03-02" },
      { start: "2025-03-05", end: "2025-03-07" },
    ]);
  });
});
