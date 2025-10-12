import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { create } from "zustand";
import { GanttChart } from "@/app/(planning)/components/metrics/gantt/GanttChart";
import {
  type PlanningStoreState,
  usePlanningStore,
} from "@/lib/state/planning-store";
import { useViewPreferencesStore } from "@/lib/state/view-preferences";

// Mock the actual hooks
vi.mock("@/lib/state/planning-store");
vi.mock("@/lib/state/view-preferences");

const mockTimeline = {
  landSpans: [
    {
      landId: "L1",
      landName: "Land 1",
      cropId: "C1",
      cropName: "Crop 1",
      startDay: 0,
      endDay: 10,
      areaA: 1,
    },
  ],
  events: [],
};

const mockPlan = {
  horizon: { startDate: "2024-01-01", totalDays: 30, endDate: "2024-01-30" },
  lands: [{ id: "L1", name: "Land 1", area: 10, tags: [], blocked: [] }],
  crops: [{ id: "C1", name: "Crop 1" }],
  workers: [],
  resources: [],
  events: [],
  cropAreaBounds: [],
  fixedAreas: [],
};

// Create a temporary store for testing that mirrors the real one
interface ViewPreferencesState {
  gantt: {
    mode: "land" | "crop";
    scale: "third" | "day";
    detailExpanded: boolean;
  };
  setGantt: (prefs: Partial<ViewPreferencesState["gantt"]>) => void;
}

const createTestViewStore = () =>
  create<ViewPreferencesState>((set) => ({
    gantt: {
      mode: "crop",
      scale: "third",
      detailExpanded: false,
    },
    setGantt: (prefs) =>
      set((state) => ({ gantt: { ...state.gantt, ...prefs } })),
  }));

describe("GanttChart with View Preferences", () => {
  beforeEach(() => {
    // Provide a mock implementation for the planning store
    vi.mocked(usePlanningStore).mockImplementation(
      (selector: (state: PlanningStoreState) => unknown) => {
        const mockFullState: PlanningStoreState = {
          lastResult: { timeline: mockTimeline },
          plan: mockPlan,
          currentStep: "horizon",
          isDirty: false,
          lastSavedAt: null,
          isSubmitting: false,
          submissionError: null,
          setPlan: vi.fn(),
          updatePlan: vi.fn(),
          setCurrentStep: vi.fn(),
          reset: vi.fn(),
          markDirty: vi.fn(),
          setLastSavedAt: vi.fn(),
          replacePlan: vi.fn(),
          setIsSubmitting: vi.fn(),
          setSubmissionError: vi.fn(),
          setLastResult: vi.fn(),
        };
        return selector(mockFullState);
      },
    );

    // Use a fresh test store for each test
    const useTestStore = createTestViewStore();
    vi.mocked(useViewPreferencesStore).mockImplementation(useTestStore);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should render with default preferences (crop, third)", () => {
    render(<GanttChart />);
    expect(screen.getByText(/作物 \/ 日付/)).toBeInTheDocument();
    expect(screen.getByText(/1月 上旬/)).toBeInTheDocument();
  });

  it("should switch view mode when control is clicked", () => {
    render(<GanttChart />);
    act(() => {
      fireEvent.click(screen.getByRole("radio", { name: "土地" }));
    });
    expect(screen.getByText(/土地 \/ 日付/)).toBeInTheDocument();
  });

  // Persistence test is complex with this setup and might not be needed
  // if we trust the zustand persist middleware, which is tested by the library itself.
  // A simple check that the state changes is sufficient for integration.
});
