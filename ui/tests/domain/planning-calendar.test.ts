import { describe, expect, it } from "vitest";

import { PlanningCalendarService } from "@/lib/domain/planning-calendar";
import type { PlanUiState } from "@/lib/domain/planning-ui-types";
import { planFormSchema } from "@/lib/validation/plan-schema";

describe("PlanningCalendarService", () => {
  it("recalculates horizon total days inclusively", () => {
    const horizon = PlanningCalendarService.recalculateHorizon(
      "2025-03-01",
      "2025-05-31",
    );
    expect(horizon.totalDays).toBe(92);
  });

  it("maps ISO dates to day indices relative to the horizon start", () => {
    expect(
      PlanningCalendarService.dateToDayIndex("2025-03-01", "2025-03-01"),
    ).toBe(0);
    expect(
      PlanningCalendarService.dateToDayIndex("2025-03-01", "2025-04-01"),
    ).toBe(31);
  });

  it("converts blocked date ranges into sorted unique day indices", () => {
    const horizon = PlanningCalendarService.recalculateHorizon(
      "2025-03-01",
      "2025-03-10",
    );
    const { days, warnings } = PlanningCalendarService.rangesToDayIndices(
      [
        { start: "2025-02-25", end: "2025-03-01" },
        { start: "2025-03-05", end: "2025-03-06" },
        { start: "2025-03-08", end: null },
      ],
      horizon,
    );
    expect(days).toEqual([0, 4, 5, 7, 8, 9]);
    expect(warnings.some((warning) => warning.type === "RANGE_CLIPPED")).toBe(
      true,
    );
  });

  it("converts a PlanUiState into a PlanFormState that passes schema validation", () => {
    const plan: PlanUiState = {
      horizon: PlanningCalendarService.recalculateHorizon(
        "2025-03-01",
        "2025-03-10",
      ),
      crops: [
        {
          id: "crop-spinach",
          name: "ほうれん草",
          category: "葉物",
          price: { unit: "a", value: 12000 },
        },
      ],
      lands: [
        {
          id: "land-1",
          name: "第1圃場",
          area: { unit: "a", value: 12 },
          tags: ["東区画"],
          blocked: [
            { start: "2025-02-27", end: "2025-03-01" },
            { start: "2025-03-03", end: "2025-03-04" },
            { start: "2025-03-09", end: null },
          ],
        },
      ],
      workers: [
        {
          id: "worker-1",
          name: "山田",
          roles: ["播種"],
          capacityPerDay: 8,
          blocked: [],
        },
      ],
      resources: [
        {
          id: "resource-tractor",
          name: "トラクタ",
          category: "machinery",
          capacityPerDay: 1,
          blocked: [],
        },
      ],
      events: [
        {
          id: "event-sow",
          cropId: "crop-spinach",
          name: "播種",
          category: "農作業",
          startDates: ["2025-03-05", "2025-03-06"],
          endDates: ["2025-03-07", "2025-03-08"],
          frequencyDays: undefined,
          precedingEventId: undefined,
          lag: { min: 1, max: 3 },
          labor: { peopleRequired: 2, totalPerA: 6 },
          requiredRoles: ["播種"],
          requiredResources: ["resource-tractor"],
          usesLand: true,
        },
      ],
      cropAreaBounds: [],
      fixedAreas: [],
      stages: {
        stageOrder: ["profit", "labor"],
      },
    };

    const { plan: apiPlan, warnings } =
      PlanningCalendarService.convertToApiPlan(plan);

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((warning) => warning.type === "RANGE_CLIPPED")).toBe(
      true,
    );

    const parsed = planFormSchema.safeParse(apiPlan);
    expect(parsed.success).toBe(true);
    expect(apiPlan.horizon.numDays).toBe(plan.horizon.totalDays);

    const firstLand = apiPlan.lands[0];
    expect(firstLand.blockedDays).toEqual([0, 2, 3, 8, 9]);

    const firstEvent = apiPlan.events[0];
    expect(firstEvent.startCond).toEqual([4, 5]);
    expect(firstEvent.endCond).toEqual([6, 7]);
  });

  it("records warnings for invalid date inputs while omitting them from the result", () => {
    const plan: PlanUiState = {
      horizon: PlanningCalendarService.recalculateHorizon(
        "2025-03-01",
        "2025-03-05",
      ),
      crops: [
        {
          id: "crop-1",
          name: "テスト作物",
        },
      ],
      lands: [
        {
          id: "land-1",
          name: "第1圃場",
          area: { unit: "a", value: 10 },
          blocked: [],
        },
      ],
      workers: [],
      resources: [],
      events: [
        {
          id: "event-1",
          cropId: "crop-1",
          name: "播種",
          startDates: ["not-a-date"],
          usesLand: true,
        },
      ],
      cropAreaBounds: [],
      fixedAreas: [],
    };

    const { plan: apiPlan, warnings } =
      PlanningCalendarService.convertToApiPlan(plan);

    expect(warnings.some((warning) => warning.type === "INVALID_DATE")).toBe(
      true,
    );
    expect(apiPlan.events[0].startCond).toBeUndefined();
  });

  it("treats null start/end dates as horizon boundaries when converting ranges", () => {
    const plan: PlanUiState = {
      horizon: PlanningCalendarService.recalculateHorizon(
        "2025-04-01",
        "2025-04-10",
      ),
      crops: [
        {
          id: "crop-1",
          name: "テスト作物",
        },
      ],
      lands: [
        {
          id: "land-1",
          name: "第1圃場",
          area: { unit: "a", value: 5 },
          blocked: [
            { start: null, end: null },
            { start: "2025-04-05", end: null },
          ],
          tags: [],
        },
      ],
      workers: [],
      resources: [],
      events: [],
      cropAreaBounds: [],
      fixedAreas: [],
    };

    const { plan: apiPlan } = PlanningCalendarService.convertToApiPlan(plan);
    expect(apiPlan.lands[0].blockedDays).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });
});
