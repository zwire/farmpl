"use client";

import { useMemo } from "react";
import type { WizardStepId } from "@/lib/state/wizard-steps";
import type {
  PlanFormCrop,
  PlanFormFixedArea,
  PlanFormState,
} from "@/lib/types/planning";

import { ComboBox, type ComboBoxOption } from "./ComboBox";
import {
  EntityCard,
  Field,
  MeasurementInput,
  SectionCard,
} from "./SectionElements";
import { createUniqueId } from "./utils";

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

interface StepSectionsProps {
  plan: PlanFormState;
  step: WizardStepId;
  errors: string[];
  onPlanChange: (updater: (prev: PlanFormState) => PlanFormState) => void;
}

export function StepSections({
  plan,
  step,
  errors,
  onPlanChange,
}: StepSectionsProps) {
  const stagePreferences = useMemo(() => ensurePreferences(plan), [plan]);
  const stageConfig = useMemo(() => ensureStageConfig(plan), [plan]);

  const renderContent = () => {
    switch (step) {
      case "horizon":
        return <HorizonSection plan={plan} onPlanChange={onPlanChange} />;
      case "crops":
        return <CropsSection plan={plan} onPlanChange={onPlanChange} />;
      case "lands":
        return <LandsSection plan={plan} onPlanChange={onPlanChange} />;
      case "workers":
        return <WorkersSection plan={plan} onPlanChange={onPlanChange} />;
      case "resources":
        return <ResourcesSection plan={plan} onPlanChange={onPlanChange} />;
      case "constraints":
        return (
          <ConstraintsSection
            plan={plan}
            onPlanChange={onPlanChange}
            stagePreferences={stagePreferences}
            stageConfig={stageConfig}
          />
        );
      case "events":
        return <EventsSection plan={plan} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {errors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          <p className="font-semibold">入力エラー</p>
          <ul className="ml-4 list-disc">
            {errors.map((error, index) => (
              <li key={index.toString()}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {renderContent()}
    </div>
  );
}

function HorizonSection({
  plan,
  onPlanChange,
}: Pick<StepSectionsProps, "plan" | "onPlanChange">) {
  return (
    <SectionCard title="計画期間" description="プラン全体の日数を設定します">
      <label className="flex max-w-xs flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">計画日数 (日)</span>
        <input
          type="number"
          min={1}
          value={plan.horizon.numDays}
          onChange={(event) => {
            const value = Number(event.target.value || 0);
            onPlanChange((prev) => ({
              ...prev,
              horizon: { numDays: value },
            }));
          }}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
    </SectionCard>
  );
}

function CropsSection({
  plan,
  onPlanChange,
}: Pick<StepSectionsProps, "plan" | "onPlanChange">) {
  const handleUpdate = (index: number, patch: Partial<PlanFormCrop>) => {
    onPlanChange((prev) => {
      const next = [...prev.crops];
      next[index] = { ...next[index], ...patch };
      return { ...prev, crops: next };
    });
  };

  const handleRemove = (index: number) => {
    onPlanChange((prev) => ({
      ...prev,
      crops: prev.crops.filter((_, i) => i !== index),
    }));
  };

  const handleAdd = () => {
    onPlanChange((prev) => ({
      ...prev,
      crops: [
        ...prev.crops,
        {
          id: createUniqueId(
            "crop",
            prev.crops.map((crop) => crop.id),
          ),
          name: "",
          category: "",
          price: { unit: "a", value: 1 },
        },
      ],
    }));
  };

  return (
    <SectionCard
      title="作物"
      description="計画に含める作物と価格を登録します"
      actionLabel="作物を追加"
      onAction={handleAdd}
      emptyMessage="作物が登録されていません。追加ボタンから作成してください。"
      hasItems={plan.crops.length > 0}
    >
      {plan.crops.map((crop, index) => (
        <EntityCard
          key={crop.id}
          title={`作物 #${index + 1}`}
          id={crop.id}
          onRemove={() => handleRemove(index)}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="名称">
              <input
                value={crop.name}
                onChange={(event) =>
                  handleUpdate(index, { name: event.target.value })
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="カテゴリ">
              <input
                value={crop.category ?? ""}
                onChange={(event) =>
                  handleUpdate(index, { category: event.target.value })
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="価格">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={crop.price?.value ?? ""}
                  onChange={(event) =>
                    handleUpdate(index, {
                      price: {
                        unit: crop.price?.unit ?? "a",
                        value: Number(event.target.value || 0),
                      },
                    })
                  }
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <select
                  value={crop.price?.unit ?? "a"}
                  onChange={(event) => {
                    const nextUnit = event.target.value === "10a" ? "10a" : "a";
                    handleUpdate(index, {
                      price: {
                        unit: nextUnit,
                        value: crop.price?.value ?? 0,
                      },
                    });
                  }}
                  className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                >
                  <option value="a">円/a</option>
                  <option value="10a">円/10a</option>
                </select>
              </div>
            </Field>
          </div>
        </EntityCard>
      ))}
    </SectionCard>
  );
}

function EventsSection({ plan }: Pick<StepSectionsProps, "plan">) {
  return (
    <SectionCard
      title="イベント"
      description="イベント詳細はイベントエディタから編集してください"
      hasItems={plan.events.length > 0}
      emptyMessage="イベントが登録されていません。イベント依存のフローで追加してください。"
    >
      <p className="text-xs text-slate-500">
        イベントの追加・編集はイベント依存関係セクションで行えます。
      </p>
    </SectionCard>
  );
}

function LandsSection({
  plan,
  onPlanChange,
}: Pick<StepSectionsProps, "plan" | "onPlanChange">) {
  const handleUpdate = (
    index: number,
    patch: Partial<PlanFormState["lands"][number]>,
  ) => {
    onPlanChange((prev) => {
      const next = [...prev.lands];
      next[index] = { ...next[index], ...patch };
      return { ...prev, lands: next };
    });
  };

  const handleAreaUpdate = (
    index: number,
    unit: PlanFormState["lands"][number]["area"]["unit"],
    value: number,
  ) => {
    onPlanChange((prev) => {
      const next = [...prev.lands];
      next[index] = {
        ...next[index],
        area: { unit, value },
      };
      return { ...prev, lands: next };
    });
  };

  const handleAdd = () => {
    onPlanChange((prev) => ({
      ...prev,
      lands: [
        ...prev.lands,
        {
          id: createUniqueId(
            "land",
            prev.lands.map((land) => land.id),
          ),
          name: "",
          area: { unit: "a", value: 0 },
          tags: [],
          blockedDays: [],
        },
      ],
    }));
  };

  const handleRemove = (index: number) => {
    onPlanChange((prev) => ({
      ...prev,
      lands: prev.lands.filter((_, i) => i !== index),
    }));
  };

  return (
    <SectionCard
      title="圃場"
      description="利用する圃場の面積と封鎖日を登録します"
      actionLabel="圃場を追加"
      onAction={handleAdd}
      emptyMessage="圃場が登録されていません。"
      hasItems={plan.lands.length > 0}
    >
      {plan.lands.map((land, index) => (
        <EntityCard
          key={land.id}
          title={`圃場 #${index + 1}`}
          id={land.id}
          onRemove={() => handleRemove(index)}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="名称">
              <input
                value={land.name}
                onChange={(event) =>
                  handleUpdate(index, { name: event.target.value })
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="タグ (カンマ区切り)">
              <input
                value={(land.tags ?? []).join(",")}
                onChange={(event) =>
                  handleUpdate(index, {
                    tags: event.target.value
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  })
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <div className="grid gap-3 md:grid-cols-[auto_auto_auto]">
            <Field label="面積">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={land.area.value}
                  onChange={(event) =>
                    handleAreaUpdate(
                      index,
                      land.area.unit,
                      Number(event.target.value || 0),
                    )
                  }
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                <select
                  value={land.area.unit}
                  onChange={(event) =>
                    handleAreaUpdate(
                      index,
                      event.target
                        .value as PlanFormState["lands"][number]["area"]["unit"],
                      land.area.value,
                    )
                  }
                  className="rounded-md border border-slate-300 px-2 py-2 text-sm"
                >
                  <option value="a">a</option>
                  <option value="10a">10a</option>
                </select>
              </div>
            </Field>
            <Field label="封鎖日 (カンマ区切り)">
              <input
                value={(land.blockedDays ?? []).join(",")}
                onChange={(event) =>
                  handleUpdate(index, {
                    blockedDays: toNumberList(event.target.value),
                  })
                }
                placeholder="例: 0,15,30"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>
        </EntityCard>
      ))}
    </SectionCard>
  );
}

function WorkersSection({
  plan,
  onPlanChange,
}: Pick<StepSectionsProps, "plan" | "onPlanChange">) {
  const handleUpdate = (
    index: number,
    patch: Partial<PlanFormState["workers"][number]>,
  ) => {
    onPlanChange((prev) => {
      const next = [...prev.workers];
      next[index] = { ...next[index], ...patch };
      return { ...prev, workers: next };
    });
  };

  const handleAdd = () => {
    onPlanChange((prev) => ({
      ...prev,
      workers: [
        ...prev.workers,
        {
          id: createUniqueId(
            "worker",
            prev.workers.map((worker) => worker.id),
          ),
          name: "",
          roles: [],
          capacityPerDay: 8,
          blockedDays: [],
        },
      ],
    }));
  };

  const handleRemove = (index: number) => {
    onPlanChange((prev) => ({
      ...prev,
      workers: prev.workers.filter((_, i) => i !== index),
    }));
  };

  return (
    <SectionCard
      title="労働力"
      description="作業者の稼働条件と封鎖日を登録します"
      actionLabel="作業者を追加"
      onAction={handleAdd}
      emptyMessage="作業者が未登録です。"
      hasItems={plan.workers.length > 0}
    >
      {plan.workers.map((worker, index) => (
        <EntityCard
          key={worker.id}
          title={`作業者 #${index + 1}`}
          id={worker.id}
          onRemove={() => handleRemove(index)}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="名称">
              <input
                value={worker.name}
                onChange={(event) =>
                  handleUpdate(index, { name: event.target.value })
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="ロール (カンマ区切り)">
              <input
                value={worker.roles.join(",")}
                onChange={(event) =>
                  handleUpdate(index, {
                    roles: event.target.value
                      .split(",")
                      .map((role) => role.trim())
                      .filter(Boolean),
                  })
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="日最大稼働 (h)">
              <input
                type="number"
                min={0}
                value={worker.capacityPerDay}
                onChange={(event) =>
                  handleUpdate(index, {
                    capacityPerDay: Number(event.target.value || 0),
                  })
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <Field label="封鎖日 (カンマ区切り)">
            <input
              value={(worker.blockedDays ?? []).join(",")}
              onChange={(event) =>
                handleUpdate(index, {
                  blockedDays: toNumberList(event.target.value),
                })
              }
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="例: 0,7,14"
            />
          </Field>
        </EntityCard>
      ))}
    </SectionCard>
  );
}

function ResourcesSection({
  plan,
  onPlanChange,
}: Pick<StepSectionsProps, "plan" | "onPlanChange">) {
  const handleUpdate = (
    index: number,
    patch: Partial<PlanFormState["resources"][number]>,
  ) => {
    onPlanChange((prev) => {
      const next = [...prev.resources];
      next[index] = { ...next[index], ...patch };
      return { ...prev, resources: next };
    });
  };

  const handleAdd = () => {
    onPlanChange((prev) => ({
      ...prev,
      resources: [
        ...prev.resources,
        {
          id: createUniqueId(
            "resource",
            prev.resources.map((resource) => resource.id),
          ),
          name: "",
          category: "",
          capacityPerDay: undefined,
          blockedDays: [],
        },
      ],
    }));
  };

  const handleRemove = (index: number) => {
    onPlanChange((prev) => ({
      ...prev,
      resources: prev.resources.filter((_, i) => i !== index),
    }));
  };

  return (
    <SectionCard
      title="共有リソース"
      description="機械・資材などの共有リソースを登録します"
      actionLabel="リソースを追加"
      onAction={handleAdd}
      emptyMessage="共有リソースが未登録です。"
      hasItems={plan.resources.length > 0}
    >
      {plan.resources.map((resource, index) => (
        <EntityCard
          key={resource.id}
          title={`リソース #${index + 1}`}
          id={resource.id}
          onRemove={() => handleRemove(index)}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="名称">
              <input
                value={resource.name}
                onChange={(event) =>
                  handleUpdate(index, { name: event.target.value })
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="カテゴリ">
              <input
                value={resource.category ?? ""}
                onChange={(event) =>
                  handleUpdate(index, { category: event.target.value })
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="日最大稼働量">
              <input
                type="number"
                min={0}
                value={resource.capacityPerDay ?? ""}
                onChange={(event) =>
                  handleUpdate(index, {
                    capacityPerDay:
                      event.target.value === ""
                        ? undefined
                        : Number(event.target.value || 0),
                  })
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>
          <Field label="封鎖日 (カンマ区切り)">
            <input
              value={(resource.blockedDays ?? []).join(",")}
              onChange={(event) =>
                handleUpdate(index, {
                  blockedDays: toNumberList(event.target.value),
                })
              }
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="例: 0,7,14"
            />
          </Field>
        </EntityCard>
      ))}
    </SectionCard>
  );
}

interface ConstraintsSectionProps {
  plan: PlanFormState;
  onPlanChange: (updater: (prev: PlanFormState) => PlanFormState) => void;
  stagePreferences: ReturnType<typeof ensurePreferences>;
  stageConfig: ReturnType<typeof ensureStageConfig>;
}

function ConstraintsSection({
  plan,
  onPlanChange,
  stagePreferences,
  stageConfig,
}: ConstraintsSectionProps) {
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
        stageOrder: stageConfig.stageOrder,
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
        stageOrder: stageConfig.stageOrder,
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

const toNumberList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));

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
