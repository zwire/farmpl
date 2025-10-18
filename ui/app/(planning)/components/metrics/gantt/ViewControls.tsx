import clsx from "clsx";
import {
  type GanttViewMode,
  useViewPreferencesStore,
} from "@/lib/state/view-preferences";

const viewModeOptions: { value: GanttViewMode; label: string }[] = [
  { value: "crop", label: "作物" },
  { value: "land", label: "土地" },
];

export const ViewControls = ({
  isLoading,
  error,
}: {
  isLoading: boolean;
  error: string | null;
}) => {
  const { gantt, setGantt } = useViewPreferencesStore();

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-slate-100 p-1.5 dark:bg-slate-800 md:flex-row">
      <div className="flex items-center gap-2">
        <span className="pl-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          表示モード
        </span>
        <div className="flex items-center rounded-md bg-slate-200/80 p-0.5 dark:bg-slate-900/70">
          {viewModeOptions.map((option) => (
            <label
              key={option.value}
              className={clsx(
                "relative flex cursor-pointer items-center justify-center rounded-[5px] px-3 py-1 text-sm transition-colors",
                gantt.mode === option.value
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "bg-transparent text-slate-600 hover:bg-white/50 dark:text-slate-400 dark:hover:bg-slate-700/50",
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
      <div className="flex items-center text-xs">
        {isLoading && <span className="text-slate-400">読み込み中…</span>}
        {error && <span className="text-red-500">{error}</span>}
      </div>
    </div>
  );
};
