import { colorForCategory } from "./colorForCategory";
import type { GanttEventMarker } from "./useGanttData";

interface EventDetailsPaneProps {
  category: string | null;
  events: GanttEventMarker[];
  landNameById: Record<string, string>;
  cropNameById: Record<string, string>;
}

export const EventDetailsPane = ({
  category,
  events,
  landNameById,
  cropNameById,
}: EventDetailsPaneProps) => {
  if (!category || events.length === 0) {
    return (
      <div className="p-4 text-sm text-slate-500 h-full flex items-center justify-center bg-slate-50 rounded-lg">
        <p className="text-center">
          マーカーをクリックすると、
          <br />
          そのカテゴリのイベント詳細がここに表示されます。
        </p>
      </div>
    );
  }

  const categoryColor = colorForCategory(category);

  return (
    <div className="p-4 bg-slate-50 h-full">
      <h4 className="text-lg font-semibold text-slate-800 mb-3 border-b pb-2">
        {category} イベント詳細
      </h4>
      <ul className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
        {events.map((event) => (
          <li
            key={event.id}
            className="text-sm border-l-4 pl-3 py-1 bg-white rounded-r-md shadow-sm"
            style={{ borderColor: categoryColor.background }}
          >
            <div className="font-semibold text-slate-700">{event.label}</div>
            <div className="text-xs text-slate-500 flex items-center gap-x-2">
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
