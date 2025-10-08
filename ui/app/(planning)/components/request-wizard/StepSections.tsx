"use client";

import type { WizardStepId } from "@/lib/state/wizard-steps";
import type { PlanFormState } from "@/lib/types/planning";

import {
  ConstraintsStepSection,
  CropsStepSection,
  type PlanFormUpdater,
} from "./step-sections";

interface StepSectionsProps {
  plan: PlanFormState;
  step: WizardStepId;
  errors: string[];
  onPlanChange: PlanFormUpdater;
}

export function StepSections({
  plan,
  step,
  errors,
  onPlanChange,
}: StepSectionsProps) {
  const renderSection = () => {
    switch (step) {
      case "crops":
        return <CropsStepSection plan={plan} onPlanChange={onPlanChange} />;
      case "constraints":
        return (
          <ConstraintsStepSection plan={plan} onPlanChange={onPlanChange} />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {errors.length > 0 && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          <p className="font-semibold">入力エラー</p>
          <ul className="ml-4 list-disc">
            {errors.map((error, index) => (
              <li key={index.toString()}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {renderSection()}
    </div>
  );
}
