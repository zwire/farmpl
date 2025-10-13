"use client";

import React, { type CSSProperties, useMemo, useState } from "react";
import { usePlanningStore } from "@/lib/state/planning-store";
import { useViewPreferencesStore } from "@/lib/state/view-preferences";
import type { OptimizationResultView } from "@/lib/types/planning";
import { formatIdHint } from "@/lib/utils/id";
import { useMetricsTimeline } from "../useMetricsTimeline";
import { CategoryLegend } from "./CategoryLegend";
import { classifyEventCategory } from "./classifyEventCategory";
import { colorForCategory } from "./colorForCategory";
import { DetailsPane, type SelectedItem } from "./DetailsPane";
import { EventBadges } from "./event-badges";
import { createTimelineScale } from "./timeline-scale";
import type { GanttEventMarker } from "./useGanttData";
import { useGanttData } from "./useGanttData";
import { useGanttViewModel } from "./useGanttViewModel";
import { ViewControls } from "./ViewControls";

type HexColor = string;

const ROW_HEIGHT = 36;
const ROW_GAP = 12;
const LEFT_GUTTER = 160;
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

// Function to get color based on usage percentage
const colorForUsage = (percentage: number): string => {
  if (percentage > 1) {
    // Over-capacity: red
    const lightness = 1 - Math.min((percentage - 1) / 0.5, 1) * 0.4; // 60% to 20% lightness
    return `hsl(0, 90%, ${lightness * 100}%)${lightness < 0.7 ? "aa" : ""}`;
  }
  if (percentage <= 0) {
    return `hsla(0, 0%, 100%, 1)`;
  }
  // 0-100% usage: green to yellow
  const hue = 120 * (1 - percentage); // 120 (green) -> 0 (red-ish, but we cap at yellow)
  return `hsla(${hue}, 70%, 50%, ${0.1 + percentage * 0.8})`;
};

const cellFilter = (item: SelectedItem, rowId: string, index: number) => {
  if (item?.rowId === rowId && item?.index === index) {
    return `brightness(2)`;
  }
  return `brightness(1)`;
};

export function GanttChart({
  jobId,
  jobResult,
  className,
}: {
  jobId: string | undefined;
  jobResult: OptimizationResultView | null;
  className?: string;
}) {
  const { gantt } = useViewPreferencesStore();
  const { timeline, isLoading, error } = useMetricsTimeline({
    jobId,
    result: jobResult,
    bucket: gantt.scale,
  });

  const result = usePlanningStore((state) => state.lastResult);
  const plan = usePlanningStore((state) => state.plan);

  const { gantt: viewPrefs } = useViewPreferencesStore();
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);

  const baseViewModel = useGanttData(result?.timeline ?? undefined, plan);

  const scale = useMemo(() => {
    if (!baseViewModel) return null;

    return createTimelineScale({
      type: timeline?.interval === "day" ? "day" : "third",
      startDateIso: baseViewModel.startDateIso,
      totalDays: baseViewModel.totalDays,
      minUnitWidth: 32, // Unify cell width
    });
  }, [baseViewModel, timeline?.interval]);

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

  if (!baseViewModel || !scale || !result?.timeline) {
    return (
      <div
        className={`flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${
          className ?? ""
        }`}
      >
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          タイムライン
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400">
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
      className="sticky left-0 z-30 flex items-center justify-center border-b border-r border-slate-200 bg-slate-100/80 text-sm font-semibold text-slate-600 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300"
      style={{ height: HEADER_HEIGHT }}
    >
      {viewPrefs.mode === "land" ? "土地" : "作物"} / 日付
    </div>,
    ...scale.ticks.map((tick, _) => (
      <span
        key={`header-${tick.day}`}
        className={`flex w-full flex-col items-center justify-center border border-slate-200 text-[11px] disabled:cursor-default dark:border-slate-700 ${
          tick.isMajor
            ? "bg-slate-100 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            : "bg-white text-slate-500 dark:bg-slate-900 dark:text-slate-400"
        }`}
        style={{ height: HEADER_HEIGHT }}
        title={scale.formatTooltip(tick.day)}
      >
        {tick.label}
      </span>
    )),
  ];

  const rowCells = viewModel.rowOrder.flatMap((rowId) => {
    // --- Capacity Rows ---
    if (rowId.startsWith("__")) {
      const mode = rowId === "__workers_capacity__" ? "workers" : "lands";
      const capacityCells = scale.ticks.map((_, tickIndex) => {
        const record = timeline?.records[tickIndex];
        if (!record) {
          return (
            <div
              key={`${rowId}-${tickIndex.toString()}`}
              className="border border-slate-200 dark:border-slate-700"
              style={{
                minHeight: ROW_HEIGHT,
                filter: cellFilter(selectedItem, rowId, tickIndex),
              }}
            />
          );
        }
        const items = mode === "workers" ? record.workers : record.lands;
        const used = items.reduce((s, i) => s + i.utilization, 0);
        const cap = items.reduce((s, i) => s + i.capacity, 0);
        const usagePct = cap > 0 ? used / cap : 0;

        return (
          <button
            type="button"
            key={`${rowId}-${tickIndex.toString()}`}
            onClick={() =>
              setSelectedItem({
                type: "capacity",
                index: tickIndex,
                rowId,
                mode,
                interval: timeline.interval,
                record,
              })
            }
            className="relative border border-slate-200 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            style={{
              minHeight: ROW_HEIGHT,
              backgroundColor: colorForUsage(usagePct),
              filter: cellFilter(selectedItem, rowId, tickIndex),
            }}
          >
            <span className="sr-only">
              {mode} capacity: {used.toFixed(1)}/{cap.toFixed(1)}
            </span>
          </button>
        );
      });

      return (
        <React.Fragment key={rowId}>
          <div
            key={`${rowId}-label`}
            className="sticky left-0 z-20 flex items-center border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            style={{ minHeight: ROW_HEIGHT }}
          >
            {viewModel.rowLabelById[rowId] ?? rowId}
          </div>
          {capacityCells}
        </React.Fragment>
      );
    }

    // --- Gantt Rows (Crops/Lands) ---
    const dayCells = viewModel.cellsByRow[rowId] ?? [];
    const ganttRowCells = scale.ticks.map((tick, tickIndex) => {
      let dayRange = scale.tickToDayRange(tickIndex);

      if (scale.type === "day") {
        dayRange = { startDay: tick.day, endDay: tick.day };
      }

      if (!dayRange) {
        return (
          <div
            key={`${rowId}-${tickIndex.toString()}`}
            className="relative border border-slate-200 dark:border-slate-700"
            style={{
              minHeight: ROW_HEIGHT,
              filter: cellFilter(selectedItem, rowId, tickIndex),
            }}
          />
        );
      }

      const eventsForTick: GanttEventMarker[] = [];
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
        <button
          type="button"
          key={`${rowId}-${tickIndex.toString()}`}
          className="relative border border-slate-200 px-1 py-1 text-left dark:border-slate-700"
          style={{
            minHeight: ROW_HEIGHT,
            backgroundColor: background,
            filter: cellFilter(selectedItem, rowId, tickIndex),
            ...borders,
          }}
          onClick={() =>
            setSelectedItem({
              type: "cell_events",
              index: tickIndex,
              rowId,
              events: eventsForTick,
            })
          }
        >
          <EventBadges events={eventsForTick} />
        </button>
      );
    });

    return (
      <React.Fragment key={rowId}>
        <div
          key={`${rowId}-label`}
          className="sticky left-0 z-20 flex items-center border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          style={{ minHeight: ROW_HEIGHT }}
        >
          {viewModel.rowLabelById[rowId] ?? rowId}
          <span className="text-slate-500 text-xs pl-1">
            {formatIdHint(rowId.slice(0, 8))}
          </span>
        </div>
        {ganttRowCells}
      </React.Fragment>
    );
  });

  return (
    <div className={`flex flex-col gap-6 ${className ?? ""}`}>
      <div className={`flex flex-col gap-4 ${className ?? ""}`}>
        <header className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
            タイムライン
          </h3>
          <ViewControls isLoading={isLoading} error={error} />
          <CategoryLegend items={allCategories} />
        </header>
        <div className="relative overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="grid text-xs" style={gridStyle}>
            {headerCells}
            {rowCells}
          </div>
        </div>
      </div>
      <div className="mt-2">
        <DetailsPane
          item={selectedItem}
          landNameById={baseViewModel?.landNameById ?? {}}
          cropNameById={baseViewModel?.cropNameById ?? {}}
          workerNameById={baseViewModel?.workerNameById ?? {}}
          resourceNameById={baseViewModel?.resourceNameById ?? {}}
        />
      </div>
    </div>
  );
}
