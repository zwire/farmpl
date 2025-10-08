"use client";

import { useEffect, useMemo, useState } from "react";
import type { ZodIssue } from "zod";
import { PlanningCalendarService } from "@/lib/domain/planning-calendar";
import {
  getPlanningState,
  planningDraftStorage,
  usePlanningStore,
} from "@/lib/state/planning-store";
import type {
  ApiOptimizationResult,
  JobStatus,
  PlanFormState,
} from "@/lib/types/planning";
import { mapApiResultToView } from "@/lib/types/result-mapper";
import { buildApiPlanPayload } from "@/lib/validation/plan-schema";
import { EventPlanningSection } from "../events/EventPlanningSection";
import { StepSections } from "./StepSections";
import { AvailabilitySection } from "./step-sections/AvailabilitySection";
import { HorizonSection } from "./step-sections/HorizonSection";
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
  const setLastJobId = usePlanningStore((state) => state.setLastJobId);
  const setJobProgress = usePlanningStore((state) => state.setJobProgress);
  const setJobStatus = usePlanningStore((state) => state.setJobStatus);

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
    setJobProgress(0);
    setJobStatus("pending");

    try {
      // Use async optimize to obtain job_id, then poll and set result.
      const base = API_BASE_URL.replace(/\/$/, "");
      const endpoint = `${base}/v1/optimize/async`;
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
      const job = (await response.json()) as { job_id: string };
      setLastJobId(job.job_id);

      // poll job endpoint until succeeded/failed
      const jobUrl = `${base}/v1/jobs/${job.job_id}`;
      const pollHeaders = headers;
      let attempts = 0;
      const maxAttempts = 60; // ~60 * 2000ms = 120s
      while (attempts++ < maxAttempts) {
        // Allow cooperative cancel from UI
        if (!getPlanningState().isSubmitting) break;
        const jr = await fetch(jobUrl, { headers: pollHeaders });
        if (!jr.ok)
          throw new Error(`ジョブ取得に失敗しました (status ${jr.status})`);
        const info = (await jr.json()) as {
          status: string;
          progress?: number;
          result?: unknown | null;
        };
        if (typeof info.progress === "number") setJobProgress(info.progress);
        if (typeof info.status === "string")
          setJobStatus(info.status as JobStatus);
        if (info.status === "succeeded" && info.result) {
          setJobProgress(1);
          setJobStatus("succeeded");
          setLastResult(
            mapApiResultToView(info.result as ApiOptimizationResult),
          );
          break;
        }
        if (
          info.status === "failed" ||
          info.status === "timeout" ||
          info.status === "canceled"
        ) {
          setJobStatus(info.status as JobStatus);
          throw new Error(`ジョブが失敗しました: ${info.status}`);
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "最適化の実行に失敗しました。";
      setSubmissionError(message);
    } finally {
      setIsSubmitting(false);
      setJobStatus(null);
      setJobProgress(0);
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

function collectStepErrors(issues: ZodIssue[], step: WizardStepId): string[] {
  const relevantPaths: Record<WizardStepId, string[]> = {
    horizon: ["horizon"],
    crops: ["crops"],
    events: ["events"],
    lands: ["lands"],
    workers: ["workers"],
    resources: ["resources"],
    constraints: ["cropAreaBounds", "fixedAreas", "stages"],
  };

  const keys = new Set(relevantPaths[step]);

  return issues
    .filter((issue) => {
      const pathRoot = issue.path[0];
      return typeof pathRoot === "string" && keys.has(pathRoot);
    })
    .map((issue) => issue.message);
}
