"use client";

import clsx from "clsx";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface ComboBoxOption {
  value: string;
  label: string;
  description?: string;
}

interface BaseProps {
  options: ComboBoxOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export interface ComboBoxProps extends BaseProps {
  value: string;
  onChange: (value: string) => void;
  allowClear?: boolean;
}

export function ComboBox({
  value,
  onChange,
  options,
  placeholder = "選択してください",
  disabled,
  className,
  allowClear = false,
}: ComboBoxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const lower = query.trim().toLowerCase();
    return options.filter((option) => {
      return (
        option.label.toLowerCase().includes(lower) ||
        option.value.toLowerCase().includes(lower)
      );
    });
  }, [options, query]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const list = listRef.current;
    if (!list) return;
    const index = filtered.findIndex((option) => option.value === value);
    if (index >= 0) {
      const optionEl = list.querySelector<HTMLElement>(
        `[data-option-index="${index}"]`,
      );
      optionEl?.scrollIntoView({ block: "nearest" });
    }
  }, [filtered, isOpen, value]);

  const handleSelect = useCallback(
    (next: ComboBoxOption) => {
      setIsOpen(false);
      if (next.value === value) return;
      onChange(next.value);
    },
    [onChange, value],
  );

  const handleClear = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onChange("");
  };

  const displayLabel = selectedOption?.label ?? placeholder;
  const showPlaceholder = !selectedOption;

  return (
    <div ref={containerRef} className={clsx("relative w-full", className)}>
      <div className="flex w-full items-center gap-1">
        <div className="relative flex-1">
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setIsOpen((prev) => !prev)}
            className={clsx(
              "flex w-full items-center justify-between rounded-md border px-3 py-2 pr-8 text-sm transition",
              disabled
                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
            )}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            <span className={clsx("block truncate text-left", showPlaceholder && "text-slate-400")}>
              {displayLabel}
            </span>
          </button>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            ▼
          </span>
        </div>
        {allowClear && selectedOption && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100"
          >
            クリア
          </button>
        )}
      </div>
      {isOpen && !disabled && (
        <div
          ref={listRef}
          className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          <div className="p-2">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="検索"
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm focus:border-sky-400 focus:outline-none"
            />
          </div>
          <div className="max-h-52 overflow-auto">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-slate-400">
                一致する候補がありません
              </p>
            ) : (
              filtered.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  data-option-index={index}
                  className={clsx(
                    "flex w-full flex-col items-start gap-1 px-3 py-2 text-left text-sm", 
                    option.value === value
                      ? "bg-sky-50 text-sky-700"
                      : "hover:bg-slate-100",
                  )}
                  onClick={() => handleSelect(option)}
                >
                  <span className="font-medium">{option.label}</span>
                  <span className="text-xs text-slate-500">{option.value}</span>
                  {option.description && (
                    <span className="text-xs text-slate-400">
                      {option.description}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export interface MultiComboBoxProps extends BaseProps {
  value: string[];
  onChange: (next: string[]) => void;
  maxHeight?: number;
}

export function MultiComboBox({
  value,
  onChange,
  options,
  placeholder = "選択してください",
  disabled,
  className,
  maxHeight = 52 * 3,
}: MultiComboBoxProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const lower = query.trim().toLowerCase();
    return options.filter((option) => {
      return (
        option.label.toLowerCase().includes(lower) ||
        option.value.toLowerCase().includes(lower)
      );
    });
  }, [options, query]);

  const toggleValue = useCallback(
    (target: string) => {
      onChange(
        value.includes(target)
          ? value.filter((item) => item !== target)
          : [...value, target],
      );
    },
    [onChange, value],
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  const selectedLabels = useMemo(() => {
    if (value.length === 0) return placeholder;
    const labels = value
      .map((selected) => options.find((option) => option.value === selected)?.label)
      .filter((label): label is string => Boolean(label));
    if (labels.length === 0) return placeholder;
    if (labels.length <= 2) return labels.join(", ");
    return `${labels.slice(0, 2).join(", ")} 他${labels.length - 2}`;
  }, [options, placeholder, value]);

  const showPlaceholder = value.length === 0;

  const clearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  return (
    <div ref={containerRef} className={clsx("relative w-full", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={clsx(
          "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition",
          disabled
            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={clsx("truncate text-left", showPlaceholder && "text-slate-400")}>{selectedLabels}</span>
        <div className="flex items-center gap-2">
          {value.length > 0 && !disabled && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                clearAll();
              }}
              className="rounded border border-transparent px-1 text-xs text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
            >
              クリア
            </button>
          )}
          <span className="text-xs text-slate-400">▼</span>
        </div>
      </button>
      {isOpen && !disabled && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="検索"
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm focus:border-sky-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-100"
            >
              閉じる
            </button>
          </div>
          <div
            className="overflow-auto px-2 py-2"
            style={{ maxHeight }}
          >
            {filtered.length === 0 ? (
              <p className="px-1 py-3 text-center text-xs text-slate-400">
                一致する候補がありません
              </p>
            ) : (
              filtered.map((option) => {
                const isChecked = value.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className={clsx(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm transition",
                      isChecked ? "bg-sky-50 text-sky-700" : "hover:bg-slate-100",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleValue(option.value)}
                      className="h-4 w-4"
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                      <span className="text-xs text-slate-500">{option.value}</span>
                      {option.description && (
                        <span className="text-xs text-slate-400">
                          {option.description}
                        </span>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
