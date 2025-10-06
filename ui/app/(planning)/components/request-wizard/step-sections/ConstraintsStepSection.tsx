"use client";

import { useMemo } from "react";

import type { PlanFormFixedArea, PlanFormState } from "@/lib/types/planning";

import { ComboBox, type ComboBoxOption } from "../ComboBox";
import {
  EntityCard,
  Field,
  MeasurementInput,
  SectionCard,
} from "../SectionElements";
import type { PlanFormUpdater } from "./types";

type Preferences = NonNullable<PlanFormState["preferences"]>;
type PreferenceKey = keyof Preferences;

const STAGE_DEFINITIONS = [
  { key: "profit", label: "利益", preferenceKey: "wProfit" as PreferenceKey },
  { key: "labor", label: "労働", preferenceKey: "wLabor" as PreferenceKey },
  { key: "idle", label: "遊休", preferenceKey: "wIdle" as PreferenceKey },
  {
    key: "dispersion",
    label: "分散",
    preferenceKey: "wDispersion" as PreferenceKey,
  },
  { key: "peak", label: "ピーク", preferenceKey: "wPeak" as PreferenceKey },
  {
    key: "diversity",
    label: "多様性",
    preferenceKey: "wDiversity" as PreferenceKey,
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
  const stagePreferences = useMemo(() => ensurePreferences(plan), [plan]);
  const stageConfig = useMemo(() => ensureStageConfig(plan), [plan]);

  const cropOptions = useMemo<ComboBoxOption[]>(
    () =>
      plan.crops.map((crop) => ({
        value: crop.id,
        label: crop.name || crop.id,
        description: crop.category ?? undefined,
      })),
    [plan.crops],
  );

  const landOptions = useMemo<ComboBoxOption[]>(
    () =>
      plan.lands.map((land) => ({
        value: land.id,
        label: land.name || land.id,
        description: land.tags?.join(", ") || undefined,
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
          minArea: undefined,
          maxArea: undefined,
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

  const updateStageWeight = (key: PreferenceKey, value: number) => {
    onPlanChange((prev) => ({
      ...prev,
      preferences: {
        ...stagePreferences,
        [key]: value,
      },
    }));
  };

  const updateTolerance = (stageKey: string, value: number) => {
    onPlanChange((prev) => ({
      ...prev,
      stages: {
        stageOrder: STAGE_ORDER,
        toleranceByStage: {
          ...stageConfig.toleranceByStage,
          [stageKey]: value,
        },
        stepToleranceBy: stageConfig.stepToleranceBy,
      },
    }));
  };

  const updateStepTolerance = (stageKey: string, value: number) => {
    onPlanChange((prev) => ({
      ...prev,
      stages: {
        stageOrder: STAGE_ORDER,
        toleranceByStage: stageConfig.toleranceByStage,
        stepToleranceBy: {
          ...stageConfig.stepToleranceBy,
          [stageKey]: value,
        },
      },
    }));
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
            <div className="grid gap-3 md:grid-cols-2">
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
        description="土地に固定で割り当てる作付け面積を設定します"
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
        title="目的関数ウェイトと許容設定"
        description="各ステージのウェイトと許容率を設定します"
      >
        <div className="grid gap-3">
          <div className="grid grid-cols-[1.5fr_repeat(2,_1fr)] gap-3 text-xs font-semibold text-slate-500">
            <span>ステージ</span>
            <span>ウェイト</span>
            <span>許容率 (%)</span>
            <span>サブステップ許容率 (%)</span>
          </div>
          {STAGE_DEFINITIONS.map((stage) => (
            <div
              key={stage.key}
              className="grid grid-cols-[1.5fr_repeat(2,_1fr)] items-center gap-3 text-sm"
            >
              <span>{stage.label}</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={stagePreferences[stage.preferenceKey]}
                onChange={(event) =>
                  updateStageWeight(
                    stage.preferenceKey,
                    Number(event.target.value || 0),
                  )
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={(stageConfig.toleranceByStage?.[stage.key] ?? 0) * 100}
                onChange={(event) =>
                  updateTolerance(
                    stage.key,
                    Number(event.target.value || 0) / 100,
                  )
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={(stageConfig.stepToleranceBy?.[stage.key] ?? 0) * 100}
                onChange={(event) =>
                  updateStepTolerance(
                    stage.key,
                    Number(event.target.value || 0) / 100,
                  )
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

const ensurePreferences = (plan: PlanFormState): Preferences => {
  const defaults: Preferences = {
    wProfit: 1,
    wLabor: 1,
    wIdle: 1,
    wDispersion: 1,
    wPeak: 1,
    wDiversity: 1,
  };
  return { ...defaults, ...(plan.preferences ?? {}) } as Preferences;
};

const ensureStageConfig = (plan: PlanFormState) => {
  const incoming: Partial<PlanFormState["stages"]> = plan.stages ?? {};
  const tolerance = incoming.toleranceByStage ?? {};
  const stepTolerance = incoming.stepToleranceBy ?? {};
  return {
    stageOrder: STAGE_ORDER,
    toleranceByStage: tolerance,
    stepToleranceBy: stepTolerance,
  };
};
