"use client";

import type { PlanFormState } from "@/lib/types/planning";

import { SectionCard } from "../SectionElements";
import type { PlanFormUpdater } from "./types";

interface HorizonStepSectionProps {
  plan: PlanFormState;
  onPlanChange: PlanFormUpdater;
}

export function HorizonStepSection({
  plan,
  onPlanChange,
}: HorizonStepSectionProps) {
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
