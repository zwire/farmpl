"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { PlanningCalendarService } from "@/lib/domain/planning-calendar";
import type { PlanUiEvent, PlanUiState } from "@/lib/domain/planning-ui-types";
import { SectionCard } from "../request-wizard/SectionElements";
import { createUniqueId } from "../request-wizard/utils";
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

  const handleAddEvent = () => {
    const newId = createUniqueId(
      "event",
      plan.events.map((event) => event.id),
    );
    onPlanChange((prev) => {
      const cropId = selectedCropId ?? prev.crops[0]?.id ?? "";
      const newEvent: PlanUiEvent = {
        id: newId,
        cropId,
        name: "新しいイベント",
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
        <label className="flex items-center gap-2 text-sm text-slate-600">
          対象作物
          <select
            value={selectedCropId ?? ""}
            onChange={handleCropSelect}
            className="rounded-md border border-slate-300 px-3 py-1 text-sm"
          >
            {plan.crops.map((crop) => (
              <option key={crop.id} value={crop.id}>
                {crop.name || crop.id}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-slate-500">
          作物を選んでからイベントの依存関係と詳細を編集します。
        </p>
      </div>

      <SectionCard
        title="イベント依存関係"
        description="ノードを選択してイベント詳細を編集し、エッジで依存関係を定義します"
        actionLabel="イベントを追加"
        onAction={handleAddEvent}
        emptyMessage="この作物にはイベントが登録されていません。"
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
        title="イベント詳細"
        description="選択したイベントの条件やリソースを調整します"
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
