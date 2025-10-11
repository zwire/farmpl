import { useMemo } from "react";
import type { ZodIssue } from "zod";

import type { WizardStepId } from "./steps";

interface WizardWarning {
  path: (string | number)[];
  message: string;
}

interface UseValidationSummaryInput {
  issues: ZodIssue[];
  currentStep: WizardStepId;
  warnings: WizardWarning[];
}

interface UseValidationSummaryOutput {
  validationMessages: string[];
  stepErrors: string[];
  hasValidationErrors: boolean;
  horizonWarnings: string[];
}

const STEP_PATHS: Record<WizardStepId, string[]> = {
  horizon: ["horizon"],
  crops: ["crops"],
  events: ["events"],
  lands: ["lands"],
  workers: ["workers"],
  resources: ["resources"],
  constraints: ["cropAreaBounds", "fixedAreas", "stages"],
};

export function useValidationSummary({
  issues,
  currentStep,
  warnings,
}: UseValidationSummaryInput): UseValidationSummaryOutput {
  const validationMessages = useMemo(() => {
    const unique = new Set<string>();
    issues.forEach((issue) => {
      if (issue.message) unique.add(issue.message);
    });
    return Array.from(unique);
  }, [issues]);

  const stepErrors = useMemo(() => {
    const paths = new Set(STEP_PATHS[currentStep] ?? []);
    return issues
      .filter((issue) => {
        const root = issue.path[0];
        return typeof root === "string" && paths.has(root);
      })
      .map((issue) => issue.message);
  }, [issues, currentStep]);

  const horizonWarnings = useMemo(
    () =>
      warnings
        .filter((warning) => warning.path[0] === "horizon")
        .map((warning) => warning.message),
    [warnings],
  );

  return {
    validationMessages,
    stepErrors,
    hasValidationErrors: validationMessages.length > 0,
    horizonWarnings,
  };
}
