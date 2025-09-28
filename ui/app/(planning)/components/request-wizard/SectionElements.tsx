"use client";

import type { ReactNode } from "react";

import type { AreaMeasurement } from "@/lib/types/planning";

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
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {description && (
            <p className="text-xs text-slate-500">{description}</p>
          )}
        </div>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
          >
            {actionLabel}
          </button>
        )}
      </div>
      {hasItems === false ? (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-700">{title}</span>
          <span className="text-xs text-slate-400">{id}</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-red-500 transition hover:underline"
        >
          削除
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
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
      <select
        value={unit}
        onChange={(event) =>
          onChange(event.target.value as AreaMeasurement["unit"], value)
        }
        className="rounded-md border border-slate-300 px-2 py-2 text-sm"
      >
        <option value="a">a</option>
        <option value="10a">10a</option>
      </select>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(unit, Number(event.target.value || "0"))}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
