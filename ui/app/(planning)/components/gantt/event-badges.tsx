import clsx from "clsx";
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
  onCategorySelect: (category: string) => void;
  selectedCategory: string | null;
}

export const EventBadges = ({
  events,
  onCategorySelect,
  selectedCategory,
}: EventBadgesProps) => {
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
    result.sort((a, b) => a.category.localeCompare(b.category));
    return result;
  }, [events]);

  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1 p-0.5">
      {badges.map((badge) => (
        <button
          key={badge.category}
          type="button"
          onClick={() => onCategorySelect(badge.category)}
          aria-label={`Category: ${badge.category}, ${badge.count} events`}
          className={clsx(
            "h-2.5 w-2.5 rounded-full transition-transform hover:scale-125",
            selectedCategory === badge.category &&
              "ring-2 ring-sky-500 ring-offset-1",
          )}
          style={{
            backgroundColor: badge.color.background,
          }}
        />
      ))}
    </div>
  );
};
