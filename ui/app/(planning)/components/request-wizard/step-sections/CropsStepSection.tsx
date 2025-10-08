"use client";

import { useEffect, useState } from "react";

import type { PlanFormCrop, PlanFormState } from "@/lib/types/planning";

import { ComboBox, type ComboBoxOption } from "../ComboBox";
import { EntityCard, Field, SectionCard } from "../SectionElements";
import { createUniqueId, roundToInt } from "../utils";
import type { PlanFormUpdater } from "./types";

type CropsStepSectionProps = {
  plan: PlanFormState;
  onPlanChange: PlanFormUpdater;
};

type CropVariantItem = {
  template_id: string;
  label: string;
  variant?: string | null;
  price_per_a?: number | null;
  default_horizon_days?: number | null;
};

type CropCatalogItem = {
  crop_name: string;
  category?: string | null;
  variants: CropVariantItem[];
};

export function CropsStepSection({
  plan,
  onPlanChange,
}: CropsStepSectionProps) {
  const API_BASE_URL = process.env.NEXT_PUBLIC_FARMPL_API_BASE ?? "";
  const API_KEY = process.env.NEXT_PUBLIC_FARMPL_API_KEY ?? "";
  const BEARER_TOKEN = process.env.NEXT_PUBLIC_FARMPL_BEARER_TOKEN ?? "";

  const [catalog, setCatalog] = useState<CropCatalogItem[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        if (!API_BASE_URL) return;
        const url = `${API_BASE_URL.replace(/\/$/, "")}/v1/templates/crops`;
        const headers: Record<string, string> = {};
        if (API_KEY) headers["X-API-Key"] = API_KEY;
        if (BEARER_TOKEN) headers.Authorization = `Bearer ${BEARER_TOKEN}`;
        const resp = await fetch(url, { headers });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as CropCatalogItem[];
        if (!aborted) setCatalog(data);
      } catch (error: unknown) {
        if (!aborted) {
          const message =
            error instanceof Error ? error.message : String(error);
          setCatalogError(message);
        }
      }
    })();
    return () => {
      aborted = true;
    };
  }, [API_BASE_URL, API_KEY, BEARER_TOKEN]);

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

  const buildCatalogOptions = () =>
    (catalog ?? []).map(
      (item): ComboBoxOption => ({
        label: item.category
          ? `${item.crop_name}（${item.category}）`
          : item.crop_name,
        value: item.crop_name,
      }),
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
                options={buildCatalogOptions()}
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
