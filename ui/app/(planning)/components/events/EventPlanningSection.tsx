"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PlanningCalendarService } from "@/lib/domain/planning-calendar";
import type { PlanUiEvent, PlanUiState } from "@/lib/domain/planning-ui-types";
import { createUniqueId, formatIdHint } from "@/lib/utils/id";
import { SectionCard } from "../request-wizard/SectionElements";
import { EventDetailsPanel } from "./EventDetailsPanel";
import { EventGraphEditor } from "./EventGraphEditor";

interface EventPlanningSectionProps {
  plan: PlanUiState;
  onPlanChange: (updater: (prev: PlanUiState) => PlanUiState) => void;
}

export function EventPlanningSection({
  plan,
  onPlanChange,
}: EventPlanningSectionProps) {
  const API_BASE_URL = process.env.NEXT_PUBLIC_FARMPL_API_BASE ?? "";
  const API_KEY = process.env.NEXT_PUBLIC_FARMPL_API_KEY ?? "";
  const BEARER_TOKEN = process.env.NEXT_PUBLIC_FARMPL_BEARER_TOKEN ?? "";

  const cropIds = useMemo(
    () => plan.crops.map((crop) => crop.id),
    [plan.crops],
  );
  const [selectedCropId, setSelectedCropId] = useState<string | null>(
    cropIds[0] ?? null,
  );
  const cropEvents = useMemo(
    () =>
      selectedCropId
        ? plan.events.filter((event) => event.cropId === selectedCropId)
        : plan.events,
    [plan.events, selectedCropId],
  );

  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    cropEvents[0]?.id ?? null,
  );

  useEffect(() => {
    if (!selectedCropId && cropIds.length > 0) {
      setSelectedCropId(cropIds[0]);
    }
  }, [cropIds, selectedCropId]);

  useEffect(() => {
    if (
      selectedEventId &&
      !cropEvents.some((event) => event.id === selectedEventId)
    ) {
      setSelectedEventId(cropEvents[0]?.id ?? null);
    }
    if (!selectedEventId && cropEvents.length > 0) {
      setSelectedEventId(cropEvents[0].id);
    }
  }, [cropEvents, selectedEventId]);

  const handleSelect = (eventId: string | null) => {
    setSelectedEventId(eventId);
  };

  // ----- Template-based initialization UI state -----
  type CropVariantItem = {
    template_id: string;
    label: string;
    variant?: string | null;
  };
  type CropCatalogItem = {
    crop_name: string;
    category?: string | null;
    variants: CropVariantItem[];
  };
  type SuggestResponse = {
    query: string;
    items: CropCatalogItem[];
  };

  const selectedCropName = useMemo(
    () => plan.crops.find((c) => c.id === selectedCropId)?.name ?? "",
    [plan.crops, selectedCropId],
  );
  const [variants, setVariants] = useState<CropVariantItem[]>([]);
  const [variantLoading, setVariantLoading] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(plan.horizon.startDate);

  const refreshSuggestions = useCallback(async () => {
    if (!API_BASE_URL || !selectedCropName) return;
    setVariantLoading(true);
    setVariantError(null);
    try {
      const url = `${API_BASE_URL.replace(/\/$/, "")}/v1/templates/crops/suggest?query=${encodeURIComponent(selectedCropName)}`;
      const headers: Record<string, string> = {};
      if (API_KEY) headers["X-API-Key"] = API_KEY;
      if (BEARER_TOKEN) headers.Authorization = `Bearer ${BEARER_TOKEN}`;
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as SuggestResponse;
      const flat = data.items.flatMap((it) => it.variants);
      setVariants(flat);
      if (flat[0]) setSelectedTemplateId(flat[0].template_id);
    } catch (e: unknown) {
      setVariantError(e instanceof Error ? e.message : String(e));
    } finally {
      setVariantLoading(false);
    }
  }, [API_BASE_URL, API_KEY, BEARER_TOKEN, selectedCropName]);

  useEffect(() => {
    // auto-refresh when crop changes
    setStartDate(plan.horizon.startDate);
    setSelectedTemplateId("");
    setVariants([]);
    setVariantError(null);
    if (selectedCropName) void refreshSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCropName, plan.horizon.startDate, refreshSuggestions]);

  const initializeFromTemplate = async () => {
    if (!API_BASE_URL || !selectedTemplateId || !selectedCropId) return;
    try {
      const endpoint = `${API_BASE_URL.replace(/\/$/, "")}/v1/templates/instantiate-events`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (API_KEY) headers["X-API-Key"] = API_KEY;
      if (BEARER_TOKEN) headers.Authorization = `Bearer ${BEARER_TOKEN}`;
      const payload = {
        template_id: selectedTemplateId,
        start_date: startDate,
        horizon_days: plan.horizon.totalDays,
        target_crop_id: selectedCropId,
      };
      const resp = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: {
        events: {
          id: string;
          crop_id: string;
          name: string;
          category?: string | null;
          start_cond?: number[] | null;
          end_cond?: number[] | null;
          frequency_days?: number | null;
          preceding_event_id?: string | null;
          lag_min_days?: number | null;
          lag_max_days?: number | null;
          people_required?: number | null;
          labor_total_per_a?: number | null;
          labor_daily_cap?: number | null;
          required_roles?: string[] | null;
          required_resources?: string[] | null;
          uses_land: boolean;
        }[];
      } = await resp.json();

      const toIsoDates = (indices?: number[] | null) =>
        (indices ?? undefined)?.map((i) =>
          PlanningCalendarService.dayIndexToDate(plan.horizon.startDate, i),
        );

      const mapped = data.events.map(
        (ev): PlanUiEvent => ({
          id: ev.id,
          cropId: selectedCropId,
          name: ev.name,
          category: ev.category ?? undefined,
          startDates: toIsoDates(ev.start_cond),
          endDates: toIsoDates(ev.end_cond),
          frequencyDays: ev.frequency_days ?? undefined,
          precedingEventId: ev.preceding_event_id ?? undefined,
          lag:
            ev.lag_min_days || ev.lag_max_days
              ? {
                  min: ev.lag_min_days ?? undefined,
                  max: ev.lag_max_days ?? undefined,
                }
              : undefined,
          labor:
            ev.people_required || ev.labor_total_per_a || ev.labor_daily_cap
              ? {
                  peopleRequired: ev.people_required ?? undefined,
                  totalPerA: ev.labor_total_per_a ?? undefined,
                  dailyCap: ev.labor_daily_cap ?? undefined,
                }
              : undefined,
          requiredRoles: ev.required_roles ?? undefined,
          requiredResources: ev.required_resources ?? undefined,
          usesLand: ev.uses_land,
        }),
      );

      onPlanChange((prev) => ({
        ...prev,
        events: [
          // keep other crops' events
          ...prev.events.filter((e) => e.cropId !== selectedCropId),
          // add new ones
          ...mapped,
        ],
      }));
    } catch (e) {
      // no-op; could surface error toast if needed
      console.error(e);
    }
  };

  const handleAddEvent = () => {
    const newId = createUniqueId(plan.events.map((event) => event.id));
    onPlanChange((prev) => {
      const cropId = selectedCropId ?? prev.crops[0]?.id ?? "";
      const newEvent: PlanUiEvent = {
        id: newId,
        cropId,
        name: "新規作業",
        category: undefined,
        startDates: undefined,
        endDates: undefined,
        precedingEventId: undefined,
        frequencyDays: undefined,
        lag: undefined,
        labor: undefined,
        requiredRoles: undefined,
        requiredResources: undefined,
        usesLand: true,
      };
      return {
        ...prev,
        events: [...prev.events, newEvent],
      };
    });
    setSelectedEventId(newId);
  };

  const handleRemoveEvent = (eventId: string) => {
    onPlanChange((prev) => ({
      ...prev,
      events: prev.events.filter((event) => event.id !== eventId),
    }));
    setSelectedEventId((current) => (current === eventId ? null : current));
  };

  const handleUpdateEvent = (
    eventId: string,
    updater: (prev: PlanUiEvent) => PlanUiEvent,
  ) => {
    onPlanChange((prev) => {
      const index = prev.events.findIndex((event) => event.id === eventId);
      if (index === -1) return prev;
      const nextEvents = [...prev.events];
      nextEvents[index] = sanitizeEvent(updater(nextEvents[index]));
      return {
        ...prev,
        events: nextEvents,
      };
    });
  };

  const handleDependencyChange = (
    targetId: string,
    sourceId: string | null,
  ) => {
    onPlanChange((prev) => {
      const index = prev.events.findIndex((event) => event.id === targetId);
      if (index === -1) return prev;
      const nextEvents = [...prev.events];
      nextEvents[index] = {
        ...nextEvents[index],
        precedingEventId: sourceId ?? undefined,
      };
      return {
        ...prev,
        events: nextEvents,
      };
    });
  };
  const timelinePreview = useMemo(
    () => PlanningCalendarService.convertToApiPlan(plan),
    [plan],
  );

  const handleCropSelect = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedCropId(value);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex flex-col gap-2 text-sm text-slate-600">
          <div className="flex flex-row items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              対象作物
            </h3>
            <p className="text-xs text-slate-500">
              作物を選んでから作業間の依存関係と詳細を編集します。
            </p>
          </div>
          <select
            value={selectedCropId ?? ""}
            onChange={handleCropSelect}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            {plan.crops.map((crop) => (
              <option key={crop.id} value={crop.id}>
                {crop.name || crop.id}
                {crop.id ? formatIdHint(crop.id) : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <SectionCard
        title="テンプレートから作業計画作成"
        description="選択中の作物に対して、作型テンプレートと開始日を指定して作業計画を作成します"
      >
        <div className="flex flex-row items-end justify-between">
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1.5 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium">作型（近い名前を提案）</span>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="min-w-[260px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {variants.map((v) => (
                  <option key={v.template_id} value={v.template_id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium">開始日</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 transition-colors focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              />
            </label>
            <button
              type="button"
              onClick={refreshSuggestions}
              className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              候補更新
            </button>
            {variantLoading && (
              <span className="text-xs text-slate-500">読み込み中…</span>
            )}
            {variantError && (
              <span className="text-xs text-red-600">{variantError}</span>
            )}
          </div>
          {selectedTemplateId && (
            <button
              type="button"
              onClick={initializeFromTemplate}
              className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              テンプレートから作成
            </button>
          )}
        </div>
      </SectionCard>

      <SectionCard
        title="作業間の依存関係"
        description="パネルを選択して作業詳細を編集し、コネクタで依存関係を指定します"
        actionLabel="作業を追加"
        onAction={handleAddEvent}
        emptyMessage="この作物には作業計画が登録されていません。"
        hasItems={cropEvents.length > 0}
      >
        <EventGraphEditor
          events={cropEvents}
          selectedEventId={selectedEventId}
          onSelectEvent={handleSelect}
          onUpdateDependency={handleDependencyChange}
          onRemoveEvent={handleRemoveEvent}
        />
      </SectionCard>

      <SectionCard
        title="作業詳細"
        description="選択した作業の実行条件を調整します"
        hasItems={cropEvents.length > 0}
      >
        <EventDetailsPanel
          plan={plan}
          eventId={selectedEventId}
          onChange={handleUpdateEvent}
          onRemove={handleRemoveEvent}
        />
      </SectionCard>

      {timelinePreview.warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <p className="font-semibold">変換時の注意</p>
          <ul className="ml-4 list-disc">
            {timelinePreview.warnings.map((warning, index) => (
              <li key={`${warning.type}-${index}`}>{warning.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const sanitizeEvent = (event: PlanUiEvent): PlanUiEvent => {
  const startDates = event.startDates?.filter(Boolean);
  const endDates = event.endDates?.filter(Boolean);
  return {
    ...event,
    startDates:
      startDates && startDates.length > 0 ? startDates.sort() : undefined,
    endDates: endDates && endDates.length > 0 ? endDates.sort() : undefined,
  };
};
