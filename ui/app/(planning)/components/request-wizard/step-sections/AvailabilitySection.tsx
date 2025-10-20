"use client";

import type { PlanUiState } from "@/lib/domain/planning-ui-types";
import { createUniqueId } from "@/lib/utils/id";
import { ChipInput } from "../inputs/ChipInput";
import { DateRangeInput } from "../inputs/DateRangeInput";
import {
  EntityCard,
  Field,
  MeasurementInput,
  SectionCard,
} from "../SectionElements";
import {
  useLandActions,
  useResourceActions,
  useWorkerActions,
} from "./hooks/useEntityActions";

interface AvailabilitySectionProps {
  step: "lands" | "workers" | "resources";
  plan: PlanUiState;
  onPlanChange: (updater: (prev: PlanUiState) => PlanUiState) => void;
}

export function AvailabilitySection({
  step,
  plan,
  onPlanChange,
}: AvailabilitySectionProps) {
  const { addLand, updateLand, removeLand } = useLandActions(onPlanChange);
  const {
    addWorker,
    updateWorker,
    removeWorker,
    updateCapacity: updateWorkerCapacity,
  } = useWorkerActions(onPlanChange);
  const {
    addResource,
    updateResource,
    removeResource,
    updateCapacity: updateResourceCapacity,
  } = useResourceActions(onPlanChange);

  if (step === "lands") {
    return (
      <SectionCard
        title="圃場"
        description="圃場ごとの面積・タグ・利用不可期間を管理します"
        actionLabel="圃場を追加"
        onAction={() =>
          addLand(() => createUniqueId(plan.lands.map((land) => land.id)))
        }
        emptyMessage="圃場が登録されていません。"
        hasItems={plan.lands.length > 0}
      >
        {plan.lands.map((land, index) => (
          <EntityCard
            key={land.id}
            title={`圃場 #${index + 1}`}
            id={land.id}
            onRemove={() => removeLand(index)}
          >
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="名称">
                <input
                  value={land.name}
                  onChange={(event) =>
                    updateLand(index, {
                      name: event.target.value,
                    })
                  }
                  className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </Field>
              <Field label="タグ">
                <ChipInput
                  value={land.tags ?? []}
                  onChange={(next) => updateLand(index, { tags: next })}
                  placeholder="タグを入力"
                />
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)]">
              <Field label="面積">
                <MeasurementInput
                  measurement={land.area}
                  onChange={(unit, value) =>
                    updateLand(index, { area: { unit, value } })
                  }
                />
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)]">
              <Field label="利用不可期間">
                <DateRangeInput
                  ranges={land.blocked}
                  onChange={(next) => updateLand(index, { blocked: next })}
                  horizon={plan.horizon}
                />
              </Field>
            </div>
          </EntityCard>
        ))}
      </SectionCard>
    );
  }

  if (step === "workers") {
    return (
      <SectionCard
        title="作業者"
        description="作業者の役割と稼働可能期間を管理します"
        actionLabel="作業者を追加"
        onAction={() =>
          addWorker(() =>
            createUniqueId(plan.workers.map((worker) => worker.id)),
          )
        }
        emptyMessage="作業者が登録されていません。"
        hasItems={plan.workers.length > 0}
      >
        {plan.workers.map((worker, index) => (
          <EntityCard
            key={worker.id}
            title={`作業者 #${index + 1}`}
            id={worker.id}
            onRemove={() => removeWorker(index)}
          >
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="名称">
                <input
                  value={worker.name}
                  onChange={(event) =>
                    updateWorker(index, {
                      name: event.target.value,
                    })
                  }
                  className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </Field>
              <Field label="役割">
                <ChipInput
                  value={worker.roles ?? []}
                  onChange={(next) => updateWorker(index, { roles: next })}
                  placeholder="役割を入力"
                />
              </Field>
              <Field label="日あたり工数 (h)">
                <input
                  type="number"
                  min={0}
                  max={24}
                  value={worker.capacityPerDay}
                  onChange={(event) =>
                    updateWorkerCapacity(index, Number(event.target.value || 0))
                  }
                  className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </Field>
            </div>
            <Field label="利用不可期間">
              <DateRangeInput
                ranges={worker.blocked}
                onChange={(next) => updateWorker(index, { blocked: next })}
                horizon={plan.horizon}
              />
            </Field>
          </EntityCard>
        ))}
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="共有リソース"
      description="共有リソースと利用不可期間を管理します"
      actionLabel="共有リソースを追加"
      onAction={() =>
        addResource(() =>
          createUniqueId(plan.resources.map((resource) => resource.id)),
        )
      }
      emptyMessage="共有リソースが登録されていません。"
      hasItems={plan.resources.length > 0}
    >
      {plan.resources.map((resource, index) => (
        <EntityCard
          key={resource.id}
          title={`リソース #${index + 1}`}
          id={resource.id}
          onRemove={() => removeResource(index)}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="名称">
              <input
                value={resource.name}
                onChange={(event) =>
                  updateResource(index, { name: event.target.value })
                }
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </Field>
            <Field label="カテゴリ">
              <input
                value={resource.category ?? ""}
                onChange={(event) =>
                  updateResource(index, {
                    category: event.target.value || undefined,
                  })
                }
                placeholder="例: 耕運機"
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </Field>
            <Field label="日あたり使用可能時間 (h)">
              <input
                type="number"
                min={0}
                max={24}
                value={resource.capacityPerDay ?? ""}
                onChange={(event) =>
                  updateResourceCapacity(
                    index,
                    event.target.value === ""
                      ? undefined
                      : Number(event.target.value || 0),
                  )
                }
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </Field>
          </div>
          <Field label="利用不可期間">
            <DateRangeInput
              ranges={resource.blocked}
              onChange={(next) => updateResource(index, { blocked: next })}
              horizon={plan.horizon}
            />
          </Field>
        </EntityCard>
      ))}
    </SectionCard>
  );
}
