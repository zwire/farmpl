import { z } from "zod";

import type {
  ApiPlan,
  AreaMeasurement,
  OptimizationRequestDraft,
  PlanFormState,
  PriceMeasurement,
} from "../types/planning";

/**
 * Zod schemas for validating planning form data prior to submission.
 * エンティティの参照が切れている場合はサニタイズ処理で削除し、コンソールへログを出力します。
 */

const isPlanFormStateLike = (value: unknown): value is PlanFormState => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const plan = value as Record<string, unknown>;
  return (
    typeof plan.horizon === "object" &&
    plan.horizon !== null &&
    Array.isArray(plan.crops) &&
    Array.isArray(plan.events) &&
    Array.isArray(plan.lands) &&
    Array.isArray(plan.workers) &&
    Array.isArray(plan.resources) &&
    Array.isArray(plan.cropAreaBounds) &&
    Array.isArray(plan.fixedAreas)
  );
};

const sanitizePlanForValidation = (value: unknown): unknown => {
  if (!isPlanFormStateLike(value)) {
    return value;
  }

  const plan = value as PlanFormState;

  const sanitized: PlanFormState = {
    ...plan,
    horizon: { ...plan.horizon },
    crops: [...plan.crops],
    events: [...plan.events],
    lands: [...plan.lands],
    workers: [...plan.workers],
    resources: [...plan.resources],
    cropAreaBounds: [...plan.cropAreaBounds],
    fixedAreas: [...plan.fixedAreas],
    stages: plan.stages
      ? {
          ...plan.stages,
          stepToleranceBy: plan.stages.stepToleranceBy
            ? { ...plan.stages.stepToleranceBy }
            : undefined,
        }
      : undefined,
  };

  const removalMessages: string[] = [];
  const logRemoval = (message: string) => {
    removalMessages.push(`[plan-schema] ${message}`);
  };

  const cropIds = new Set(sanitized.crops.map((crop) => crop.id));

  let filteredEvents = sanitized.events.filter((event) => {
    if (!cropIds.has(event.cropId)) {
      logRemoval(
        `イベント "${event.id}" を削除しました: 存在しない作物ID "${event.cropId}" を参照しています`,
      );
      return false;
    }
    return true;
  });

  let removedInPass = false;
  do {
    const eventIds = new Set(filteredEvents.map((event) => event.id));
    removedInPass = false;
    const nextEvents: PlanFormState["events"] = [];
    for (const event of filteredEvents) {
      if (event.precedingEventId && !eventIds.has(event.precedingEventId)) {
        logRemoval(
          `イベント "${event.id}" を削除しました: 存在しない precedingEventId "${event.precedingEventId}" を参照しています`,
        );
        removedInPass = true;
      } else {
        nextEvents.push(event);
      }
    }
    filteredEvents = nextEvents;
  } while (removedInPass);
  sanitized.events = filteredEvents;

  const landIds = new Set(sanitized.lands.map((land) => land.id));

  sanitized.cropAreaBounds = sanitized.cropAreaBounds.filter((bound) => {
    if (!cropIds.has(bound.cropId)) {
      logRemoval(
        `cropAreaBounds のエントリを削除しました: 存在しない作物ID "${bound.cropId}" を参照しています`,
      );
      return false;
    }
    return true;
  });

  sanitized.fixedAreas = sanitized.fixedAreas.filter((fixed) => {
    const missingTargets: string[] = [];
    if (!cropIds.has(fixed.cropId)) {
      missingTargets.push(`作物ID "${fixed.cropId}"`);
    }
    if (!landIds.has(fixed.landId)) {
      missingTargets.push(`土地ID "${fixed.landId}"`);
    }
    if (missingTargets.length > 0) {
      logRemoval(
        `fixedAreas のエントリを削除しました: 存在しない ${missingTargets.join(" と ")} を参照しています`,
      );
      return false;
    }
    return true;
  });

  if (removalMessages.length > 0) {
    for (const message of removalMessages) {
      console.log(message);
    }
  }

  return sanitized;
};

const requiredId = z.string().trim().min(1, "IDは必須です");
const optionalString = z.string().trim().min(1).optional();
const nonEmptyString = z.string().trim().min(1);

const dayArray = z.array(z.number().int().min(0)).optional();

const areaMeasurementSchema = z
  .object({
    unit: z.enum(["a", "10a"]),
    value: z.number().positive("面積は正の数で入力してください"),
  })
  .strict();

const priceMeasurementSchema = z
  .object({
    unit: z.enum(["a", "10a"]),
    value: z.number().positive("価格は正の数で入力してください"),
  })
  .strict();

const cropSchema = z
  .object({
    id: requiredId,
    name: nonEmptyString,
    category: optionalString,
    price: priceMeasurementSchema.optional(),
  })
  .strict()
  .superRefine((crop, ctx) => {
    if (crop.price && !["a", "10a"].includes(crop.price.unit)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "価格の単位が不正です",
        path: ["price", "unit"],
      });
    }
  });

const eventSchema = z
  .object({
    id: requiredId,
    cropId: requiredId,
    name: nonEmptyString,
    category: optionalString,
    startCond: dayArray,
    endCond: dayArray,
    frequencyDays: z.number().int().positive().optional(),
    precedingEventId: optionalString,
    lag: z
      .object({
        min: z.number().int().min(0).optional(),
        max: z.number().int().min(0).optional(),
      })
      .optional()
      .superRefine((lag, ctx) => {
        if (!lag) return;
        if (
          typeof lag.min === "number" &&
          typeof lag.max === "number" &&
          lag.min > lag.max
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "lag.min は lag.max 以下である必要があります",
            path: ["min"],
          });
        }
      }),
    labor: z
      .object({
        peopleRequired: z.number().int().min(0).optional(),
        totalPerA: z.number().min(0).optional(),
        dailyCap: z.number().min(0).optional(),
      })
      .optional(),
    requiredRoles: z.array(nonEmptyString).optional(),
    requiredResources: z.array(nonEmptyString).optional(),
    usesLand: z.boolean(),
  })
  .strict();

const landSchema = z
  .object({
    id: requiredId,
    name: nonEmptyString,
    area: areaMeasurementSchema,
    tags: z.array(nonEmptyString).optional(),
    blockedDays: dayArray,
  })
  .strict();

const workerSchema = z
  .object({
    id: requiredId,
    name: nonEmptyString,
    roles: z.array(nonEmptyString).default([]),
    capacityPerDay: z
      .number()
      .positive("キャパシティは正の数で入力してください"),
    blockedDays: dayArray,
  })
  .strict();

const resourceSchema = z
  .object({
    id: requiredId,
    name: nonEmptyString,
    category: optionalString,
    capacityPerDay: z.number().positive().optional(),
    blockedDays: dayArray,
  })
  .strict();

const cropAreaBoundSchema = z
  .object({
    cropId: requiredId,
    minArea: areaMeasurementSchema.optional(),
    maxArea: areaMeasurementSchema.optional(),
  })
  .strict()
  .superRefine((bound, ctx) => {
    if (bound.minArea && bound.maxArea) {
      if (normalizeArea(bound.minArea) > normalizeArea(bound.maxArea)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "面積の下限は上限以下で入力してください",
          path: ["minArea"],
        });
      }
    }
  });

const fixedAreaSchema = z
  .object({
    landId: requiredId,
    cropId: requiredId,
    area: areaMeasurementSchema,
  })
  .strict();

const stagesSchema = z
  .object({
    stageOrder: z
      .array(nonEmptyString)
      .min(1, "stageOrder を1件以上指定してください"),
    stepToleranceBy: z.record(z.number().min(0).max(1)).optional(),
  })
  .strict()
  .superRefine((cfg, ctx) => {
    if (cfg.stepToleranceBy) {
      for (const stage of Object.keys(cfg.stepToleranceBy)) {
        if (!cfg.stageOrder.includes(stage)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "stepToleranceBy に含まれるキーは stageOrder に含めてください",
            path: ["stepToleranceBy", stage],
          });
        }
      }
    }
  });

const basePlanFormSchema = z
  .object({
    horizon: z
      .object({
        numDays: z.number().int().min(1, "計画日数は1以上で指定してください"),
      })
      .strict(),
    crops: z.array(cropSchema).min(1, "作物を1件以上追加してください"),
    events: z
      .array(eventSchema)
      .min(1, "各作物に対する作業を1件以上追加してください"),
    lands: z.array(landSchema).min(1, "土地を1件以上追加してください"),
    workers: z.array(workerSchema),
    resources: z.array(resourceSchema),
    cropAreaBounds: z.array(cropAreaBoundSchema).default([]),
    fixedAreas: z.array(fixedAreaSchema).default([]),
    stages: stagesSchema.optional(),
  })
  .strict()
  .superRefine((plan, ctx) => {
    const cropIds = new Set(plan.crops.map((c) => c.id));
    if (cropIds.size !== plan.crops.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "作物IDが重複しています",
        path: ["crops"],
      });
    }

    const eventIds = new Set(plan.events.map((e) => e.id));
    if (eventIds.size !== plan.events.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "イベントIDが重複しています",
        path: ["events"],
      });
    }

    const landIds = new Set(plan.lands.map((l) => l.id));

    const horizonMax = plan.horizon.numDays - 1;
    const ensureWithinHorizon = (
      days: number[] | undefined,
      path: (string | number)[],
    ) => {
      if (!days) return;
      const outOfRange = days.filter((d) => d < 0 || d > horizonMax);
      if (outOfRange.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `日数は0〜${horizonMax}の範囲で指定してください`,
          path,
        });
      }
    };

    plan.lands.forEach((land, index) => {
      ensureWithinHorizon(land.blockedDays, ["lands", index, "blockedDays"]);
    });

    plan.workers.forEach((worker, index) => {
      ensureWithinHorizon(worker.blockedDays, [
        "workers",
        index,
        "blockedDays",
      ]);
    });

    plan.resources.forEach((resource, index) => {
      ensureWithinHorizon(resource.blockedDays, [
        "resources",
        index,
        "blockedDays",
      ]);
    });

    plan.events.forEach((event, index) => {
      if (!cropIds.has(event.cropId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "存在しない作物IDを参照しています",
          path: ["events", index, "cropId"],
        });
      }

      ensureWithinHorizon(event.startCond, ["events", index, "startCond"]);
      ensureWithinHorizon(event.endCond, ["events", index, "endCond"]);

      if (event.precedingEventId) {
        if (!eventIds.has(event.precedingEventId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "precedingEventId がイベント一覧に存在しません",
            path: ["events", index, "precedingEventId"],
          });
        } else {
          const preceding = plan.events.find(
            (e) => e.id === event.precedingEventId,
          );
          if (preceding && preceding.cropId !== event.cropId) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "precedingEventId は同じ作物の作業を参照してください",
              path: ["events", index, "precedingEventId"],
            });
          }
        }
      }
    });

    plan.cropAreaBounds.forEach((bound, index) => {
      if (!cropIds.has(bound.cropId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "cropAreaBounds で未知の作物IDを参照しています",
          path: ["cropAreaBounds", index, "cropId"],
        });
      }
    });

    plan.fixedAreas.forEach((fixed, index) => {
      if (!cropIds.has(fixed.cropId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "fixedAreas で未知の作物IDを参照しています",
          path: ["fixedAreas", index, "cropId"],
        });
      }
      if (!landIds.has(fixed.landId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "fixedAreas で未知の土地IDを参照しています",
          path: ["fixedAreas", index, "landId"],
        });
      }
    });
  });

export const planFormSchema = z.preprocess(
  sanitizePlanForValidation,
  basePlanFormSchema,
);

export const optimizationRequestDraftSchema = z.object({
  idempotencyKey: z.string().trim().min(1).optional(),
  plan: planFormSchema,
  timeoutMs: z.number().int().positive().optional(),
  priority: z.number().int().optional(),
});

export type PlanFormSchema = z.infer<typeof planFormSchema>;
export type PlanValidationResult = ReturnType<typeof planFormSchema.safeParse>;

export const validatePlan = (value: PlanFormState) =>
  planFormSchema.safeParse(value);

export const validateDraft = (draft: OptimizationRequestDraft) =>
  optimizationRequestDraftSchema.safeParse(draft);

export const normalizeArea = (measurement: AreaMeasurement): number =>
  measurement.unit === "a" ? measurement.value : measurement.value * 10;

export const normalizePricePerA = (measurement: PriceMeasurement): number =>
  measurement.unit === "a" ? measurement.value : measurement.value / 10;

export const buildApiPlanPayload = (plan: PlanFormState): ApiPlan => {
  const parsed = planFormSchema.parse(plan);

  return {
    horizon: {
      num_days: parsed.horizon.numDays,
    },
    crops: parsed.crops.map((crop) => ({
      id: crop.id,
      name: crop.name,
      category: crop.category ?? null,
      price_per_a: crop.price?.unit === "a" ? crop.price.value : null,
      price_per_10a: crop.price?.unit === "10a" ? crop.price.value : null,
    })),
    events: parsed.events.map((event) => ({
      id: event.id,
      crop_id: event.cropId,
      name: event.name,
      category: event.category ?? null,
      start_cond: event.startCond ?? null,
      end_cond: event.endCond ?? null,
      frequency_days: event.frequencyDays ?? null,
      preceding_event_id: event.precedingEventId ?? null,
      lag_min_days: event.lag?.min ?? null,
      lag_max_days: event.lag?.max ?? null,
      people_required: event.labor?.peopleRequired ?? null,
      labor_total_per_a: event.labor?.totalPerA ?? null,
      labor_daily_cap: event.labor?.dailyCap ?? null,
      required_roles: event.requiredRoles ?? null,
      required_resources: event.requiredResources ?? null,
      uses_land: event.usesLand,
    })),
    lands: parsed.lands.map((land) => ({
      id: land.id,
      name: land.name,
      area_a: land.area.unit === "a" ? land.area.value : null,
      area_10a: land.area.unit === "10a" ? land.area.value : null,
      tags: land.tags ?? null,
      blocked_days: land.blockedDays ?? null,
    })),
    workers: parsed.workers.map((worker) => ({
      id: worker.id,
      name: worker.name,
      roles: worker.roles,
      capacity_per_day: worker.capacityPerDay,
      blocked_days: worker.blockedDays ?? null,
    })),
    resources: parsed.resources.map((resource) => ({
      id: resource.id,
      name: resource.name,
      category: resource.category ?? null,
      capacity_per_day: resource.capacityPerDay ?? null,
      blocked_days: resource.blockedDays ?? null,
    })),
    crop_area_bounds:
      parsed.cropAreaBounds.length > 0
        ? parsed.cropAreaBounds.map((bound) => ({
            crop_id: bound.cropId,
            min_area_a:
              bound.minArea?.unit === "a" ? bound.minArea.value : undefined,
            min_area_10a:
              bound.minArea?.unit === "10a" ? bound.minArea.value : undefined,
            max_area_a:
              bound.maxArea?.unit === "a" ? bound.maxArea.value : undefined,
            max_area_10a:
              bound.maxArea?.unit === "10a" ? bound.maxArea.value : undefined,
          }))
        : null,
    fixed_areas:
      parsed.fixedAreas.length > 0
        ? parsed.fixedAreas.map((fixed) => ({
            land_id: fixed.landId,
            crop_id: fixed.cropId,
            area_a: fixed.area.unit === "a" ? fixed.area.value : null,
            area_10a: fixed.area.unit === "10a" ? fixed.area.value : null,
          }))
        : null,
    stages: parsed.stages
      ? {
          stage_order: parsed.stages.stageOrder,
          step_tolerance_by: parsed.stages.stepToleranceBy ?? null,
        }
      : null,
  };
};
