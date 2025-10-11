import { useCallback, useRef } from "react";

import { getPlanningState, usePlanningStore } from "@/lib/state/planning-store";
import type {
  ApiOptimizationResult,
  JobStatus,
  PlanFormState,
} from "@/lib/types/planning";
import { mapApiResultToView } from "@/lib/types/result-mapper";
import { buildApiPlanPayload } from "@/lib/validation/plan-schema";

interface OptimizationJobParams {
  apiPlan: PlanFormState;
}

interface OptimizationJobResult {
  run: () => Promise<void>;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_FARMPL_API_BASE ?? "";
const API_KEY = process.env.NEXT_PUBLIC_FARMPL_API_KEY ?? "";
const BEARER_TOKEN = process.env.NEXT_PUBLIC_FARMPL_BEARER_TOKEN ?? "";

export function useOptimizationJob({
  apiPlan,
}: OptimizationJobParams): OptimizationJobResult {
  const setIsSubmitting = usePlanningStore((state) => state.setIsSubmitting);
  const setSubmissionError = usePlanningStore(
    (state) => state.setSubmissionError,
  );
  const setJobProgress = usePlanningStore((state) => state.setJobProgress);
  const setJobStatus = usePlanningStore((state) => state.setJobStatus);
  const setLastJobId = usePlanningStore((state) => state.setLastJobId);
  const setLastResult = usePlanningStore((state) => state.setLastResult);

  const abortRef = useRef<AbortController | null>(null);

  const buildHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (API_KEY) headers["X-API-Key"] = API_KEY;
    if (BEARER_TOKEN) headers.Authorization = `Bearer ${BEARER_TOKEN}`;
    return headers;
  }, []);

  const pollJob = useCallback(
    async ({
      base,
      jobId,
      headers,
      controller,
    }: {
      base: string;
      jobId: string;
      headers: Record<string, string>;
      controller: AbortController;
    }) => {
      const jobUrl = `${base}/v1/jobs/${jobId}`;
      let attempts = 0;
      const maxAttempts = 60;

      while (attempts++ < maxAttempts) {
        if (controller.signal.aborted) return;
        if (!getPlanningState().isSubmitting) return;

        const response = await fetch(jobUrl, {
          headers,
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(
            `ジョブ取得に失敗しました (status ${response.status})`,
          );
        }
        const info = (await response.json()) as {
          status: JobStatus;
          progress?: number;
          result?: ApiOptimizationResult | null;
        };

        if (typeof info.progress === "number") setJobProgress(info.progress);
        if (info.status) setJobStatus(info.status);

        if (info.status === "succeeded" && info.result) {
          setJobProgress(1);
          setJobStatus("succeeded");
          setLastResult(mapApiResultToView(info.result));
          return;
        }

        if (["failed", "timeout", "canceled"].includes(info.status)) {
          throw new Error(`ジョブが失敗しました: ${info.status}`);
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      throw new Error(
        "ジョブの完了を確認できませんでした。しばらくしてから再試行してください。",
      );
    },
    [setJobProgress, setJobStatus, setLastResult],
  );

  const run = useCallback(async () => {
    if (!API_BASE_URL) {
      setSubmissionError("NEXT_PUBLIC_FARMPL_API_BASE が設定されていません。");
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const base = API_BASE_URL.replace(/\/$/, "");
    const endpoint = `${base}/v1/optimize/async`;
    const headers = buildHeaders();

    setIsSubmitting(true);
    setSubmissionError(null);
    setJobProgress(0);
    setJobStatus("pending");

    try {
      const body = JSON.stringify({ plan: buildApiPlanPayload(apiPlan) });
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body,
        signal: controller.signal,
      });
      if (!response.ok) {
        let message = `最適化リクエストが失敗しました (status ${response.status}).`;
        try {
          const detail = await response.json();
          if (typeof detail?.detail === "string") message = detail.detail;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      const job = (await response.json()) as { job_id: string };
      setLastJobId(job.job_id);

      await pollJob({ base, jobId: job.job_id, headers, controller });
    } catch (error) {
      if (controller.signal.aborted) return;
      const message =
        error instanceof Error ? error.message : "最適化の実行に失敗しました。";
      setSubmissionError(message);
    } finally {
      if (!controller.signal.aborted) {
        setIsSubmitting(false);
        setJobStatus(null);
        setJobProgress(0);
      }
    }
  }, [
    apiPlan,
    setSubmissionError,
    setIsSubmitting,
    setJobProgress,
    setJobStatus,
    setLastJobId,
    buildHeaders,
    pollJob,
  ]);

  return { run };
}
