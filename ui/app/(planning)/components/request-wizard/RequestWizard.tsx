"use client";

import { useEffect, useMemo, useState } from "react";
import type { ZodIssue } from "zod";
import { PlanningCalendarService } from "@/lib/domain/planning-calendar";
import {
  planningDraftStorage,
  usePlanningStore,
} from "@/lib/state/planning-store";
import type { PlanFormState } from "@/lib/types/planning";
import { mapApiResultToView } from "@/lib/types/result-mapper";
import { buildApiPlanPayload } from "@/lib/validation/plan-schema";
import { EventPlanningSection } from "../events/EventPlanningSection";
import { AvailabilitySection } from "./AvailabilitySection";
import { HorizonSection } from "./HorizonSection";
import { StepSections } from "./StepSections";
import { WIZARD_STEPS, type WizardStepId } from "./steps";
import { WizardStepper } from "./WizardStepper";

const API_BASE_URL = process.env.NEXT_PUBLIC_FARMPL_API_BASE ?? "";
const API_KEY = process.env.NEXT_PUBLIC_FARMPL_API_KEY ?? "";
const BEARER_TOKEN = process.env.NEXT_PUBLIC_FARMPL_BEARER_TOKEN ?? "";

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
  const setLastSavedAt = usePlanningStore((state) => state.setLastSavedAt);
  const markDirty = usePlanningStore((state) => state.markDirty);
  const replacePlan = usePlanningStore((state) => state.replacePlan);
  const setIsSubmitting = usePlanningStore((state) => state.setIsSubmitting);
  const setSubmissionError = usePlanningStore(
    (state) => state.setSubmissionError,
  );
  const setLastResult = usePlanningStore((state) => state.setLastResult);

  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const draft = planningDraftStorage.load();
    if (!draft) return;
    replacePlan(draft.plan);
    setLastSavedAt(draft.savedAt);
    markDirty(false);
  }, [markDirty, replacePlan, setLastSavedAt]);

  useEffect(() => {
    if (!saveMessage) return;
    const timer = setTimeout(() => setSaveMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [saveMessage]);

  const conversion = useMemo(
    () => PlanningCalendarService.convertToApiPlan(plan),
    [plan],
  );
  const apiPlan = conversion.plan;

  const blockingWarnings = useMemo(
    () =>
      conversion.warnings.filter(
        (warning) =>
          warning.type === "INVALID_DATE" || warning.type === "RANGE_EMPTY",
      ),
    [conversion.warnings],
  );

  const warningIssues = useMemo<ZodIssue[]>(
    () =>
      blockingWarnings.map(
        (warning): ZodIssue => ({
          code: "custom",
          message: warning.message,
          path: warning.path,
        }),
      ),
    [blockingWarnings],
  );

  const combinedIssues = useMemo<ZodIssue[]>(
    () => [...conversion.issues, ...warningIssues],
    [conversion.issues, warningIssues],
  );

  const hasValidationErrors = combinedIssues.length > 0;

  const validationMessages = useMemo(() => {
    if (combinedIssues.length === 0) return [] as string[];
    const unique = new Set<string>();
    combinedIssues.forEach((issue) => {
      if (issue.message) {
        unique.add(issue.message);
      }
    });
    return Array.from(unique);
  }, [combinedIssues]);

  const handleStepSelect = (step: WizardStepId) => {
    setCurrentStep(step);
  };

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
    planningDraftStorage.save({
      version: "ui-v1",
      plan,
      savedAt,
    });
    setLastSavedAt(savedAt);
    markDirty(false);
    setSaveMessage("ドラフトを保存しました");
  };

  const handleRun = async () => {
    if (hasValidationErrors) {
      const summary =
        validationMessages[0] ??
        "入力内容に不備があります。日付や関連項目を確認してください。";
      setSubmissionError(summary);
      return;
    }
    if (!API_BASE_URL) {
      setSubmissionError("NEXT_PUBLIC_FARMPL_API_BASE が設定されていません。");
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      const endpoint = `${API_BASE_URL.replace(/\/$/, "")}/v1/optimize`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (API_KEY) {
        headers["X-API-Key"] = API_KEY;
      }
      if (BEARER_TOKEN) {
        headers.Authorization = `Bearer ${BEARER_TOKEN}`;
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ plan: buildApiPlanPayload(apiPlan) }),
      });
      if (!response.ok) {
        let message = `最適化リクエストが失敗しました (status ${response.status}).`;
        try {
          const body = await response.json();
          if (typeof body?.detail === "string") {
            message = body.detail;
          }
        } catch (_error) {
          // ignore JSON parse errors
        }
        throw new Error(message);
      }
      const result = await response.json();
      setLastResult(mapApiResultToView(result));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "最適化の実行に失敗しました。";
      setSubmissionError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const horizonWarningMessages = useMemo(
    () =>
      conversion.warnings
        .filter((warning) => warning.path[0] === "horizon")
        .map((warning) => warning.message),
    [conversion.warnings],
  );

  const stepErrors = useMemo(() => {
    if (!combinedIssues.length) return [];
    return collectStepErrors(combinedIssues, currentStep);
  }, [combinedIssues, currentStep]);

  const stepContent = (() => {
    if (currentStep === "horizon") {
      return (
        <HorizonSection
          plan={plan}
          onPlanChange={updatePlan}
          validationErrors={stepErrors}
          warnings={horizonWarningMessages}
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
        <header className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold text-slate-900">
            プランニングリクエスト
          </h2>
          <p className="text-sm text-slate-600">
            各ステップで入力を完了し、プランを構築してください。
          </p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>
              現在のステップ:{" "}
              {WIZARD_STEPS.find((s) => s.id === currentStep)?.title}
            </span>
            {lastSavedAt && (
              <span>最終保存: {new Date(lastSavedAt).toLocaleString()}</span>
            )}
            {isDirty && (
              <span className="text-amber-600">未保存の変更があります</span>
            )}
            {saveMessage && (
              <span className="text-green-600">{saveMessage}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="inline-flex items-center rounded-md border border-sky-600 px-3 py-1.5 text-xs font-medium text-sky-600 transition hover:bg-sky-50"
            >
              ドラフトを保存
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
            >
              入力をリセット
            </button>
          </div>
        </header>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {stepContent}
        </div>
        <footer className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={handleRun}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "最適化を実行中…" : "最適化を実行"}
          </button>
        </footer>
        {(submissionError || validationMessages.length > 0) && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
            {submissionError && (
              <p className="font-medium">{submissionError}</p>
            )}
            {validationMessages.length > 0 && (
              <ul className="ml-4 list-disc space-y-1">
                {validationMessages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function collectStepErrors(issues: ZodIssue[], step: WizardStepId): string[] {
  const relevantPaths: Record<WizardStepId, string[]> = {
    horizon: ["horizon"],
    crops: ["crops"],
    events: ["events"],
    lands: ["lands"],
    workers: ["workers"],
    resources: ["resources"],
    constraints: ["cropAreaBounds", "fixedAreas", "preferences", "stages"],
  };

  const keys = new Set(relevantPaths[step]);

  return issues
    .filter((issue) => {
      const pathRoot = issue.path[0];
      return typeof pathRoot === "string" && keys.has(pathRoot);
    })
    .map((issue) => issue.message);
}
