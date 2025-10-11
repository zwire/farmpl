import { useEffect, useMemo, useRef, useState } from "react";

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
  startDay: number;
  endDay: number;
}

interface TimelineFetchOptions {
  baseUrl: string;
  apiKey?: string;
  bearerToken?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_FARMPL_API_BASE ?? "";
const API_KEY = process.env.NEXT_PUBLIC_FARMPL_API_KEY ?? "";
const BEARER_TOKEN = process.env.NEXT_PUBLIC_FARMPL_BEARER_TOKEN ?? "";

const DEFAULT_RANGE: [number, number] = [0, 29];

const buildTimelineUrl = (
  options: TimelineFetchOptions,
  params: {
    jobId: string;
    startDay: number;
    endDay: number;
    bucket: MetricsInterval;
    baseDate?: string;
  },
) => {
  const base = options.baseUrl.replace(/\/$/, "");
  const searchParams = new URLSearchParams({
    job_id: params.jobId,
    start_day: String(params.startDay),
    end_day: String(params.endDay),
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

const deriveRange = (
  result: OptimizationResultView | null,
): [number, number] => {
  const timeline = result?.timeline;
  if (!timeline) return DEFAULT_RANGE;

  const values: number[] = [];
  for (const event of timeline.events ?? []) values.push(event.day);
  for (const span of timeline.landSpans ?? []) {
    values.push(span.startDay, span.endDay);
  }
  if (values.length === 0) return DEFAULT_RANGE;
  const min = Math.max(0, Math.min(...values));
  const max = Math.max(...values);
  return [min, max];
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

  const [startDay, endDay] = useMemo(() => deriveRange(result), [result]);
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
          startDay,
          endDay,
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
  }, [
    jobId,
    finished,
    startDay,
    endDay,
    bucket,
    result?.timeline?.startDateIso,
  ]);

  return { timeline, isLoading, error, startDay, endDay };
}
