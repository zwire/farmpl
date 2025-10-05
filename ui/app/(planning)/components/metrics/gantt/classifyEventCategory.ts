import {
  EVENT_CATEGORY_OPTIONS,
  type EventCategory,
} from "@/lib/domain/planning-ui-types";

const categorySet = new Set(EVENT_CATEGORY_OPTIONS);

/**
 * Classifies an event category label.
 * If the label is one of the predefined categories, it returns the label.
 * If the label is null/undefined/empty, it defaults to 'その他'.
 * Otherwise, it returns the label as-is, treating it as a custom category.
 * @param label The event category label.
 * @returns The classified category label.
 */
export const classifyEventCategory = (
  label: string | null | undefined,
): string => {
  if (!label) {
    return "その他";
  }
  // The type assertion is safe because we are checking for existence.
  if (categorySet.has(label as EventCategory)) {
    return label;
  }
  return label;
};
