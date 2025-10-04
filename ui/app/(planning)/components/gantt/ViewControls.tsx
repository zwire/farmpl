import {
  useViewPreferencesStore,
  type GanttViewMode,
} from "@/lib/state/view-preferences";
import type { TimelineScaleType } from "@/app/(planning)/components/gantt/timeline-scale";
import clsx from "clsx";

const viewModeOptions: { value: GanttViewMode; label: string }[] = [
  { value: "crop", label: "作物" },
  { value: "land", label: "土地" },
];

const scaleOptions: { value: TimelineScaleType; label: string }[] = [
  { value: "third", label: "旬" },
  { value: "day", label: "日" },
];

export const ViewControls = () => {
  const { gantt, setGantt } = useViewPreferencesStore();

  return (
    <div className="flex items-center gap-4 p-2 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">表示モード</span>
        <div className="flex items-center bg-gray-200 rounded-md p-0.5">
          {viewModeOptions.map((option) => (
            <label
              key={option.value}
              className={clsx(
                "relative flex cursor-pointer items-center justify-center px-3 py-1 text-sm rounded-md transition-colors",
                gantt.mode === option.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "bg-transparent text-gray-600 hover:bg-gray-100",
              )}
            >
              <input
                type="radio"
                name="gantt-view-mode"
                value={option.value}
                checked={gantt.mode === option.value}
                onChange={() => setGantt({ mode: option.value })}
                className="sr-only" // Visually hide the radio button
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">スケール</span>
        <div className="flex items-center bg-gray-200 rounded-md p-0.5">
          {scaleOptions.map((option) => (
            <label
              key={option.value}
              className={clsx(
                "relative flex cursor-pointer items-center justify-center px-3 py-1 text-sm rounded-md transition-colors",
                gantt.scale === option.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "bg-transparent text-gray-600 hover:bg-gray-100",
              )}
            >
              <input
                type="radio"
                name="gantt-scale"
                value={option.value}
                checked={gantt.scale === option.value}
                onChange={() => setGantt({ scale: option.value })}
                className="sr-only" // Visually hide the radio button
              />
              {option.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};
