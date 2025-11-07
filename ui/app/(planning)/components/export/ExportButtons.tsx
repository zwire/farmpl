"use client";

import { useCallback, useState } from "react";
import { usePlanningStore } from "@/lib/state/planning-store";

export function ExportButtons() {
  const jobId = usePlanningStore((s) => s.lastJobId);
  const result = usePlanningStore((s) => s.lastResult);
  const [downloading, setDownloading] = useState(false);

  const API_BASE_URL = process.env.NEXT_PUBLIC_FARMPL_API_BASE ?? "";
  const API_KEY = process.env.NEXT_PUBLIC_FARMPL_API_KEY ?? "";
  const BEARER_TOKEN = process.env.NEXT_PUBLIC_FARMPL_BEARER_TOKEN ?? "";

  const isSubmitting = usePlanningStore((s) => s.isSubmitting);
  const apiReady = Boolean(API_BASE_URL);
  const canDownload = Boolean(
    apiReady &&
      jobId &&
      result &&
      result.status === "ok" &&
      result.timeline &&
      !isSubmitting,
  );

  const doDownloadCsv = useCallback(async () => {
    if (!canDownload || !API_BASE_URL) return;
    setDownloading(true);
    try {
      const url = `${API_BASE_URL.replace(/\/$/, "")}/v1/exports/summary`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (API_KEY) headers["X-API-Key"] = API_KEY;
      if (BEARER_TOKEN) headers.Authorization = `Bearer ${BEARER_TOKEN}`;
      const body = JSON.stringify({
        format: "zip_csv",
        delivery: "url",
        source: { job_id: jobId },
        assumptions: {},
      });
      const res = await fetch(url, { method: "POST", headers, body });
      if (!res.ok) {
        throw new Error(`エクスポートに失敗しました (${res.status})`);
      }
      const contentType = res.headers.get("Content-Type") ?? "";
      if (contentType.includes("application/json")) {
        const json = (await res.json()) as { url?: string };
        if (!json.url) throw new Error("ダウンロードURLの取得に失敗しました");
        window.location.href = json.url;
      } else {
        // 後方互換: ストリーム返却にも対応
        const blob = await res.blob();
        const file = new File([blob], "plan-summary.zip", {
          type: "application/zip",
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(file);
        link.download = file.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } finally {
      setDownloading(false);
    }
  }, [API_BASE_URL, API_KEY, BEARER_TOKEN, canDownload, jobId]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={doDownloadCsv}
        disabled={!canDownload || downloading}
        className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
        title={
          canDownload
            ? "収支内訳＋ガント詳細（CSV/ZIP）をダウンロード"
            : API_BASE_URL
              ? "結果がOKになりタイムラインが生成されるとダウンロードできます"
              : "APIの接続設定が必要です（NEXT_PUBLIC_FARMPL_API_BASE）"
        }
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="size-5"
        >
          <title>ダウンロード</title>
          <path d="M3 16.5A2.5 2.5 0 0 0 5.5 19h13a2.5 2.5 0 0 0 2.5-2.5V15a1 1 0 1 0-2 0v1.5a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5V15a1 1 0 1 0-2 0v1.5z" />
          <path d="M12 3a1 1 0 0 1 1 1v8.586l2.293-2.293a1 1 0 1 1 1.414 1.414l-4 4a1 1 0 0 1-1.414 0l-4-4A1 1 0 1 1 8.707 10.293L11 12.586V4a1 1 0 0 1 1-1z" />
        </svg>
        {downloading ? "ダウンロード中…" : "CSVをダウンロード"}
      </button>
    </div>
  );
}
