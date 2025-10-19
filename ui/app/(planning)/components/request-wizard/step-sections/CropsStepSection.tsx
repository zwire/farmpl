"use client";

import { useMemo } from "react";

import type { PlanFormCrop, PlanFormState } from "@/lib/types/planning";
import { createUniqueId } from "@/lib/utils/id";
import { roundToInt } from "@/lib/utils/number";
import { ComboBox, type ComboBoxOption } from "../ComboBox";
import { EntityCard, Field, SectionCard } from "../SectionElements";
import type { PlanFormUpdater } from "./types";
import { useTemplatesStore } from "@/lib/state/templates-store";

type CropsStepSectionProps = {
  plan: PlanFormState;
  onPlanChange: PlanFormUpdater;
};

export function CropsStepSection({
  plan,
  onPlanChange,
}: CropsStepSectionProps) {
  const catalog = useTemplatesStore((s) => s.crops);
  const catalogError = useTemplatesStore((s) => s.error);

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
          id: createUniqueId(prev.crops.map((crop) => crop.id)),
          name: "",
          category: "",
          price: { unit: "a", value: 1 },
        },
      ],
    }));
  };

  const buildCatalogOptions = useMemo(
    () =>
      (catalog ?? []).map(
        (item): ComboBoxOption => ({
          label: item.category
            ? `${item.crop_name}（${item.category}）`
            : item.crop_name,
          value: item.crop_name,
          hint: (item.aliases ?? []).join(" "),
        }),
      ),
    [catalog],
  );

  return (
    <SectionCard
      title="作物"
      description="計画に含める作物と価格を登録します。テンプレートからも選べます。"
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
          <div className="md:col-span-3 grid grid-cols-1 gap-2">
            <Field label="テンプレートから作物を選択（任意）">
              <ComboBox
                value=""
                onChange={(value) => {
                  if (!catalog) return;
                  const item = catalog.find((it) => it.crop_name === value);
                  if (!item) return;
                  const v0 = item.variants[0];
                  handleUpdate(index, {
                    name: item.crop_name,
                    category: item.category ?? "",
                    price: v0?.price_per_a
                      ? { unit: "a", value: v0.price_per_a }
                      : crop.price,
                  });
                }}
                options={buildCatalogOptions}
                disabled={!catalog || catalog.length === 0}
                placeholder={catalogError ?? "テンプレートの作物名を選択"}
              />
            </Field>
          </div>
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
                        value: roundToInt(Number(event.target.value || 0)),
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
                        value: roundToInt(crop.price?.value ?? 0),
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
