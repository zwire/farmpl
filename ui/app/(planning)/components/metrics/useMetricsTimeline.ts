import { useEffect, useRef, useState } from "react";

import type {
  MetricsInterval,
  MetricsTimelineResponse,
  OptimizationResultView,
} from "@/lib/types/planning";
import { mapTimelineResponse } from "@/lib/types/result-mapper";

export interface UseMetricsTimelineInput {
  jobId?: string;
  result: OptimizationResultView | null;
  bucket: MetricsInterval;
}

export interface UseMetricsTimelineOutput {
  timeline: MetricsTimelineResponse | null;
  isLoading: boolean;
  error: string | null;
}

interface TimelineFetchOptions {
  baseUrl: string;
  apiKey?: string;
  bearerToken?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_FARMPL_API_BASE ?? "";
const API_KEY = process.env.NEXT_PUBLIC_FARMPL_API_KEY ?? "";
const BEARER_TOKEN = process.env.NEXT_PUBLIC_FARMPL_BEARER_TOKEN ?? "";

const buildTimelineUrl = (
  options: TimelineFetchOptions,
  params: {
    jobId: string;
    bucket: MetricsInterval;
    baseDate?: string;
  },
) => {
  const base = options.baseUrl.replace(/\/$/, "");
  const searchParams = new URLSearchParams({
    job_id: params.jobId,
    bucket: params.bucket,
  });
  if (params.baseDate) {
    searchParams.set("base_date", params.baseDate);
  }
  return `${base}/v1/metrics/timeline?${searchParams.toString()}`;
};

const buildHeaders = (options: TimelineFetchOptions) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.apiKey) headers["X-API-Key"] = options.apiKey;
  if (options.bearerToken)
    headers.Authorization = `Bearer ${options.bearerToken}`;
  return headers;
};

export function useMetricsTimeline({
  jobId,
  result,
  bucket,
}: UseMetricsTimelineInput): UseMetricsTimelineOutput {
  const [timeline, setTimeline] = useState<MetricsTimelineResponse | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const finished = result?.status === "ok";

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    if (!jobId || !finished || !API_BASE_URL) {
      setTimeline(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const fetchOptions: TimelineFetchOptions = {
      baseUrl: API_BASE_URL,
      apiKey: API_KEY,
      bearerToken: BEARER_TOKEN,
    };

    const baseDate =
      bucket === "third"
        ? result?.timeline?.startDateIso?.split("T")[0]
        : undefined;

    const run = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const url = buildTimelineUrl(fetchOptions, {
          jobId,
          bucket,
          baseDate,
        });
        const response = await fetch(url, {
          headers: buildHeaders(fetchOptions),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(
            `タイムライン取得に失敗しました (status ${response.status})`,
          );
        }
        const json = await response.json();
        if (!controller.signal.aborted) {
          setTimeline(mapTimelineResponse(json));
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        const message =
          err instanceof Error
            ? err.message
            : "タイムラインの取得中に不明なエラーが発生しました";
        setError(message);
        setTimeline(null);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };

    run();

    return () => {
      controller.abort();
    };
  }, [jobId, finished, bucket, result?.timeline?.startDateIso]);

  return { timeline, isLoading, error };
}
