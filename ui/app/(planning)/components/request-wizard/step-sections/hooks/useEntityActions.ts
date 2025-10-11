import { useCallback } from "react";

import type {
  PlanUiLand,
  PlanUiResource,
  PlanUiState,
  PlanUiWorker,
} from "@/lib/domain/planning-ui-types";

type StateUpdater<T> = (updater: (prev: T) => T) => void;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const useLandActions = (onPlanChange: StateUpdater<PlanUiState>) => {
  const addLand = useCallback(
    (createId: () => string) => {
      onPlanChange((prev) => ({
        ...prev,
        lands: [
          ...prev.lands,
          {
            id: createId(),
            name: "",
            area: { unit: "a", value: 1 },
            tags: [],
            blocked: [],
          },
        ],
      }));
    },
    [onPlanChange],
  );

  const updateLand = useCallback(
    (index: number, patch: Partial<PlanUiLand>) => {
      onPlanChange((prev) => {
        const next = [...prev.lands];
        next[index] = { ...next[index], ...patch };
        return { ...prev, lands: next };
      });
    },
    [onPlanChange],
  );

  const removeLand = useCallback(
    (index: number) => {
      onPlanChange((prev) => ({
        ...prev,
        lands: prev.lands.filter((_, i) => i !== index),
      }));
    },
    [onPlanChange],
  );

  return { addLand, updateLand, removeLand };
};

export const useWorkerActions = (onPlanChange: StateUpdater<PlanUiState>) => {
  const addWorker = useCallback(
    (createId: () => string) => {
      onPlanChange((prev) => ({
        ...prev,
        workers: [
          ...prev.workers,
          {
            id: createId(),
            name: "",
            roles: [],
            capacityPerDay: 8,
            blocked: [],
          },
        ],
      }));
    },
    [onPlanChange],
  );

  const updateWorker = useCallback(
    (index: number, patch: Partial<PlanUiWorker>) => {
      onPlanChange((prev) => {
        const next = [...prev.workers];
        next[index] = { ...next[index], ...patch };
        return { ...prev, workers: next };
      });
    },
    [onPlanChange],
  );

  const removeWorker = useCallback(
    (index: number) => {
      onPlanChange((prev) => ({
        ...prev,
        workers: prev.workers.filter((_, i) => i !== index),
      }));
    },
    [onPlanChange],
  );

  const updateCapacity = useCallback(
    (index: number, value: number) => {
      updateWorker(index, {
        capacityPerDay: clamp(Math.round(value), 0, 24),
      });
    },
    [updateWorker],
  );

  return { addWorker, updateWorker, removeWorker, updateCapacity };
};

export const useResourceActions = (onPlanChange: StateUpdater<PlanUiState>) => {
  const addResource = useCallback(
    (createId: () => string) => {
      onPlanChange((prev) => ({
        ...prev,
        resources: [
          ...prev.resources,
          {
            id: createId(),
            name: "",
            category: undefined,
            capacityPerDay: 24,
            blocked: [],
          },
        ],
      }));
    },
    [onPlanChange],
  );

  const updateResource = useCallback(
    (index: number, patch: Partial<PlanUiResource>) => {
      onPlanChange((prev) => {
        const next = [...prev.resources];
        next[index] = { ...next[index], ...patch };
        return { ...prev, resources: next };
      });
    },
    [onPlanChange],
  );

  const removeResource = useCallback(
    (index: number) => {
      onPlanChange((prev) => ({
        ...prev,
        resources: prev.resources.filter((_, i) => i !== index),
      }));
    },
    [onPlanChange],
  );

  const updateCapacity = useCallback(
    (index: number, value: number | undefined) => {
      updateResource(index, {
        capacityPerDay:
          typeof value === "number"
            ? clamp(Math.round(value), 0, 24)
            : undefined,
      });
    },
    [updateResource],
  );

  return { addResource, updateResource, removeResource, updateCapacity };
};
