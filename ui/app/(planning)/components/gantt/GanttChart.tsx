"use client";

import React, { type CSSProperties, useMemo, useState } from "react";
import { usePlanningStore } from "@/lib/state/planning-store";
import { useViewPreferencesStore } from "@/lib/state/view-preferences";
import { CategoryLegend } from "./CategoryLegend";
import { classifyEventCategory } from "./classifyEventCategory";
import { colorForCategory } from "./colorForCategory";
import { EventDetailsPane } from "./EventDetailsPane";
import { EventBadges } from "./event-badges";
import { createTimelineScale } from "./timeline-scale";
import { useGanttData } from "./useGanttData";
import { useGanttViewModel } from "./useGanttViewModel";
import { ViewControls } from "./ViewControls";

type HexColor = string;

const ROW_HEIGHT = 36;
const ROW_GAP = 12;
const LEFT_GUTTER = 150;
const HEADER_HEIGHT = 44;

const palette = [
  "#0ea5e9",
  "#22c55e",
  "#f97316",
  "#a855f7",
  "#facc15",
  "#fb7185",
  "#14b8a6",
];

const cropColor = (cropId: string): HexColor => {
  const hash = Array.from(cropId).reduce(
    (acc, char) => acc + char.charCodeAt(0),
    0,
  );
  return palette[hash % palette.length];
};

const hexToRgba = (hex: string, alpha: number) => {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export function GanttChart({ className }: { className?: string }) {
  const timeline = usePlanningStore((state) => state.lastResult?.timeline);
  const plan = usePlanningStore((state) => state.plan);

  const { gantt: viewPrefs } = useViewPreferencesStore();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [drillDownRange, setDrillDownRange] = useState<{
    startDay: number;
    endDay: number;
  } | null>(null);

  const baseViewModel = useGanttData(timeline ?? undefined, plan);

  const scale = useMemo(() => {
    if (!baseViewModel) return null;

    if (drillDownRange) {
      const drillDownStartDate = new Date(baseViewModel.startDateIso);
      drillDownStartDate.setUTCDate(
        drillDownStartDate.getUTCDate() + drillDownRange.startDay,
      );

      return createTimelineScale({
        type: "day",
        startDateIso: drillDownStartDate.toISOString(),
        totalDays: drillDownRange.endDay - drillDownRange.startDay + 1,
      });
    }

    return createTimelineScale({
      type: "third",
      startDateIso: baseViewModel.startDateIso,
      totalDays: baseViewModel.totalDays,
    });
  }, [baseViewModel, drillDownRange]);

  const handleHeaderClick = (tickIndex: number) => {
    if (drillDownRange || !baseViewModel) return;

    const thirdScale = createTimelineScale({
      type: "third",
      startDateIso: baseViewModel.startDateIso,
      totalDays: baseViewModel.totalDays,
    });

    const dayRange = thirdScale.tickToDayRange(tickIndex);
    if (dayRange) {
      setDrillDownRange(dayRange);
    }
  };

  const handleBackToThirds = () => {
    setDrillDownRange(null);
  };

  const viewModel = useGanttViewModel(baseViewModel, viewPrefs.mode);

  const allCategories = useMemo(() => {
    if (!baseViewModel) return [];
    const categoryNames = new Set(
      baseViewModel.events.map((e) => classifyEventCategory(e.label)),
    );
    return Array.from(categoryNames)
      .sort()
      .map((name) => ({
        name,
        color: colorForCategory(name),
      }));
  }, [baseViewModel]);

  const eventsForDetails = useMemo(() => {
    if (!selectedCategory || !baseViewModel) return [];
    return baseViewModel.events.filter(
      (e) => classifyEventCategory(e.label) === selectedCategory,
    );
  }, [baseViewModel, selectedCategory]);

  if (!baseViewModel || !scale || baseViewModel.spans.length === 0) {
    return (
      <div
        className={`flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${
          className ?? ""
        }`}
      >
        <header className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold text-slate-900">タイムライン</h3>
          <ViewControls />
        </header>
        <p className="text-sm text-slate-600">
          タイムラインデータがまだありません。最適化を実行すると表示されます。
        </p>
      </div>
    );
  }

  const gridStyle: CSSProperties = {
    gridTemplateColumns: `${LEFT_GUTTER}px repeat(${scale.ticks.length}, ${scale.unitWidth}px)`,
    rowGap: `${ROW_GAP}px`,
  };

  const headerCells = [
    <div
      key="header-label"
      className="sticky left-0 z-30 flex items-center justify-center border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-600"
      style={{ height: HEADER_HEIGHT }}
    >
      {viewPrefs.mode === "land" ? "土地" : "作物"} / 日付
    </div>,
    ...scale.ticks.map((tick, index) => (
      <button
        type="button"
        key={`header-${drillDownRange ? drillDownRange.startDay + tick.day : tick.day}`}
        disabled={!!drillDownRange}
        className={`flex w-full flex-col items-center justify-center border border-slate-200 text-[11px] disabled:cursor-default ${
          tick.isMajor
            ? "bg-slate-100 font-semibold text-slate-700"
            : "bg-white text-slate-500"
        } ${!drillDownRange ? "cursor-pointer hover:bg-slate-200" : ""}`}
        style={{ height: HEADER_HEIGHT }}
        title={scale.formatTooltip(tick.day)}
        onClick={() => handleHeaderClick(index)}
      >
        {tick.label}
      </button>
    )),
  ];

  const rowCells = viewModel.rowOrder.flatMap((rowId) => {
    const dayCells = viewModel.cellsByRow[rowId] ?? [];
    return [
      <div
        key={`${rowId}-label`}
        className="sticky left-0 z-20 flex items-center border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700"
        style={{ minHeight: ROW_HEIGHT }}
      >
        {viewModel.rowLabelById[rowId] ?? rowId}
      </div>,
      ...scale.ticks.map((tick, tickIndex) => {
        let dayRange = scale.tickToDayRange(tickIndex);

        if (drillDownRange && dayRange) {
          dayRange = {
            startDay: drillDownRange.startDay + dayRange.startDay,
            endDay: drillDownRange.startDay + dayRange.endDay,
          };
        }

        if (!dayRange) {
          const absoluteDay = drillDownRange
            ? drillDownRange.startDay + tick.day
            : tick.day;

          const dayCell =
            scale.type === "day" ? dayCells[absoluteDay] : undefined;
          if (!dayCell) {
            return (
              <div
                key={`${rowId}-${tickIndex.toString()}`}
                className="relative border border-slate-200"
                style={{ minHeight: ROW_HEIGHT }}
              ></div>
            );
          }
          dayRange = { startDay: absoluteDay, endDay: absoluteDay };
        }

        const eventsForTick = [];
        let primaryCropId: string | undefined;
        let hasCropStart = false;
        let hasCropEnd = false;

        for (let i = dayRange.startDay; i <= dayRange.endDay; i++) {
          const dayCell = dayCells[i];
          if (!dayCell) continue;
          eventsForTick.push(...dayCell.events);
          if (dayCell.cropId && !primaryCropId) {
            primaryCropId = dayCell.cropId;
          }
          if (dayCell.cropStart) hasCropStart = true;
          if (dayCell.cropEnd) hasCropEnd = true;
        }

        const baseColor = primaryCropId ? cropColor(primaryCropId) : undefined;
        const background = baseColor ? hexToRgba(baseColor, 0.12) : undefined;
        const borders: React.CSSProperties = {};
        if (hasCropStart && baseColor) {
          borders.borderLeft = `3px solid ${baseColor}`;
        }
        if (hasCropEnd && baseColor) {
          borders.borderRight = `3px solid ${baseColor}`;
        }

        return (
          <div
            key={`${rowId}-${tickIndex.toString()}`}
            className="relative border border-slate-200 px-1 py-1"
            style={{
              minHeight: ROW_HEIGHT,
              backgroundColor: background,
              ...borders,
            }}
          >
            <EventBadges
              events={eventsForTick}
              onCategorySelect={setSelectedCategory}
              selectedCategory={selectedCategory}
            />
          </div>
        );
      }),
    ];
  });

  return (
    <div
      className={`grid grid-cols-1 lg:grid-cols-12 gap-4 ${className ?? ""}`}
    >
      <div className="col-span-1 lg:col-span-8">
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <header className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-slate-900">
              タイムライン
            </h3>
            <div className="flex items-center gap-4">
              <ViewControls />
              {drillDownRange && (
                <button
                  type="button"
                  onClick={handleBackToThirds}
                  className="rounded-lg p-2 text-sm text-blue-600 hover:underline"
                >
                  &larr; 旬表示に戻る
                </button>
              )}
            </div>
            <CategoryLegend items={allCategories} />
          </header>
          <div className="relative overflow-x-auto">
            <div className="grid text-xs" style={gridStyle}>
              {headerCells}
              {rowCells}
            </div>
          </div>
        </div>
      </div>
      <div className="col-span-1 lg:col-span-4">
        <EventDetailsPane
          category={selectedCategory}
          events={eventsForDetails}
          landNameById={baseViewModel?.landNameById ?? {}}
          cropNameById={baseViewModel?.cropNameById ?? {}}
        />
      </div>
    </div>
  );
}
