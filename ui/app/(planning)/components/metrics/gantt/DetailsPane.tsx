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
      <div className="p-4 text-sm text-slate-500 h-full flex items-center justify-center bg-slate-50 rounded-lg dark:bg-slate-800/50 dark:text-slate-400">
        <p className="text-center">
          ガントチャートのマーカーや
          <br />
          キャパシティセルをクリックすると、
          <br />
          詳細がここに表示されます。
        </p>
      </div>
    );
  }

  if (item.type === "event_category") {
    return (
      <EventCategoryDetails
        category={item.category}
        events={item.events}
        landNameById={landNameById}
        cropNameById={cropNameById}
      />
    );
  }

  if (item.type === "capacity") {
    return (
      <CapacityDetails
        mode={item.mode}
        interval={item.interval}
        record={item.record}
      />
    );
  }

  return null;
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
    <div className="p-4 bg-slate-50 h-full rounded-lg dark:bg-slate-800/50">
      <h4 className="text-lg font-semibold text-slate-800 mb-3 border-b pb-2 dark:text-slate-200 dark:border-slate-700">
        {category} イベント詳細
      </h4>
      <ul className="space-y-3 max-h-[250px] overflow-y-auto pr-2">
        {events.map((event) => (
          <li
            key={event.id}
            className="text-sm border-l-4 pl-3 py-1 bg-white rounded-r-md shadow-sm dark:bg-slate-900"
            style={{ borderColor: categoryColor.background }}
          >
            <div className="font-semibold text-slate-700 dark:text-slate-300">
              {event.label}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-x-2 dark:text-slate-400">
              <span>日付: {event.dateIso}</span>
              <span className="truncate">
                作物: {cropNameById[event.cropId] ?? event.cropId}
              </span>
              {event.landId && (
                <span className="truncate">
                  土地: {landNameById[event.landId] ?? event.landId}
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
    interval === "day" ? `Day ${record.day_index}` : record.period_key;
  const items = mode === "workers" ? record.workers : record.lands;
  const totalUtil = items.reduce((sum, item) => sum + item.utilization, 0);
  const totalCap = items.reduce((sum, item) => sum + item.capacity, 0);

  return (
    <div className="p-4 bg-slate-50 h-full rounded-lg dark:bg-slate-800/50">
      <h4 className="text-lg font-semibold text-slate-800 mb-1 dark:text-slate-200">
        {title}
      </h4>
      <p className="text-sm text-slate-500 mb-3 border-b pb-2 dark:text-slate-400 dark:border-slate-700">
        期間: {periodLabel}
      </p>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          合計使用量 / 合計キャパシティ
        </span>
        <span className="font-bold text-slate-700 dark:text-slate-300">
          {totalUtil.toFixed(1)} / {totalCap.toFixed(1)}
        </span>
      </div>
      <ul className="space-y-2 max-h-[200px] overflow-y-auto pr-2 text-xs">
        {items.map((item) => (
          <li
            key={item.name}
            className="flex items-center justify-between p-2 rounded-md bg-white dark:bg-slate-900"
          >
            <span className="font-medium text-slate-600 dark:text-slate-300">
              {item.name}
            </span>
            <div className="flex flex-col items-end">
              <span className="text-slate-700 dark:text-slate-300">
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

const ProgressBar = ({ value, max }: { value: number; max: number }) => {
  const percent = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="mt-1 h-1 w-24 rounded-full bg-slate-200 dark:bg-slate-700">
      <div
        className="h-full rounded-full bg-sky-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};
