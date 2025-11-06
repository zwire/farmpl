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
    <nav
      aria-label="計画ウィザードのステップ"
      className="relative flex flex-col gap-3"
    >
      <div
        aria-hidden
        className="absolute left-5 top-2.5 h-[calc(100%-1.75rem)] w-px bg-slate-300"
      />
      {WIZARD_STEPS.map((step, index) => {
        const isActive = step.id === currentStep;
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepSelect?.(step.id)}
            className={clsx(
              "group relative flex w-full items-start gap-4 rounded-lg p-2 text-left transition-colors",
              isActive ? "bg-sky-50" : "hover:bg-slate-200/50",
            )}
          >
            <div
              className={clsx(
                "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                isActive
                  ? "bg-sky-500 text-white"
                  : "border-2 border-slate-300 bg-slate-50 text-slate-500 group-hover:border-slate-400",
              )}
            >
              {isActive ? (
                <svg
                  className="h-5 w-5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <title>ステップが選択されています</title>
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.052-.143z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                index + 1
              )}
            </div>
            <div className="flex flex-col pt-0.5">
              <span
                className={clsx(
                  "text-base font-semibold",
                  isActive ? "text-sky-800" : "text-slate-800",
                )}
              >
                {step.title}
              </span>
              <span className="text-xs text-slate-500">{step.description}</span>
            </div>
          </button>
        );
      })}
    </nav>
  );
}
