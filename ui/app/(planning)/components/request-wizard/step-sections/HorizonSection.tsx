"use client";

import type { ChangeEvent } from "react";

import { PlanningCalendarService } from "@/lib/domain/planning-calendar";
import type {
  IsoDateString,
  PlanUiState,
} from "@/lib/domain/planning-ui-types";

interface HorizonSectionProps {
  plan: PlanUiState;
  onPlanChange: (updater: (prev: PlanUiState) => PlanUiState) => void;
  validationErrors: string[];
  warnings: string[];
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isIsoDate = (value: string): value is IsoDateString =>
  ISO_DATE_PATTERN.test(value);

export function HorizonSection({
  plan,
  onPlanChange,
  validationErrors,
  warnings,
}: HorizonSectionProps) {
  const { startDate, endDate, totalDays } = plan.horizon;

  const updateHorizon = (nextStart: IsoDateString, nextEnd: IsoDateString) => {
    const recalculated = PlanningCalendarService.recalculateHorizon(
      nextStart,
      nextEnd,
    );
    onPlanChange((prev) => ({
      ...prev,
      horizon: recalculated,
    }));
  };

  const handleStartChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (!isIsoDate(value)) return;
    let nextEnd = endDate;
    try {
      PlanningCalendarService.recalculateHorizon(value, nextEnd);
    } catch {
      nextEnd = value;
    }
    updateHorizon(value, nextEnd);
  };

  const handleEndChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (!isIsoDate(value)) return;
    let nextEnd = value;
    try {
      PlanningCalendarService.recalculateHorizon(startDate, value);
    } catch {
      nextEnd = startDate;
    }
    updateHorizon(startDate, nextEnd);
  };

  const messages = [...warnings, ...validationErrors];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-slate-900">計画期間</h3>
        <p className="text-sm text-slate-600">
          プランの開始日と終了日をカレンダーから選び、全体の期間を決めます。
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">開始日</span>
          <input
            type="date"
            value={startDate}
            onChange={handleStartChange}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">終了日</span>
          <input
            type="date"
            value={endDate}
            onChange={handleEndChange}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p>
          選択期間: <strong>{startDate}</strong> 〜 <strong>{endDate}</strong>
        </p>
        <p className="mt-1 text-xs text-slate-500">
          全{totalDays}日間（開始日を0日目として計算します）
        </p>
      </div>
      {messages.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <ul className="ml-4 list-disc">
            {messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
