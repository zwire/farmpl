"use client";

import type { PlanFormState } from "@/lib/types/planning";

import { EntityCard, Field, SectionCard } from "../SectionElements";
import { createUniqueId, toNumberList } from "../utils";
import type { PlanFormUpdater } from "./types";

type LandsStepSectionProps = {
  plan: PlanFormState;
  onPlanChange: PlanFormUpdater;
};

export function LandsStepSection({
  plan,
  onPlanChange,
}: LandsStepSectionProps) {
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
