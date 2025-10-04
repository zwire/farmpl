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
  <details className="rounded-lg border border-slate-200 bg-white/80">
    <summary className="cursor-pointer select-none rounded-lg px-4 py-2 text-sm font-semibold text-slate-700">
      {title}
    </summary>
    <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-4 text-xs text-slate-600">
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
      <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        イベントを選択すると詳細を編集できます。
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
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-800">
            {selectedEvent.name || selectedEvent.id}
          </span>
          <span className="text-xs text-slate-400">ID: {selectedEvent.id}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="text-xs text-red-500 transition hover:underline"
        >
          このイベントを削除
        </button>
      </div>

      <Section title="基本情報">
        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
          対象作物:{" "}
          <span className="font-medium text-slate-700">{cropDisplayName}</span>
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
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
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
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
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
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="true">使用する</option>
            <option value="false">使用しない</option>
          </select>
        </Field>
      </Section>

      <Section title="スケジュール">
        <Field label="先行イベント">
          <small className="block text-[11px] text-slate-400">
            先に完了しておくべきイベントを選択してください。未指定の場合は日付で実行期間を限定します。
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
            placeholder="先行イベントを選択"
            allowClear
          />
        </Field>

        {!selectedEvent.precedingEventId && (
          <div className="flex flex-col gap-3">
            <Field label="開始条件 (許可される期間)">
              <small className="block text-[11px] text-slate-400">
                指定した期間に含まれる各日付が開始可能日として保存されます。未設定の場合は制約なしです。
              </small>
              <DateRangeInput
                ranges={startRanges}
                onChange={handleStartRangesChange}
                horizon={plan.horizon}
                emptyMessage="開始可能な期間が登録されていません"
              />
            </Field>
            <Field label="終了条件 (締切期間)">
              <small className="block text-[11px] text-slate-400">
                指定した期間に含まれる各日付が締切日として保存されます。未設定の場合は制約なしです。
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
            <Field label="ラグ最小 (日前)">
              <small className="block text-[11px] text-slate-400">
                先行イベント終了から何日後に開始できるかの下限です。
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
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="ラグ最大 (日前)">
              <small className="block text-[11px] text-slate-400">
                先行イベント終了から何日以内に開始すべきかの上限です。
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
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </Field>
          </div>
        )}

        <Field label="繰り返し頻度 (日)">
          <small className="block text-[11px] text-slate-400">
            同じイベントを周期的に実施する場合の間隔です。
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
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
      </Section>

      <Section title="労働・リソース">
        <div className="grid gap-3 md:grid-cols-3">
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
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
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
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
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
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
        </div>
        <Field label="必要ロール">
          <ChipInput
            value={selectedEvent.requiredRoles ?? []}
            onChange={(next) =>
              update((prev) => ({
                ...prev,
                requiredRoles: next.length ? next : undefined,
              }))
            }
            placeholder="ロールを入力"
            emptyMessage="ロールが未指定です"
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
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          <span>本当に削除しますか？この操作は取り消せません。</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-md border border-red-200 px-3 py-1"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={() => onRemove(selectedEvent.id)}
              className="rounded-md bg-red-500 px-3 py-1 text-white"
            >
              削除する
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
