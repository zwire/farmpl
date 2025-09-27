import { saveAs } from "file-saver";

import type {
  OptimizationResultView,
  PlanFormState,
} from "@/lib/types/planning";

const MIME_JSON = "application/json;charset=utf-8";
const MIME_CSV = "text/csv;charset=utf-8";

const defaultResultFilename = "farmpl-result";
const defaultPlanFilename = "farmpl-plan-draft";

export interface ExportOptions {
  filename?: string;
}

export const toResultJson = (result: OptimizationResultView | null) => {
  if (!result) return null;
  return JSON.stringify(result, null, 2);
};

export const toPlanJson = (plan: PlanFormState) =>
  JSON.stringify(plan, null, 2);

/**
 * Creates a simple CSV of key metrics extracted from OptimizationResultView.
 * Columns: metric,value
 */
export const toResultCsv = (
  result: OptimizationResultView | null,
): string | null => {
  if (!result) return null;
  const rows: Array<[string, string]> = [];
  rows.push(["status", result.status]);
  if (result.objectiveValue != null) {
    rows.push(["objectiveValue", String(result.objectiveValue)]);
  }
  if (result.stats.stageOrder) {
    rows.push(["stageOrder", result.stats.stageOrder.join(">")]);
  }
  if (result.stats.stages) {
    result.stats.stages.forEach((stage) => {
      rows.push([`stage:${stage.name}`, String(stage.value)]);
    });
  }
  if (result.summary) {
    Object.entries(result.summary).forEach(([key, value]) => {
      if (typeof value === "number") {
        rows.push([`summary:${key}`, String(value)]);
      }
    });
  }
  if (result.warnings && result.warnings.length > 0) {
    rows.push(["warnings", result.warnings.join(" | ")]);
  }

  const csv = [
    "metric,value",
    ...rows.map(([k, v]) => `${escapeCsv(k)},${escapeCsv(v)}`),
  ].join("\n");
  return csv;
};

const escapeCsv = (value: string) => {
  const needsQuotes = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

const triggerDownload = (blob: Blob, filename: string) => {
  if (typeof window === "undefined") {
    return;
  }
  saveAs(blob, filename);
};

export const exportResultJson = (
  result: OptimizationResultView | null,
  options: ExportOptions = {},
) => {
  const json = toResultJson(result);
  if (!json) return;
  const blob = new Blob([json], { type: MIME_JSON });
  triggerDownload(blob, `${options.filename ?? defaultResultFilename}.json`);
};

export const exportResultCsv = (
  result: OptimizationResultView | null,
  options: ExportOptions = {},
) => {
  const csv = toResultCsv(result);
  if (!csv) return;
  const blob = new Blob([csv], { type: MIME_CSV });
  triggerDownload(blob, `${options.filename ?? defaultResultFilename}.csv`);
};

export const exportPlanTemplate = (
  plan: PlanFormState,
  options: ExportOptions = {},
) => {
  const json = toPlanJson(plan);
  const blob = new Blob([json], { type: MIME_JSON });
  triggerDownload(blob, `${options.filename ?? defaultPlanFilename}.json`);
};
