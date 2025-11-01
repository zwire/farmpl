"use client";

import type { ConstraintHintView } from "@/lib/types/planning";

interface ConstraintHintsProps {
  hints: ConstraintHintView[] | undefined;
  onNavigate?: (target: string) => void;
}

export function ConstraintHints({ hints, onNavigate }: ConstraintHintsProps) {
  if (!hints || hints.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          制約ヒント
        </h3>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          現在の結果に関連する制約ヒントはありません。
        </p>
      </div>
    );
  }

  const sorted = [...hints].sort((a, b) => a.priority - b.priority);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
        制約ヒント
      </h3>
      <ul className="mt-3 space-y-2 text-xs text-slate-600 dark:text-slate-300">
        {sorted.map((hint) => (
          <li
            key={hint.id}
            className="flex flex-col gap-1 rounded-md border border-slate-200 p-3 dark:border-slate-600"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">優先度 {hint.priority}</span>
              {hint.targetSection && (
                <button
                  type="button"
                  onClick={() =>
                    hint.targetSection && onNavigate?.(hint.targetSection)
                  }
                  className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-600 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  対象へ移動
                </button>
              )}
            </div>
            <p className="leading-relaxed">{hint.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
