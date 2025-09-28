"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";

import { usePlanningStore } from "@/lib/state/planning-store";
import { createTimelineScale } from "./timeline-scale";
import { useGanttData } from "./useGanttData";

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

export function GanttChart({ className }: { className?: string }) {
  const timeline = usePlanningStore((state) => state.lastResult?.timeline);
  const plan = usePlanningStore((state) => state.plan);

  const viewModel = useGanttData(timeline ?? undefined, plan);
  const scale = useMemo(() => {
    if (!viewModel) return null;
    return createTimelineScale({
      type: "day",
      startDateIso: viewModel.startDateIso,
      totalDays: viewModel.totalDays,
    });
  }, [viewModel]);

  if (!viewModel || !scale || viewModel.spans.length === 0) {
    return (
      <div
        className={`flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm ${className ?? ""}`}
      >
        <h3 className="text-lg font-semibold text-slate-900">ガントチャート</h3>
        <p>
          タイムラインデータがまだありません。最適化を実行すると表示されます。
        </p>
      </div>
    );
  }

  const dayLabels = viewModel.dayLabels;
  const columnTemplate = `${LEFT_GUTTER}px repeat(${dayLabels.length}, ${scale.unitWidth}px)`;
  const gridStyle: CSSProperties = {
    gridTemplateColumns: columnTemplate,
    rowGap: `${ROW_GAP}px`,
  };

  const headerCells = [
    <div
      key="header-land"
      className="sticky left-0 z-30 flex items-center justify-center border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-600"
      style={{ height: HEADER_HEIGHT }}
    >
      土地 / 日付
    </div>,
    ...dayLabels.map((day) => (
      <div
        key={`header-${day.day}`}
        className={`flex flex-col items-center justify-center border border-slate-200 text-[11px] ${
          day.isMajor
            ? "bg-slate-100 font-semibold text-slate-700"
            : "bg-white text-slate-500"
        }`}
        style={{ height: HEADER_HEIGHT }}
        title={formatFullDate(day.dateIso)}
      >
        {day.label}
      </div>
    )),
  ];

  const rowCells = viewModel.landOrder.flatMap((landId) => {
    const cells = viewModel.landDayCells[landId] ?? [];
    return [
      <div
        key={`${landId}-label`}
        className="sticky left-0 z-20 flex items-center border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700"
        style={{ minHeight: ROW_HEIGHT }}
      >
        {viewModel.landNameById[landId] ?? landId}
      </div>,
      ...cells.map((cell, dayIdx) => {
        const baseColor = cell.cropId ? cropColor(cell.cropId) : undefined;
        const background = baseColor ? hexToRgba(baseColor, 0.12) : undefined;
        const borders: React.CSSProperties = {};
        if (cell.cropStart && baseColor) {
          borders.borderLeft = `3px solid ${baseColor}`;
        }
        if (cell.cropEnd && baseColor) {
          borders.borderRight = `3px solid ${baseColor}`;
        }
        return (
          <div
            key={`${landId}-${dayIdx.toString()}`}
            className="relative border border-slate-200 px-2 py-1"
            style={{
              minHeight: ROW_HEIGHT,
              backgroundColor: background,
              ...borders,
            }}
          >
            {cell.cropStart && cell.cropName && (
              <div
                className="mb-1 text-[11px] font-semibold text-slate-700"
                title={cell.cropName}
              >
                {cell.cropName}
              </div>
            )}
            <div className="flex flex-col gap-0.5 text-[10px] text-slate-700">
              {cell.events.slice(0, 2).map((event) => (
                <span
                  key={event.id}
                  className="truncate"
                  title={`${event.label} (${formatFullDate(event.dateIso)})`}
                >
                  ・{event.label}
                </span>
              ))}
              {cell.events.length > 2 && (
                <span className="text-slate-500">
                  +{cell.events.length - 2}
                </span>
              )}
            </div>
          </div>
        );
      }),
    ];
  });

  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className ?? ""}`}
    >
      <header className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-slate-900">ガントチャート</h3>
        <p className="text-xs text-slate-500">
          土地 ×
          日付のマトリクスでイベントを確認できます。セル内には当日のイベント名を表示し、詳細はツールチップから参照可能です。
        </p>
      </header>
      <div className="relative overflow-x-auto">
        <div className="grid text-xs" style={gridStyle}>
          {headerCells}
          {rowCells}
        </div>
      </div>
    </div>
  );
}

const LONG_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  weekday: "short",
  timeZone: "UTC",
});

const formatFullDate = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  return LONG_FORMATTER.format(date);
};

const hexToRgba = (hex: string, alpha: number) => {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
