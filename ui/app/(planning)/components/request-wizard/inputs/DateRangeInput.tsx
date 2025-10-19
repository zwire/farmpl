"use client";

import type { ChangeEvent } from "react";

import type {
  DateRange,
  IsoDateString,
  PlanUiState,
} from "@/lib/domain/planning-ui-types";

interface DateRangeInputProps {
  ranges: DateRange[];
  onChange: (next: DateRange[]) => void;
  horizon: PlanUiState["horizon"];
  emptyMessage?: string;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDate = (value: string): IsoDateString | null =>
  ISO_DATE_PATTERN.test(value) ? (value as IsoDateString) : null;

export function DateRangeInput({
  ranges,
  onChange,
  horizon,
  emptyMessage = "まだ利用不可期間がありません。下の「期間を追加」を押してください。",
}: DateRangeInputProps) {
  const toEnvelope = (list: DateRange[]): DateRange[] => {
    if (list.length <= 1) return list;
    const starts = list.map((r) => r.start).filter(Boolean) as IsoDateString[];
    const ends = list.map((r) => r.end).filter(Boolean) as IsoDateString[];
    const env: DateRange = {
      start: (starts.length ? starts.sort()[0] : null) as IsoDateString | null,
      end: (ends.length
        ? ends.sort()[ends.length - 1]
        : null) as IsoDateString | null,
    };
    return [env];
  };

  // Always normalize to a single envelope
  const normalized = toEnvelope(ranges);
  const updateRange = (index: number, patch: Partial<DateRange>) => {
    const next = [...normalized];
    next[index] = { ...next[index], ...patch };
    onChange(toEnvelope(next));
  };

  const handleStartChange = (
    index: number,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value;
    updateRange(index, { start: value ? normalizeDate(value) : null });
  };

  const handleEndChange = (
    index: number,
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.target.value;
    updateRange(index, { end: value ? normalizeDate(value) : null });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {normalized.map((range, index) => (
          <div
            key={`${range.start ?? "open-start"}-${range.end ?? "open-end"}-${index}`}
            className="flex flex-col gap-2 rounded-md border border-slate-200 p-3 text-xs"
          >
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <label className="flex flex-col gap-1">
                <span className="font-medium text-slate-600">開始日</span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={range.start ?? ""}
                    onChange={(event) => handleStartChange(index, event)}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  {range.start !== null && (
                    <button
                      type="button"
                      onClick={() => updateRange(index, { start: null })}
                      className="text-xs text-slate-500 transition hover:text-slate-800"
                    >
                      クリア
                    </button>
                  )}
                </div>
                <span className="text-[11px] text-slate-400">
                  未入力の場合は計画開始日({horizon.startDate}
                  )からとみなします。
                </span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-medium text-slate-600">終了日</span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={range.end ?? ""}
                    onChange={(event) => handleEndChange(index, event)}
                    className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  {range.end !== null && (
                    <button
                      type="button"
                      onClick={() => updateRange(index, { end: null })}
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
              <div className="flex items-center justify-end" />
            </div>
          </div>
        ))}
        {normalized.length === 0 && (
          <p className="text-xs text-slate-500">{emptyMessage}</p>
        )}
      </div>
      {/* Single-range UI: no add/remove controls */}
    </div>
  );
}
