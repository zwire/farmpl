"use client";

import { useMemo } from "react";

import type { PlanFormFixedArea, PlanFormState } from "@/lib/types/planning";
import { formatIdHint } from "@/lib/utils/id";
import { ComboBox, type ComboBoxOption } from "../ComboBox";
import {
  EntityCard,
  Field,
  MeasurementInput,
  SectionCard,
} from "../SectionElements";
import type { PlanFormUpdater } from "./types";

const STAGE_DEFINITIONS = [
  {
    key: "profit",
    label: "収益性",
    description: "全体の収益が最大になるようにします。",
  },
  {
    key: "dispersion",
    label: "作付けの集約",
    description: "同じ作物をなるべく近くの畑にまとめます。",
  },
  {
    key: "diversity",
    label: "品目の多様性",
    description: "なるべく多くの種類の作物を育てるようにします。",
  },
] as const;

const STAGE_ORDER = STAGE_DEFINITIONS.map((stage) => stage.key);

type ConstraintsStepSectionProps = {
  plan: PlanFormState;
  onPlanChange: PlanFormUpdater;
};

export function ConstraintsStepSection({
  plan,
  onPlanChange,
}: ConstraintsStepSectionProps) {
  const stageConfig = useMemo(() => ensureStageConfig(plan), [plan]);

  const cropOptions = useMemo<ComboBoxOption[]>(
    () =>
      plan.crops.map((crop) => ({
        value: crop.id,
        label: crop.name || crop.id,
        description: crop.category ?? undefined,
        hint: formatIdHint(crop.id),
      })),
    [plan.crops],
  );

  const landOptions = useMemo<ComboBoxOption[]>(
    () =>
      plan.lands.map((land) => ({
        value: land.id,
        label: land.name || land.id,
        description: land.tags?.join(", ") || undefined,
        hint: formatIdHint(land.id),
      })),
    [plan.lands],
  );

  const handleBoundsUpdate = (
    index: number,
    patch: Partial<PlanFormState["cropAreaBounds"][number]>,
  ) => {
    onPlanChange((prev) => {
      const next = [...prev.cropAreaBounds];
      next[index] = { ...next[index], ...patch };
      return { ...prev, cropAreaBounds: next };
    });
  };

  const handleFixedAreaUpdate = (
    index: number,
    patch: Partial<PlanFormFixedArea>,
  ) => {
    onPlanChange((prev) => {
      const next = [...prev.fixedAreas];
      next[index] = { ...next[index], ...patch };
      return { ...prev, fixedAreas: next };
    });
  };

  const handleAddBound = () => {
    if (plan.crops.length === 0) return;
    onPlanChange((prev) => ({
      ...prev,
      cropAreaBounds: [
        ...prev.cropAreaBounds,
        {
          cropId: prev.crops[0]?.id ?? "",
          minArea: { unit: "a", value: 1 },
          maxArea: { unit: "a", value: 10000 },
        },
      ],
    }));
  };

  const handleRemoveBound = (index: number) => {
    onPlanChange((prev) => ({
      ...prev,
      cropAreaBounds: prev.cropAreaBounds.filter((_, i) => i !== index),
    }));
  };

  const handleAddFixedArea = () => {
    if (plan.crops.length === 0 || plan.lands.length === 0) return;
    onPlanChange((prev) => ({
      ...prev,
      fixedAreas: [
        ...prev.fixedAreas,
        {
          landId: prev.lands[0]?.id ?? "",
          cropId: prev.crops[0]?.id ?? "",
          area: { unit: "a", value: 0.1 },
        },
      ],
    }));
  };

  const handleRemoveFixedArea = (index: number) => {
    onPlanChange((prev) => ({
      ...prev,
      fixedAreas: prev.fixedAreas.filter((_, i) => i !== index),
    }));
  };

  const updateTolerance = (stageKey: string, value: number) => {
    onPlanChange((prev) => {
      const currentStages = prev.stages ?? { stageOrder: STAGE_ORDER };
      return {
        ...prev,
        stages: {
          ...currentStages,
          stepToleranceBy: {
            ...(currentStages.stepToleranceBy ?? {}),
            [stageKey]: value,
          },
        },
      };
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="作付面積の上下限"
        description="作物ごとの最小・最大面積を設定します"
        actionLabel="制約を追加"
        onAction={handleAddBound}
        emptyMessage="面積制約は設定されていません。"
        hasItems={plan.cropAreaBounds.length > 0}
      >
        {plan.cropAreaBounds.map((bound, index) => (
          <EntityCard
            key={`${bound.cropId}-${index}`}
            title={`制約 #${index + 1}`}
            id={bound.cropId}
            onRemove={() => handleRemoveBound(index)}
          >
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="対象作物">
                <ComboBox
                  value={bound.cropId}
                  onChange={(next) =>
                    handleBoundsUpdate(index, { cropId: next })
                  }
                  options={cropOptions}
                  disabled={cropOptions.length === 0}
                  placeholder={
                    cropOptions.length === 0
                      ? "作物を追加してください"
                      : "作物を選択"
                  }
                />
              </Field>
              <Field label="最小面積">
                <MeasurementInput
                  measurement={bound.minArea}
                  onChange={(unit, value) =>
                    handleBoundsUpdate(index, {
                      minArea: { unit, value },
                    })
                  }
                />
              </Field>
              <Field label="最大面積">
                <MeasurementInput
                  measurement={bound.maxArea}
                  onChange={(unit, value) =>
                    handleBoundsUpdate(index, {
                      maxArea: { unit, value },
                    })
                  }
                />
              </Field>
            </div>
          </EntityCard>
        ))}
      </SectionCard>

      <SectionCard
        title="固定割当"
        description="土地に固定で割り当てる作付け面積の下限値を設定します"
        actionLabel="固定割当を追加"
        onAction={handleAddFixedArea}
        emptyMessage="固定割当は設定されていません。"
        hasItems={plan.fixedAreas.length > 0}
      >
        {plan.fixedAreas.map((fixed, index) => (
          <EntityCard
            key={`${fixed.landId}-${fixed.cropId}-${index}`}
            title={`固定割当 #${index + 1}`}
            id={`${fixed.landId}/${fixed.cropId}`}
            onRemove={() => handleRemoveFixedArea(index)}
          >
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="土地">
                <ComboBox
                  value={fixed.landId}
                  onChange={(next) =>
                    handleFixedAreaUpdate(index, { landId: next })
                  }
                  options={landOptions}
                  disabled={landOptions.length === 0}
                  placeholder={
                    landOptions.length === 0
                      ? "圃場を追加してください"
                      : "土地を選択"
                  }
                />
              </Field>
              <Field label="作物">
                <ComboBox
                  value={fixed.cropId}
                  onChange={(next) =>
                    handleFixedAreaUpdate(index, { cropId: next })
                  }
                  options={cropOptions}
                  disabled={cropOptions.length === 0}
                  placeholder={
                    cropOptions.length === 0
                      ? "作物を追加してください"
                      : "作物を選択"
                  }
                />
              </Field>
              <Field label="面積">
                <MeasurementInput
                  measurement={fixed.area}
                  onChange={(unit, value) =>
                    handleFixedAreaUpdate(index, {
                      area: { unit, value },
                    })
                  }
                />
              </Field>
            </div>
          </EntityCard>
        ))}
      </SectionCard>

      <SectionCard
        title="最適化の優先順位"
        description="どの目標を優先して計画を作成するかを設定します。優先順位はリストの上から順に適用されます。"
      >
        <div className="grid gap-4">
          <div className="grid grid-cols-[2fr_1fr] gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>優先目標</span>
            <div className="flex flex-col">
              <span>柔軟性 (%)</span>
              <span className="font-normal">
                後の目標のために、この目標値をどれだけ妥協できるか
              </span>
            </div>
          </div>
          {STAGE_DEFINITIONS.map((stage) => (
            <div
              key={stage.key}
              className="grid grid-cols-[2fr_1fr] items-start gap-4"
            >
              <div className="flex flex-col">
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {stage.label}
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {stage.description}
                </span>
              </div>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={(stageConfig.stepToleranceBy?.[stage.key] ?? 0) * 100}
                onChange={(event) =>
                  updateTolerance(
                    stage.key,
                    Number(event.target.value || 0) / 100,
                  )
                }
                className="w-full rounded-md border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:focus:border-sky-500"
              />
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

const ensureStageConfig = (plan: PlanFormState) => {
  const incoming: Partial<PlanFormState["stages"]> = plan.stages ?? {};
  const stepTolerance = incoming.stepToleranceBy ?? {};
  return {
    stageOrder: STAGE_ORDER,
    stepToleranceBy: stepTolerance,
  };
};
