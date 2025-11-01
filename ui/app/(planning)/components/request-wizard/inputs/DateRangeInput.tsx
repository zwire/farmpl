"use client";

import type { ChangeEvent } from "react";
import { useRef } from "react";

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
  const normalized = ranges ?? [];
  const idsRef = useRef<string[]>([]);
  const opRef = useRef<{ type: "add" | "remove" | null; index?: number }>({
    type: null,
  });
  const seqRef = useRef(0);

  // Apply queued structural ops first to keep stable keys across value edits
  if (opRef.current.type === "add") {
    idsRef.current = [...idsRef.current, `rng_${seqRef.current++}`];
    opRef.current = { type: null };
  } else if (
    opRef.current.type === "remove" &&
    typeof opRef.current.index === "number"
  ) {
    const idx = opRef.current.index as number;
    idsRef.current = idsRef.current.filter((_, i) => i !== idx);
    opRef.current = { type: null };
  }
  // Fallback sync when external code changes length unexpectedly
  if (idsRef.current.length < normalized.length) {
    const toAdd = normalized.length - idsRef.current.length;
    idsRef.current = idsRef.current.concat(
      Array.from({ length: toAdd }, () => `rng_${seqRef.current++}`),
    );
  } else if (idsRef.current.length > normalized.length) {
    idsRef.current = idsRef.current.slice(0, normalized.length);
  }

  const updateRange = (index: number, patch: Partial<DateRange>) => {
    const next = [...normalized];
    next[index] = { ...next[index], ...patch };
    onChange(next);
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
            key={idsRef.current[index]}
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
                      onClick={() =>
                        updateRange(normalized.indexOf(range), { start: null })
                      }
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
                      onClick={() =>
                        updateRange(normalized.indexOf(range), { end: null })
                      }
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
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    opRef.current = { type: "remove", index };
                    onChange(normalized.filter((_, i) => i !== index));
                  }}
                  className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100"
                >
                  期間を削除
                </button>
              </div>
            </div>
          </div>
        ))}
        {normalized.length === 0 && (
          <p className="text-xs text-slate-500">{emptyMessage}</p>
        )}
      </div>
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => {
            opRef.current = { type: "add" };
            onChange([...(normalized ?? []), { start: null, end: null }]);
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50"
        >
          期間を追加
        </button>
      </div>
    </div>
  );
}
