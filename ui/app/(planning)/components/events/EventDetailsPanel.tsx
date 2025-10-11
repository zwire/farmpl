"use client";

import { useId, useMemo, useState } from "react";

import type {
  DateRange,
  PlanUiEvent,
  PlanUiState,
} from "@/lib/domain/planning-ui-types";
import { EVENT_CATEGORY_OPTIONS } from "@/lib/domain/planning-ui-types";
import { PlanningEventDateUtils } from "@/lib/state/planning-store";
import {
  ComboBox,
  type ComboBoxOption,
  MultiComboBox,
} from "../request-wizard/ComboBox";
import { ChipInput } from "../request-wizard/inputs/ChipInput";
import { DateRangeInput } from "../request-wizard/inputs/DateRangeInput";
import { Field } from "../request-wizard/SectionElements";

interface EventDetailsPanelProps {
  plan: PlanUiState;
  eventId: string | null;
  onChange: (
    eventId: string,
    updater: (prev: PlanUiEvent) => PlanUiEvent,
  ) => void;
  onRemove: (eventId: string) => void;
}

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <details
    className="group rounded-lg border bg-white/50 border-slate-300 dark:border-slate-800 dark:bg-slate-900/30"
    open
  >
    <summary className="flex cursor-pointer list-none items-center justify-between p-4 font-semibold text-slate-800 dark:text-slate-200">
      {title}
      <svg
        className="h-5 w-5 text-slate-500 transition-transform group-open:rotate-180"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <title>詳細を切り替え</title>
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </summary>
    <div className="flex flex-col gap-4 border-t border-slate-200/80 p-4 text-xs text-slate-600 dark:border-slate-800/80 dark:text-slate-400">
      {children}
    </div>
  </details>
);

export function EventDetailsPanel({
  plan,
  eventId,
  onChange,
  onRemove,
}: EventDetailsPanelProps) {
  const selectedEvent = eventId
    ? plan.events.find((event) => event.id === eventId)
    : null;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const categoryOptionsId = useId();

  const categoryOptions = useMemo(
    () => EVENT_CATEGORY_OPTIONS.map((cat) => ({ value: cat, label: cat })),
    [],
  );

  const startRanges = useMemo(() => {
    if (!selectedEvent) return [];
    return PlanningEventDateUtils.collapseDatesToRanges(
      selectedEvent.startDates,
      plan.horizon,
    );
  }, [plan.horizon, selectedEvent]);

  const endRanges = useMemo(() => {
    if (!selectedEvent) return [];
    return PlanningEventDateUtils.collapseDatesToRanges(
      selectedEvent.endDates,
      plan.horizon,
    );
  }, [plan.horizon, selectedEvent]);

  const resourceOptions = useMemo<ComboBoxOption[]>(
    () =>
      plan.resources.map((resource) => ({
        value: resource.id,
        label: resource.name || resource.id,
        description: resource.category ?? undefined,
      })),
    [plan.resources],
  );

  const precedingEventOptions = useMemo<ComboBoxOption[]>(() => {
    if (!selectedEvent) return [];
    return plan.events
      .filter(
        (event) =>
          event.id !== selectedEvent.id &&
          event.cropId === selectedEvent.cropId,
      )
      .map((event) => ({
        value: event.id,
        label: event.name || event.id,
      }));
  }, [plan.events, selectedEvent]);

  const cropDisplayName = useMemo(() => {
    if (!selectedEvent) return "";
    const crop = plan.crops.find((item) => item.id === selectedEvent.cropId);
    return crop?.name ?? selectedEvent.cropId;
  }, [plan.crops, selectedEvent]);

  if (!selectedEvent) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/80 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/20 dark:text-slate-400">
        <p className="font-semibold">作業が選択されていません</p>
        <p className="mt-1 text-xs">
          左のグラフからノードを選択すると、
          <br />
          ここで詳細を編集できます。
        </p>
      </div>
    );
  }

  const update = (updater: (prev: PlanUiEvent) => PlanUiEvent) => {
    onChange(selectedEvent.id, updater);
  };

  const updateLabor = (patch: Partial<NonNullable<PlanUiEvent["labor"]>>) => {
    update((prev) => {
      const next = { ...(prev.labor ?? {}) } as Record<
        string,
        number | undefined
      >;
      for (const [key, val] of Object.entries(patch)) {
        if (val === undefined) {
          delete next[key];
        } else {
          next[key] = val;
        }
      }
      const cleanedEntries = Object.entries(next).filter(
        ([, val]) => val !== undefined,
      );
      const cleaned = cleanedEntries.length
        ? (Object.fromEntries(cleanedEntries) as NonNullable<
            PlanUiEvent["labor"]
          >)
        : undefined;
      return { ...prev, labor: cleaned };
    });
  };

  const updateLag = (patch: Partial<NonNullable<PlanUiEvent["lag"]>>) => {
    update((prev) => {
      const next = { ...(prev.lag ?? {}) } as Record<
        string,
        number | undefined
      >;
      for (const [key, val] of Object.entries(patch)) {
        if (val === undefined) {
          delete next[key];
        } else {
          next[key] = val;
        }
      }
      const cleanedEntries = Object.entries(next).filter(
        ([, val]) => val !== undefined,
      );
      const cleaned = cleanedEntries.length
        ? (Object.fromEntries(cleanedEntries) as NonNullable<
            PlanUiEvent["lag"]
          >)
        : undefined;
      return { ...prev, lag: cleaned };
    });
  };

  const handleStartRangesChange = (ranges: DateRange[]) => {
    const expanded = PlanningEventDateUtils.expandRangesToDateList(
      ranges,
      plan.horizon,
    );
    update((prev) => ({
      ...prev,
      startDates: expanded,
    }));
  };

  const handleEndRangesChange = (ranges: DateRange[]) => {
    const expanded = PlanningEventDateUtils.expandRangesToDateList(
      ranges,
      plan.horizon,
    );
    update((prev) => ({
      ...prev,
      endDates: expanded,
    }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex flex-col">
          <span className="text-base font-semibold text-slate-800 dark:text-slate-100">
            {selectedEvent.name || selectedEvent.id}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            ID: {selectedEvent.id}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="rounded-md px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-500"
        >
          削除
        </button>
      </div>

      <Section title="基本情報">
        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          対象作物:{" "}
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {cropDisplayName}
          </span>
        </p>
        <Field label="カテゴリ">
          <input
            list={categoryOptionsId}
            value={selectedEvent.category ?? ""}
            onChange={(event) => {
              const newCategory = event.target.value || undefined;
              update((prev) => ({
                ...prev,
                category: newCategory,
                name: !prev.name ? (newCategory ?? prev.name) : prev.name,
              }));
            }}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
          <datalist id={categoryOptionsId}>
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value} />
            ))}
          </datalist>
        </Field>
        <Field label="名称">
          <input
            value={selectedEvent.name}
            onChange={(event) =>
              update((prev) => ({ ...prev, name: event.target.value }))
            }
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
        </Field>
        <Field label="土地を使用">
          <select
            value={String(selectedEvent.usesLand)}
            onChange={(event) =>
              update((prev) => ({
                ...prev,
                usesLand: event.target.value === "true",
              }))
            }
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <option value="true">使用する</option>
            <option value="false">使用しない</option>
          </select>
        </Field>
      </Section>

      <Section title="スケジュール">
        <Field label="先行作業">
          <small className="block text-[11px] text-slate-400">
            この作業の開始条件が先行作業に依存する場合は選択してください。未指定の場合は日付で実行期間を限定します。
          </small>
          <ComboBox
            value={selectedEvent.precedingEventId ?? ""}
            onChange={(next) =>
              update((prev) => ({
                ...prev,
                precedingEventId: next || undefined,
                ...(next
                  ? { startDates: undefined, endDates: undefined }
                  : { lag: undefined }),
              }))
            }
            options={precedingEventOptions}
            placeholder="先行作業を選択"
            allowClear
          />
        </Field>

        {!selectedEvent.precedingEventId && (
          <div className="flex flex-col gap-3">
            <Field label="開始可能期間">
              <small className="block text-[11px] text-slate-400">
                開始可能期間を指定します。未設定の場合は制約なしです。
              </small>
              <DateRangeInput
                ranges={startRanges}
                onChange={handleStartRangesChange}
                horizon={plan.horizon}
                emptyMessage="開始可能な期間が登録されていません"
              />
            </Field>
            <Field label="締切期間">
              <small className="block text-[11px] text-slate-400">
                締切期間を指定します。未設定の場合は制約なしです。
              </small>
              <DateRangeInput
                ranges={endRanges}
                onChange={handleEndRangesChange}
                horizon={plan.horizon}
                emptyMessage="締切期間が登録されていません"
              />
            </Field>
          </div>
        )}

        {selectedEvent.precedingEventId && (
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="先行作業との最小間隔 (日前)">
              <small className="block text-[11px] text-slate-400">
                先行作業終了から何日後に開始できるかの下限です。
              </small>
              <input
                type="number"
                min={0}
                value={selectedEvent.lag?.min ?? ""}
                onChange={(event) =>
                  updateLag({
                    min:
                      event.target.value === ""
                        ? undefined
                        : Number(event.target.value || 0),
                  })
                }
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </Field>
            <Field label="先行作業との最大間隔 (日前)">
              <small className="block text-[11px] text-slate-400">
                先行作業終了から何日以内に開始すべきかの上限です。
              </small>
              <input
                type="number"
                min={0}
                value={selectedEvent.lag?.max ?? ""}
                onChange={(event) =>
                  updateLag({
                    max:
                      event.target.value === ""
                        ? undefined
                        : Number(event.target.value || 0),
                  })
                }
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </Field>
          </div>
        )}

        <Field label="繰り返し頻度 (日)">
          <small className="block text-[11px] text-slate-400">
            この作業を周期的に実施する場合に最低限設ける間隔日数です。
            未指定の場合は制約なしです。
          </small>
          <input
            type="number"
            min={1}
            value={selectedEvent.frequencyDays ?? ""}
            onChange={(event) =>
              update((prev) => ({
                ...prev,
                frequencyDays:
                  event.target.value === ""
                    ? undefined
                    : Number(event.target.value || 0),
              }))
            }
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
        </Field>
      </Section>

      <Section title="労働・リソース">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="総工数 (h/a)">
            <input
              type="number"
              min={0}
              value={selectedEvent.labor?.totalPerA ?? ""}
              onChange={(event) =>
                updateLabor({
                  totalPerA:
                    event.target.value === ""
                      ? undefined
                      : Number(event.target.value || 0),
                })
              }
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </Field>
          <Field label="必要人数">
            <input
              type="number"
              min={0}
              value={selectedEvent.labor?.peopleRequired ?? ""}
              onChange={(event) =>
                updateLabor({
                  peopleRequired:
                    event.target.value === ""
                      ? undefined
                      : Number(event.target.value || 0),
                })
              }
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </Field>
          <Field label="日最大工数 (h)">
            <input
              type="number"
              min={0}
              value={selectedEvent.labor?.dailyCap ?? ""}
              onChange={(event) =>
                updateLabor({
                  dailyCap:
                    event.target.value === ""
                      ? undefined
                      : Number(event.target.value || 0),
                })
              }
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </Field>
        </div>
        <Field label="必要役割">
          <ChipInput
            value={selectedEvent.requiredRoles ?? []}
            onChange={(next) =>
              update((prev) => ({
                ...prev,
                requiredRoles: next.length ? next : undefined,
              }))
            }
            placeholder="役割を入力"
          />
        </Field>
        <Field label="必要リソース">
          <MultiComboBox
            value={selectedEvent.requiredResources ?? []}
            onChange={(next) =>
              update((prev) => ({
                ...prev,
                requiredResources: next.length ? next : undefined,
              }))
            }
            options={resourceOptions}
            disabled={resourceOptions.length === 0}
            placeholder={
              resourceOptions.length === 0
                ? "共有リソースを追加してください"
                : "リソースを選択"
            }
          />
        </Field>
      </Section>

      {showDeleteConfirm && (
        <div className="flex flex-col gap-3 rounded-lg border-2 border-red-500/50 bg-red-50/50 p-4 text-sm dark:bg-red-900/20">
          <p className="font-semibold text-red-800 dark:text-red-200">
            本当にこの作業を削除しますか？
          </p>
          <p className="text-xs text-red-700 dark:text-red-300">
            この操作は取り消せません。関連する依存関係もリセットされます。
          </p>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-md border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={() => onRemove(selectedEvent.id)}
              className="rounded-md bg-red-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
            >
              削除する
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
