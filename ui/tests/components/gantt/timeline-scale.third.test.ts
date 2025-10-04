import { describe, expect, it } from "vitest";
import { createTimelineScale } from "@/app/(planning)/components/gantt/timeline-scale";

describe("createTimelineScale ('third' scale)", () => {
  it("should generate correct thirds for a single month", () => {
    const scale = createTimelineScale({
      type: "third",
      startDateIso: "2024-03-01",
      totalDays: 31,
    });

    expect(scale.ticks.length).toBe(3);
    expect(scale.ticks[0].label).toBe("3月 上旬");
    expect(scale.ticks[1].label).toBe("3月 中旬");
    expect(scale.ticks[2].label).toBe("3月 下旬");

    expect(scale.formatTooltip(0)).toBe("2024/3/1(金)〜2024/3/10(日)");
    expect(scale.formatTooltip(1)).toBe("2024/3/11(月)〜2024/3/20(水)");
    expect(scale.formatTooltip(2)).toBe("2024/3/21(木)〜2024/3/31(日)");
  });

  it("should handle month boundaries correctly", () => {
    const scale = createTimelineScale({
      type: "third",
      startDateIso: "2024-03-25",
      totalDays: 20,
    });

    expect(scale.ticks.length).toBe(3);
    expect(scale.ticks[0].label).toBe("3月 下旬");
    expect(scale.ticks[1].label).toBe("4月 上旬");
    expect(scale.ticks[2].label).toBe("4月 中旬");

    expect(scale.formatTooltip(0)).toBe("2024/3/25(月)〜2024/3/31(日)");
    expect(scale.formatTooltip(1)).toBe("2024/4/1(月)〜2024/4/10(水)");
    expect(scale.formatTooltip(2)).toBe("2024/4/11(木)〜2024/4/13(土)");
  });

  it("should handle leap years correctly", () => {
    const scale = createTimelineScale({
      type: "third",
      startDateIso: "2024-02-21",
      totalDays: 15,
    });
    // Feb 2024 has 29 days.
    // Thirds should be: Feb 下旬 (21-29), Mar 上旬 (1-10)
    expect(scale.ticks.length).toBe(2);
    expect(scale.ticks[0].label).toBe("2月 下旬");
    expect(scale.ticks[1].label).toBe("3月 上旬");

    expect(scale.formatTooltip(0)).toBe("2024/2/21(水)〜2024/2/29(木)");
    expect(scale.formatTooltip(1)).toBe("2024/3/1(金)〜2024/3/6(水)");
  });

  it("should calculate position and span correctly", () => {
    const scale = createTimelineScale({
      type: "third",
      startDateIso: "2024-03-01",
      totalDays: 31,
    }); // 3 thirds, unitWidth=28

    // positionForDay
    expect(scale.positionForDay(0)).toBe(0); // Day 0 (Mar 1) -> third 0
    expect(scale.positionForDay(10)).toBe(28); // Day 10 (Mar 11) -> third 1
    expect(scale.positionForDay(25)).toBe(56); // Day 25 (Mar 26) -> third 2

    // spanWidth
    expect(scale.spanWidth(0, 9)).toBe(28); // Mar 1-10, all in first third
    expect(scale.spanWidth(5, 15)).toBe(56); // Mar 6-16, spans first and second third
    expect(scale.spanWidth(0, 30)).toBe(84); // Mar 1-31, spans all three thirds
  });
});
