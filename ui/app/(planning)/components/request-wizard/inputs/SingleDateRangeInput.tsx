"use client";

import type { ChangeEvent } from "react";

import type {
  DateRange,
  IsoDateString,
  PlanUiState,
} from "@/lib/domain/planning-ui-types";

interface SingleDateRangeInputProps {
  ranges: DateRange[]; // 先頭のみ使用
  onChange: (next: DateRange[]) => void; // [envelope] 形式で返す
  horizon: PlanUiState["horizon"];
  emptyMessage?: string;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const normalizeDate = (value: string): IsoDateString | null =>
  ISO_DATE_PATTERN.test(value) ? (value as IsoDateString) : null;

export function SingleDateRangeInput({
  ranges,
  onChange,
  horizon,
  emptyMessage = "未設定です。開始日・終了日を入力してください。",
}: SingleDateRangeInputProps) {
  const current: DateRange = ranges[0] ?? { start: null, end: null };

  const update = (patch: Partial<DateRange>) => {
    const next = { ...current, ...patch };
    onChange([next]);
  };

  const handleStartChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    update({ start: value ? normalizeDate(value) : null });
  };

  const handleEndChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    update({ end: value ? normalizeDate(value) : null });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-3 text-xs">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr] md:items-end">
            <label className="flex flex-col gap-1">
              <span className="font-medium text-slate-600">開始日</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={current.start ?? ""}
                  onChange={handleStartChange}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                {current.start !== null && (
                  <button
                    type="button"
                    onClick={() => update({ start: null })}
                    className="text-xs text-slate-500 transition hover:text-slate-800"
                  >
                    クリア
                  </button>
                )}
              </div>
              <span className="text-[11px] text-slate-400">
                未入力の場合は計画開始日({horizon.startDate})からとみなします。
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-medium text-slate-600">終了日</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={current.end ?? ""}
                  onChange={handleEndChange}
                  className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
                {current.end !== null && (
                  <button
                    type="button"
                    onClick={() => update({ end: null })}
                    className="text-xs text-slate-500 transition hover:text-slate-800"
                  >
                    クリア
                  </button>
                )}
              </div>
              <span className="text-[11px] text-slate-400">
                未入力の場合は計画終了日({horizon.endDate})までとみなします。
              </span>
            </label>
          </div>
        </div>
        {!current.start && !current.end && (
          <p className="text-xs text-slate-500">{emptyMessage}</p>
        )}
      </div>
    </div>
  );
}

