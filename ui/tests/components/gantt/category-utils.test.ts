import { describe, expect, it } from "vitest";
import { classifyEventCategory } from "@/app/(planning)/components/metrics/gantt/classifyEventCategory";
import { colorForCategory } from "@/app/(planning)/components/metrics/gantt/colorForCategory";
import { EVENT_CATEGORY_OPTIONS } from "@/lib/domain/planning-ui-types";

describe("classifyEventCategory", () => {
  it("should return the same label for predefined categories", () => {
    expect(classifyEventCategory("播種")).toBe("播種");
    expect(classifyEventCategory("収穫")).toBe("収穫");
  });

  it("should return 'その他' for null or empty labels", () => {
    expect(classifyEventCategory(null)).toBe("その他");
    expect(classifyEventCategory(undefined)).toBe("その他");
    expect(classifyEventCategory("")).toBe("その他");
  });

  it("should return the original label for custom categories", () => {
    expect(classifyEventCategory("My Custom Category")).toBe(
      "My Custom Category",
    );
  });
});

describe("colorForCategory", () => {
  it("should return a stable color for a given category name", () => {
    const color1 = colorForCategory("播種");
    const color2 = colorForCategory("播種");
    expect(color1).toEqual(color2);
  });

  it("should return different colors for different category names", () => {
    const color1 = colorForCategory("播種");
    const color2 = colorForCategory("定植");
    expect(color1).not.toEqual(color2);
  });

  it("should return a neutral color for 'その他'", () => {
    const color = colorForCategory("その他");
    expect(color.background).toBe("#E5E7EB");
    expect(color.foreground).toBe("#1F2937");
  });

  it("should generate a foreground color with good contrast", () => {
    // This is hard to test without a full color contrast library,
    // but we can check that the foreground is either black or white.
    const color1 = colorForCategory("播種");
    expect(["#000000", "#FFFFFF"]).toContain(color1.foreground);

    const color2 = colorForCategory("収穫");
    expect(["#000000", "#FFFFFF"]).toContain(color2.foreground);
  });

  it("should generate consistent colors for all predefined categories", () => {
    const colors = new Map<string, object>();
    for (const category of EVENT_CATEGORY_OPTIONS) {
      const color = colorForCategory(category);
      if (colors.has(category)) {
        expect(colors.get(category)).toEqual(color);
      } else {
        colors.set(category, color);
      }
    }
    // Check that running it again produces the same colors
    for (const category of EVENT_CATEGORY_OPTIONS) {
      expect(colorForCategory(category)).toEqual(colors.get(category));
    }
  });
});
