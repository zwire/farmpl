import type { MetricsDayRecord, MetricsInterval } from "@/lib/types/planning";
import { formatIdHint } from "@/lib/utils/id";
import type { GanttEventMarker } from "./useGanttData";

export type SelectedItem =
  | {
      type: "cell_events";
      index: number;
      rowId: string;
      events: GanttEventMarker[];
    }
  | {
      type: "capacity";
      index: number;
      rowId: string;
      mode: "workers" | "lands";
      interval: MetricsInterval;
      record: MetricsDayRecord;
    }
  | null;

interface DetailsPaneProps {
  item: SelectedItem;
  landNameById: Record<string, string>;
  cropNameById: Record<string, string>;
  workerNameById?: Record<string, string>;
  resourceNameById?: Record<string, string>;
}

export const DetailsPane = ({
  item,
  landNameById,
  cropNameById,
  workerNameById = {},
  resourceNameById = {},
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
      {item.type === "capacity" && (
        <CapacityDetails
          mode={item.mode}
          interval={item.interval}
          record={item.record}
        />
      )}
      {item.type === "cell_events" && (
        <CellEventsDetails
          events={item.events}
          landNameById={landNameById}
          cropNameById={cropNameById}
          workerNameById={workerNameById}
          resourceNameById={resourceNameById}
        />
      )}
    </div>
  );
};

// --- Sub-components for different detail types ---

const CellEventsDetails = ({
  events,
  landNameById,
  cropNameById,
  workerNameById,
  resourceNameById,
}: {
  events: GanttEventMarker[];
  landNameById: Record<string, string>;
  cropNameById: Record<string, string>;
  workerNameById: Record<string, string>;
  resourceNameById: Record<string, string>;
}) => {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
        <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200">
          作業詳細 ({events.length}件)
        </h4>
      </div>

      <ul className="mt-3 flex-1 space-y-3 overflow-y-auto pr-2">
        {events.map((ev) => (
          <li
            key={ev.id}
            className="rounded-md border border-slate-200 bg-slate-50/80 p-3 text-sm dark:border-slate-800 dark:bg-slate-800/50"
          >
            <div className="flex items-center gap-2">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {ev.dateIso}
              </div>
              <div className="font-semibold text-slate-700 dark:text-slate-300">
                {ev.label}
              </div>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="truncate">
                <span className="font-medium">作物:</span>{" "}
                {`${cropNameById[ev.cropId]} ${formatIdHint(ev.cropId)}`}
              </span>
              {ev.landId && (
                <span className="truncate">
                  <span className="font-medium">土地:</span>{" "}
                  {`${landNameById[ev.landId]} ${formatIdHint(ev.landId)}`}
                </span>
              )}
            </div>

            {/* Workers */}
            {ev.workerUsages.length > 0 && (
              <div className="mt-2">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  作業者
                </div>
                <ul className="mt-1 space-y-1">
                  {ev.workerUsages.map((u) => (
                    <li
                      key={`${ev.id}-w-${u.workerId}`}
                      className="flex items-center gap-2"
                    >
                      <span className="text-xs text-slate-600 dark:text-slate-300">
                        {`${workerNameById[u.workerId]} ${formatIdHint(u.workerId)} :`}
                      </span>
                      <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                        {u.hours.toFixed(1)} h
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Resources */}
            {ev.resourceUsages.length > 0 && (
              <div className="mt-2">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  リソース
                </div>
                <ul className="mt-1 space-y-1">
                  {ev.resourceUsages.map((u) => (
                    <li
                      key={`${ev.id}-r-${u.resourceId}`}
                      className="flex items-center gap-2"
                    >
                      <span className="text-xs text-slate-600 dark:text-slate-300">
                        {`${resourceNameById[u.resourceId]} ${formatIdHint(u.resourceId)} :`}
                      </span>
                      <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                        {u.quantity.toFixed(1)} {u.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
