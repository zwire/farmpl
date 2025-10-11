"use client";

import { useMemo } from "react";
import type { ZodIssue } from "zod";
import { PlanningCalendarService } from "@/lib/domain/planning-calendar";
import {
  planningDraftStorage,
  usePlanningStore,
} from "@/lib/state/planning-store";
import type { PlanFormState } from "@/lib/types/planning";
import { EventPlanningSection } from "../events/EventPlanningSection";
import { StepSections } from "./StepSections";
import { AvailabilitySection } from "./step-sections/AvailabilitySection";
import { HorizonSection } from "./step-sections/HorizonSection";
import { WIZARD_STEPS, type WizardStepId } from "./steps";
import { useDraftPersistence } from "./useDraftPersistence";
import { useOptimizationJob } from "./useOptimizationJob";
import { useValidationSummary } from "./useValidationSummary";
import { WizardStepper } from "./WizardStepper";

export function RequestWizard() {
  const plan = usePlanningStore((state) => state.plan);
  const currentStep = usePlanningStore((state) => state.currentStep);
  const isDirty = usePlanningStore((state) => state.isDirty);
  const lastSavedAt = usePlanningStore((state) => state.lastSavedAt);
  const isSubmitting = usePlanningStore((state) => state.isSubmitting);
  const submissionError = usePlanningStore((state) => state.submissionError);

  const updatePlan = usePlanningStore((state) => state.updatePlan);
  const setCurrentStep = usePlanningStore((state) => state.setCurrentStep);
  const resetStore = usePlanningStore((state) => state.reset);
  const markDirty = usePlanningStore((state) => state.markDirty);
  const setLastSavedAt = usePlanningStore((state) => state.setLastSavedAt);
  const replacePlan = usePlanningStore((state) => state.replacePlan);
  const setSubmissionError = usePlanningStore(
    (state) => state.setSubmissionError,
  );

  const { saveMessage, setSaveMessage } = useDraftPersistence({
    replacePlan,
    setLastSavedAt,
    markDirty,
  });

  const conversion = useMemo(
    () => PlanningCalendarService.convertToApiPlan(plan),
    [plan],
  );
  const apiPlan = conversion.plan;

  const warningIssues = useMemo<ZodIssue[]>(
    () =>
      conversion.warnings
        .filter(
          (warning) =>
            warning.type === "INVALID_DATE" || warning.type === "RANGE_EMPTY",
        )
        .map((warning) => ({
          code: "custom" as const,
          message: warning.message,
          path: warning.path,
        })),
    [conversion.warnings],
  );

  const combinedIssues = useMemo(
    () => [...conversion.issues, ...warningIssues],
    [conversion.issues, warningIssues],
  );

  const {
    validationMessages,
    stepErrors,
    hasValidationErrors,
    horizonWarnings,
  } = useValidationSummary({
    issues: combinedIssues,
    currentStep,
    warnings: conversion.warnings,
  });

  const handleStepSelect = (step: WizardStepId) => setCurrentStep(step);

  const applyPlanFormUpdate = (
    updater: (prev: PlanFormState) => PlanFormState,
  ) => {
    updatePlan((prev) => {
      const { plan: previousApiPlan } =
        PlanningCalendarService.convertToApiPlan(prev);
      const nextApiPlan = updater(previousApiPlan);
      return PlanningCalendarService.mergeApiPlanIntoUiPlan(prev, nextApiPlan);
    });
  };

  const handleReset = () => {
    resetStore();
    planningDraftStorage.clear();
    setSaveMessage("ドラフトをリセットしました");
  };

  const handleSaveDraft = () => {
    const savedAt = new Date().toISOString();
    planningDraftStorage.save({ version: "v1", plan, savedAt });
    setLastSavedAt(savedAt);
    markDirty(false);
    setSaveMessage("ドラフトを保存しました");
  };

  const { run } = useOptimizationJob({ apiPlan });

  const handleRun = async () => {
    if (hasValidationErrors) {
      setSubmissionError(
        validationMessages[0] ??
          "入力内容に不備があります。日付や関連項目を確認してください。",
      );
      return;
    }

    await run();
  };

  const stepContent = (() => {
    if (currentStep === "horizon") {
      return (
        <HorizonSection
          plan={plan}
          onPlanChange={updatePlan}
          validationErrors={stepErrors}
          warnings={horizonWarnings}
        />
      );
    }
    if (
      currentStep === "lands" ||
      currentStep === "workers" ||
      currentStep === "resources"
    ) {
      return (
        <AvailabilitySection
          step={currentStep}
          plan={plan}
          onPlanChange={updatePlan}
        />
      );
    }
    if (currentStep === "events") {
      return <EventPlanningSection plan={plan} onPlanChange={updatePlan} />;
    }
    return (
      <StepSections
        plan={apiPlan}
        step={currentStep}
        onPlanChange={applyPlanFormUpdate}
        errors={stepErrors}
      />
    );
  })();

  return (
    <section className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-10">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <WizardStepper
          currentStep={currentStep}
          onStepSelect={handleStepSelect}
        />
      </div>
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
              計画の作成
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              ステップに沿って計画の詳細を入力してください。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span>
              現在のステップ:{" "}
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {WIZARD_STEPS.find((s) => s.id === currentStep)?.title}
              </span>
            </span>
            {lastSavedAt && (
              <span>最終保存: {new Date(lastSavedAt).toLocaleString()}</span>
            )}
            {isDirty && (
              <span className="font-semibold text-amber-600 dark:text-amber-500">
                未保存の変更があります
              </span>
            )}
            {saveMessage && (
              <span className="font-semibold text-green-600 dark:text-green-500">
                {saveMessage}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="inline-flex items-center rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-slate-300"
            >
              ドラフトを保存
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              入力をリセット
            </button>
          </div>
        </header>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          {stepContent}
        </div>
        <footer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {submissionError && (
            <p className="text-sm text-red-600 dark:text-red-500">
              <span className="font-semibold">エラー:</span> {submissionError}
            </p>
          )}
          <button
            type="button"
            onClick={handleRun}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-500 dark:hover:bg-sky-600"
          >
            {isSubmitting ? "最適化を実行中…" : "最適化を実行"}
          </button>
        </footer>
        {validationMessages.length > 0 && !submissionError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
            <p className="mb-2 font-semibold">
              {validationMessages.length}件の入力エラーがあります
            </p>
            <ul className="ml-4 list-disc space-y-1 text-xs">
              {validationMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
