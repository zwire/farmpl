"use client";

import { useMemo, useState } from "react";
import { PlanningCalendarService } from "@/lib/domain/planning-calendar";
import {
  exportPlanTemplate,
  exportResultCsv,
  exportResultJson,
  toResultCsv,
  toResultJson,
} from "@/lib/export/export-utils";
import { usePlanningStore } from "@/lib/state/planning-store";

export function ExportPanel() {
  const plan = usePlanningStore((state) => state.plan);
  const result = usePlanningStore((state) => state.lastResult);

  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const preview = useMemo(() => {
    const json = toResultJson(result);
    const csv = toResultCsv(result);
    return {
      jsonSample: json ? json.slice(0, 240) : null,
      csvSample: csv ? csv.split("\n").slice(0, 4).join("\n") : null,
    };
  }, [result]);

  const handleExportJson = () => {
    exportResultJson(result);
    setExportMessage("結果JSONをダウンロードしました。");
  };

  const handleExportCsv = () => {
    exportResultCsv(result);
    setExportMessage("主要メトリクスCSVをダウンロードしました。");
  };

  const handleExportPlan = () => {
    const apiPlan = PlanningCalendarService.convertToApiPlan(plan).plan;
    exportPlanTemplate(apiPlan);
    setExportMessage("現在のプラン入力をJSONとしてエクスポートしました。");
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
          エクスポート
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          結果データや入力テンプレートをダウンロードして共有できます。
        </p>
      </header>
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <button
          type="button"
          onClick={handleExportJson}
          disabled={!result}
          className="rounded-md border border-slate-300 px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          結果JSONをエクスポート
        </button>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={!result}
          className="rounded-md border border-slate-300 px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          メトリクスCSVをエクスポート
        </button>
        <button
          type="button"
          onClick={handleExportPlan}
          className="rounded-md border border-slate-300 px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          入力テンプレートJSONを保存
        </button>
      </div>
      {exportMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-600 dark:border-green-700 dark:bg-green-900/40 dark:text-green-200">
          {exportMessage}
        </div>
      )}
      <footer className="grid gap-3 sm:grid-cols-2">
        <PreviewBlock
          title="JSONプレビュー"
          value={preview.jsonSample}
          placeholder="実行後に結果が表示されます"
        />
        <PreviewBlock
          title="CSVプレビュー"
          value={preview.csvSample}
          placeholder="実行後に結果が表示されます"
        />
      </footer>
    </section>
  );
}

interface PreviewBlockProps {
  title: string;
  value: string | null;
  placeholder: string;
}

const PreviewBlock = ({ title, value, placeholder }: PreviewBlockProps) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
    <p className="font-semibold text-slate-700 dark:text-slate-100">{title}</p>
    <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap text-[11px] font-mono leading-tight">
      {value ?? placeholder}
    </pre>
  </div>
);
