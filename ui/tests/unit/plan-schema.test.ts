import { describe, expect, it } from "vitest";

import { validatePlan } from "@/lib/validation/plan-schema";
import type { PlanFormState } from "@/lib/types/planning";

const buildValidPlan = (): PlanFormState => ({
  horizon: { numDays: 30 },
  crops: [
    {
      id: "crop-1",
      name: "トマト",
      category: "野菜",
      price: { unit: "a", value: 1200 },
    },
  ],
  events: [
    {
      id: "event-1",
      cropId: "crop-1",
      name: "播種",
      usesLand: true,
    },
  ],
  lands: [
    {
      id: "land-1",
      name: "圃場A",
      area: { unit: "a", value: 10 },
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
});

describe("plan-schema validatePlan", () => {
  it("returns success for a minimal valid plan", () => {
    const result = validatePlan(buildValidPlan());
    expect(result.success).toBe(true);
  });

  it("raises an error when crops are missing", () => {
    const invalidPlan: PlanFormState = {
      ...buildValidPlan(),
      crops: [],
    };

    const result = validatePlan(invalidPlan);
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain("作物を1件以上追加してください");
    }
  });
});
