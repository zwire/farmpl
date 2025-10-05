import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventBadges } from "@/app/(planning)/components/metrics/gantt/event-badges";
import type { GanttEventMarker } from "@/app/(planning)/components/metrics/gantt/useGanttData";

const mockEvents: GanttEventMarker[] = [
  { id: "e1", day: 1, cropId: "C1", label: "播種", dateIso: "2024-01-02" },
  { id: "e2", day: 1, cropId: "C1", label: "収穫", dateIso: "2024-01-02" },
];

describe("EventBadges", () => {
  it("should render nothing for no events", () => {
    const { container } = render(
      <EventBadges
        events={[]}
        onCategorySelect={() => {}}
        selectedCategory={null}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render badges for each category", () => {
    render(
      <EventBadges
        events={mockEvents}
        onCategorySelect={() => {}}
        selectedCategory={null}
      />,
    );
    const badges = screen.getAllByRole("button");
    expect(badges).toHaveLength(2);
    // Note: order is sorted by localeCompare
    expect(badges[0]).toHaveAttribute("aria-label", "Category: 収穫, 1 events");
    expect(badges[1]).toHaveAttribute("aria-label", "Category: 播種, 1 events");
  });

  it("should call onCategorySelect with the category name on click", () => {
    const onCategorySelect = vi.fn();
    render(
      <EventBadges
        events={mockEvents}
        onCategorySelect={onCategorySelect}
        selectedCategory={null}
      />,
    );
    const harvestBadge = screen.getByLabelText(/収穫/);
    fireEvent.click(harvestBadge);
    expect(onCategorySelect).toHaveBeenCalledWith("収穫");
  });

  it("should apply a ring when a category is selected", () => {
    render(
      <EventBadges
        events={mockEvents}
        onCategorySelect={() => {}}
        selectedCategory="播種"
      />,
    );
    const seedingBadge = screen.getByLabelText(/播種/);
    const harvestBadge = screen.getByLabelText(/収穫/);
    expect(seedingBadge).toHaveClass("ring-2");
    expect(harvestBadge).not.toHaveClass("ring-2");
  });
});
