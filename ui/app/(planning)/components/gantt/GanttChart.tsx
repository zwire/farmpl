"use client";

import { useMemo, useState } from "react";

import { usePlanningStore } from "@/lib/state/planning-store";
import { useGanttData, type GanttFilters } from "./useGanttData";

interface GanttChartProps {
  className?: string;
}

const ROW_HEIGHT = 36;
const ROW_GAP = 12;
const DAY_WIDTH = 18;

const palette = [
  "#0ea5e9",
  "#22c55e",
  "#f97316",
  "#a855f7",
  "#facc15",
  "#fb7185",
  "#14b8a6",
];

const cropColor = (cropId: string) => {
  const hash = Array.from(cropId).reduce(
    (acc, char) => acc + char.charCodeAt(0),
    0,
  );
  return palette[hash % palette.length];
};

export function GanttChart({ className }: GanttChartProps) {
  const timeline = usePlanningStore((state) => state.lastResult?.timeline);
  const plan = usePlanningStore((state) => state.plan);

  const viewModel = useGanttData(timeline ?? undefined, plan);

  const [filters, setFilters] = useState<GanttFilters>({
    landId: "all",
    cropId: "all",
  });

  const filteredSpans = useMemo(() => {
    if (!viewModel) return [];
    return viewModel.spans.filter((span) => {
      const landOk = filters.landId === "all" || span.landId === filters.landId;
      const cropOk = filters.cropId === "all" || span.cropId === filters.cropId;
      return landOk && cropOk;
    });
  }, [filters, viewModel]);

  if (!viewModel || viewModel.spans.length === 0) {
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

  const totalHeight =
    viewModel.landOrder.length * (ROW_HEIGHT + ROW_GAP) + ROW_GAP;
  const totalWidth =
    Math.max(
      viewModel.maxDay + 1,
      plan?.horizon.numDays ?? viewModel.maxDay + 1,
    ) *
      DAY_WIDTH +
    120;

  const handleLandFilter = (landId: string) => {
    setFilters((prev) => ({ ...prev, landId }));
  };

  const handleCropFilter = (cropId: string) => {
    setFilters((prev) => ({ ...prev, cropId }));
  };

  const renderRows = () =>
    viewModel.landOrder.map((landId, index) => {
      const y = ROW_GAP + index * (ROW_HEIGHT + ROW_GAP);
      return (
        <g key={landId} transform={`translate(100, ${y})`}>
          <text
            x={-12}
            y={ROW_HEIGHT / 2}
            textAnchor="end"
            alignmentBaseline="middle"
            className="fill-slate-500 text-[11px]"
          >
            {viewModel.landNameById[landId] ?? ""}
          </text>
          <line
            x1={0}
            y1={ROW_HEIGHT}
            x2={totalWidth - 120}
            y2={ROW_HEIGHT}
            className="stroke-slate-200"
          />
        </g>
      );
    });

  const renderSpans = () =>
    filteredSpans.map((span) => {
      const rowIndex = viewModel.landOrder.indexOf(span.landId);
      if (rowIndex === -1) return null;
      const y = ROW_GAP + rowIndex * (ROW_HEIGHT + ROW_GAP);
      const x = 100 + span.startDay * DAY_WIDTH;
      const width = Math.max(
        (span.endDay - span.startDay + 1) * DAY_WIDTH - 4,
        8,
      );
      const rectColor = cropColor(span.cropId);
      return (
        <g key={span.id} transform={`translate(${x}, ${y})`}>
          <rect
            width={width}
            height={ROW_HEIGHT - 6}
            rx={6}
            fill={`${rectColor}33`}
            stroke={rectColor}
          />
          <text
            x={8}
            y={(ROW_HEIGHT - 6) / 2}
            alignmentBaseline="middle"
            className="select-none text-[11px] fill-slate-700"
          >
            {span.cropName || ""}
          </text>
        </g>
      );
    });

  const renderEventMarkers = () =>
    viewModel.events
      .filter((event) => {
        const landOk =
          filters.landId === "all" || event.landId === filters.landId;
        const cropOk =
          filters.cropId === "all" || event.cropId === filters.cropId;
        return landOk && cropOk;
      })
      .map((event) => {
        const rowIndex = event.landId
          ? viewModel.landOrder.indexOf(event.landId)
          : Math.max(
              viewModel.landOrder.indexOf(
                filters.landId === "all"
                  ? (event.landId ?? "")
                  : filters.landId,
              ),
              0,
            );
        const yBase =
          rowIndex >= 0 ? ROW_GAP + rowIndex * (ROW_HEIGHT + ROW_GAP) : ROW_GAP;
        const x = 100 + event.day * DAY_WIDTH;
        return (
          <g key={event.id} transform={`translate(${x}, ${yBase - 6})`}>
            <circle r={6} fill="#2563eb" className="opacity-80" />
            <title>{`${event.label} (day ${event.day})`}</title>
          </g>
        );
      });

  return (
    <div
      className={`flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className ?? ""}`}
    >
      <header className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold text-slate-900">ガントチャート</h3>
        <p className="text-xs text-slate-500">
          土地×作物の占有期間とイベントスケジュールを可視化します。
        </p>
      </header>
      <div className="flex flex-wrap gap-3 text-xs">
        <label className="flex items-center gap-2 text-slate-600">
          土地
          <select
            value={filters.landId}
            onChange={(event) =>
              handleLandFilter(event.target.value as GanttFilters["landId"])
            }
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700"
          >
            <option value="all">すべて</option>
            {viewModel.landOptions.map((landId) => (
              <option key={landId} value={landId}>
                {viewModel.landNameById[landId] ?? ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-slate-600">
          作物
          <select
            value={filters.cropId}
            onChange={(event) =>
              handleCropFilter(event.target.value as GanttFilters["cropId"])
            }
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-slate-700"
          >
            <option value="all">すべて</option>
            {viewModel.cropOptions.map((cropId) => (
              <option key={cropId} value={cropId}>
                {viewModel.cropNameById[cropId] ?? ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="relative overflow-x-auto">
        <svg
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          className="max-h-[360px] min-h-[240px] w-full"
          role="img"
          aria-label="プラン占用ガントチャート"
        >
          <title>プラン占用ガントチャート</title>
          <rect width={totalWidth} height={totalHeight} fill="transparent" />
          {renderRows()}
          {renderSpans()}
          {renderEventMarkers()}
        </svg>
      </div>
    </div>
  );
}
