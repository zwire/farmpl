"use client";

import clsx from "clsx";
import { WIZARD_STEPS, type WizardStepId } from "./steps";

interface WizardStepperProps {
  currentStep: WizardStepId;
  onStepSelect?: (step: WizardStepId) => void;
}

export function WizardStepper({
  currentStep,
  onStepSelect,
}: WizardStepperProps) {
  return (
    <nav aria-label="計画ウィザードのステップ" className="flex flex-col gap-2">
      {WIZARD_STEPS.map((step, index) => {
        const isActive = step.id === currentStep;
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepSelect?.(step.id)}
            className={clsx(
              "flex w-full items-start gap-3 rounded-md border px-3 py-2 text-left transition-colors",
              isActive
                ? "border-sky-500 bg-sky-50 dark:border-sky-400 dark:bg-sky-900/30"
                : "border-transparent bg-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-800/40",
              { "opacity-80": !isActive },
            )}
          >
            <span
              aria-hidden
              className={clsx(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                isActive
                  ? "border-sky-500 text-sky-600 dark:border-sky-400 dark:text-sky-300"
                  : "border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400",
              )}
            >
              {index + 1}
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                {step.title}
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {step.description}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
