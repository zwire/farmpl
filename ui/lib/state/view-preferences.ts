import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { TimelineScaleType } from "@/app/(planning)/components/metrics/gantt/timeline-scale";

export type GanttViewMode = "land" | "crop";

interface GanttPreferences {
  mode: GanttViewMode;
  scale: TimelineScaleType;
  detailExpanded: boolean;
}

interface ViewPreferencesState {
  gantt: GanttPreferences;
  setGantt: (prefs: Partial<GanttPreferences>) => void;
}

export const useViewPreferencesStore = create<ViewPreferencesState>()(
  persist(
    (set) => ({
      gantt: {
        mode: "crop",
        scale: "third",
        detailExpanded: false,
      },
      setGantt: (prefs) =>
        set((state) => ({
          gantt: { ...state.gantt, ...prefs },
        })),
    }),
    {
      name: "farmpl-view-preferences", // unique name
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
