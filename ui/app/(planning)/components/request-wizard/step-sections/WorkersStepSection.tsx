"use client";

import type { PlanFormState } from "@/lib/types/planning";

import { EntityCard, Field, SectionCard } from "../SectionElements";
import { createUniqueId, toNumberList } from "../utils";
import type { PlanFormUpdater } from "./types";

type WorkersStepSectionProps = {
  plan: PlanFormState;
  onPlanChange: PlanFormUpdater;
};

export function WorkersStepSection({
  plan,
  onPlanChange,
}: WorkersStepSectionProps) {
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
