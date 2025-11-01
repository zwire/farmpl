import type { PlanFormState } from "@/lib/types/planning";

export type PlanFormUpdater = (
  updater: (prev: PlanFormState) => PlanFormState,
) => void;

export interface StepSectionBaseProps {
  plan: PlanFormState;
  onPlanChange: PlanFormUpdater;
}

export interface ReadOnlyStepSectionProps {
  plan: PlanFormState;
}
