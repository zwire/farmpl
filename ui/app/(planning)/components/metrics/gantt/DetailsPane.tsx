import type { MetricsDayRecord, MetricsInterval } from "@/lib/types/planning";
import { colorForCategory } from "./colorForCategory";
import type { GanttEventMarker } from "./useGanttData";

export type SelectedItem =
  | {
      type: "event_category";
      category: string;
      events: GanttEventMarker[];
    }
  | {
      type: "capacity";
      mode: "workers" | "lands";
      interval: MetricsInterval;
      record: MetricsDayRecord;
    }
  | null;

interface DetailsPaneProps {
  item: SelectedItem;
  landNameById: Record<string, string>;
  cropNameById: Record<string, string>;
}

export const DetailsPane = ({
  item,
  landNameById,
  cropNameById,
}: DetailsPaneProps) => {
  if (!item) {
    return (
      <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/80 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/20 dark:text-slate-400">
        <p className="font-semibold">詳細がありません</p>
        <p className="mt-1 text-xs">
          ガントチャートのマーカーや
          <br />
          キャパシティセルをクリックすると、
          <br />
          詳細がここに表示されます。
        </p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[300px] rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {item.type === "event_category" && (
        <EventCategoryDetails
          category={item.category}
          events={item.events}
          landNameById={landNameById}
          cropNameById={cropNameById}
        />
      )}
      {item.type === "capacity" && (
        <CapacityDetails
          mode={item.mode}
          interval={item.interval}
          record={item.record}
        />
      )}
    </div>
  );
};

// --- Sub-components for different detail types ---

const EventCategoryDetails = ({
  category,
  events,
  landNameById,
  cropNameById,
}: {
  category: string;
  events: GanttEventMarker[];
  landNameById: Record<string, string>;
  cropNameById: Record<string, string>;
}) => {
  const categoryColor = colorForCategory(category);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-3 dark:border-slate-700">
        <div
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: categoryColor.background }}
        />
        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200">
          {category} イベント詳細 ({events.length}件)
        </h4>
      </div>
      <ul className="mt-4 flex-1 space-y-2 overflow-y-auto pr-2">
        {events.map((event) => (
          <li
            key={event.id}
            className="rounded-md border border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-800/50"
          >
            <div className="font-semibold text-slate-700 dark:text-slate-300">
              {event.label}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span>
                <span className="font-medium">日付:</span> {event.dateIso}
              </span>
              <span className="truncate">
                <span className="font-medium">作物:</span>{" "}
                {cropNameById[event.cropId] ?? event.cropId}
              </span>
              {event.landId && (
                <span className="truncate">
                  <span className="font-medium">土地:</span>{" "}
                  {landNameById[event.landId] ?? event.landId}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

const CapacityDetails = ({
  mode,
  interval,
  record,
}: {
  mode: "workers" | "lands";
  record: MetricsDayRecord;
  interval: MetricsInterval;
}) => {
  const title = mode === "workers" ? "作業者キャパシティ" : "土地キャパシティ";
  const periodLabel =
    interval === "day"
      ? `Day ${(record.day_index as number) + 1}`
      : record.period_key;
  const items = mode === "workers" ? record.workers : record.lands;
  const totalUtil = items.reduce((sum, item) => sum + item.utilization, 0);
  const totalCap = items.reduce((sum, item) => sum + item.capacity, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 pb-3 dark:border-slate-700">
        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200">
          {title}
        </h4>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          期間: {periodLabel}
        </p>
      </div>

      <div className="my-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            合計使用量 / 合計キャパシティ
          </span>
          <span className="font-bold text-slate-700 dark:text-slate-300">
            {totalUtil.toFixed(1)} / {totalCap.toFixed(1)}
          </span>
        </div>
        <ProgressBar
          value={totalUtil}
          max={Math.max(totalCap, totalUtil, 1)}
          className="mt-2"
        />
      </div>

      <ul className="flex-1 space-y-2 overflow-y-auto pr-2 text-xs">
        {items.map((item) => (
          <li
            key={item.name}
            className="flex items-center justify-between rounded-md p-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {item.name}
            </span>
            <div className="flex flex-col items-end">
              <span className="font-mono text-slate-700 dark:text-slate-300">
                {item.utilization.toFixed(1)} / {item.capacity.toFixed(1)}
              </span>
              <ProgressBar
                value={item.utilization}
                max={Math.max(item.capacity, item.utilization, 1)}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

const ProgressBar = ({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className?: string;
}) => {
  const percent = max > 0 ? (value / max) * 100 : 0;
  return (
    <div
      className={`mt-1 h-1 w-24 rounded-full bg-slate-200 dark:bg-slate-700 ${className}`}
    >
      <div
        className="h-full rounded-full bg-sky-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};
