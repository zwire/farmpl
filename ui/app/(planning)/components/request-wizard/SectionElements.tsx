"use client";

import type { ReactNode } from "react";

import type { AreaMeasurement } from "@/lib/types/planning";
import { roundTo1Decimal } from "./utils/number";

interface SectionCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  emptyMessage?: string;
  hasItems?: boolean;
}

export function SectionCard({
  title,
  description,
  children,
  actionLabel,
  onAction,
  emptyMessage,
  hasItems,
}: SectionCardProps) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex shrink-0 items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {actionLabel}
          </button>
        )}
      </div>
      {hasItems === false ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/20 dark:text-slate-400">
          {emptyMessage}
        </div>
      ) : (
        <div className="flex flex-col gap-4">{children}</div>
      )}
    </section>
  );
}

interface EntityCardProps {
  title: string;
  id: string;
  children: ReactNode;
  onRemove: () => void;
}

export function EntityCard({ title, id, children, onRemove }: EntityCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white/80 p-4 backdrop-blur-sm transition-shadow hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {title}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            ID: {id}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md px-2 py-1 text-xs text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-500"
        >
          削除
        </button>
      </div>
      <div className="mt-4 flex flex-col gap-4 border-t border-slate-200/80 pt-4 dark:border-slate-800">
        {children}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  children: ReactNode;
}

export function Field({ label, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1 text-xs font-medium text-slate-600">
      <span>{label}</span>
      {children}
    </div>
  );
}

interface MeasurementInputProps {
  measurement?: AreaMeasurement;
  onChange: (unit: AreaMeasurement["unit"], value: number) => void;
}

export function MeasurementInput({
  measurement,
  onChange,
}: MeasurementInputProps) {
  const unit = measurement?.unit ?? "a";
  const value = measurement?.value ?? 0;
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        max={10000}
        value={value}
        onChange={(event) =>
          onChange(unit, roundTo1Decimal(Number(event.target.value || "0")))
        }
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <select
        value={unit}
        onChange={(event) =>
          onChange(
            event.target.value as AreaMeasurement["unit"],
            roundTo1Decimal(value),
          )
        }
        className="rounded-md border border-slate-300 px-2 py-2 text-sm"
      >
        <option value="a">a</option>
        <option value="10a">10a</option>
      </select>
    </div>
  );
}
