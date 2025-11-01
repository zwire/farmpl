import { useMemo } from "react";
import { classifyEventCategory } from "./classifyEventCategory";
import { type CategoryColor, colorForCategory } from "./colorForCategory";
import type { GanttEventMarker } from "./useGanttData";

interface CategoryBadge {
  category: string;
  color: CategoryColor;
  count: number;
  items: GanttEventMarker[];
}

interface EventBadgesProps {
  events: GanttEventMarker[];
}

export const EventBadges = ({ events }: EventBadgesProps) => {
  const badges = useMemo(() => {
    if (!events || events.length === 0) {
      return [];
    }
    const grouped = new Map<string, GanttEventMarker[]>();
    for (const event of events) {
      const category = classifyEventCategory(event.label);
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)?.push(event);
    }

    const result: CategoryBadge[] = Array.from(grouped.entries()).map(
      ([category, items]) => ({
        category,
        items,
        count: items.length,
        color: colorForCategory(category),
      }),
    );
    // Use code point comparison to avoid locale-dependent sorting differences
    result.sort((a, b) =>
      a.category < b.category ? -1 : a.category > b.category ? 1 : 0,
    );
    return result;
  }, [events]);

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1 p-0.5">
      {badges.map((badge) => (
        <span
          key={badge.category}
          className="h-2.5 w-2.5 rounded-full transition-transform"
          style={{
            backgroundColor: badge.color.background,
          }}
        />
      ))}
    </div>
  );
};
