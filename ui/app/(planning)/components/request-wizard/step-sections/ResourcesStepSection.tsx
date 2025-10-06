"use client";

import type { PlanFormState } from "@/lib/types/planning";

import { EntityCard, Field, SectionCard } from "../SectionElements";
import { createUniqueId, toNumberList } from "../utils";
import type { PlanFormUpdater } from "./types";

type ResourcesStepSectionProps = {
  plan: PlanFormState;
  onPlanChange: PlanFormUpdater;
};

export function ResourcesStepSection({
  plan,
  onPlanChange,
}: ResourcesStepSectionProps) {
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
