"use client";

import type { KeyboardEvent } from "react";
import { useState } from "react";

interface ChipInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
}

export function ChipInput({
  value,
  onChange,
  placeholder,
  emptyMessage,
}: ChipInputProps) {
  const [inputValue, setInputValue] = useState("");

  const addChip = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) {
      setInputValue("");
      return;
    }
    onChange([...value, trimmed]);
    setInputValue("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addChip(inputValue);
    } else if (event.key === "Backspace" && inputValue === "") {
      onChange(value.slice(0, -1));
    }
  };

  const handleBlur = () => {
    addChip(inputValue);
  };

  const handleRemove = (chip: string) => {
    onChange(value.filter((item) => item !== chip));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 rounded-md border border-slate-300 px-2 py-2">
        {value.length === 0 && (
          <span className="text-xs text-slate-400">{emptyMessage}</span>
        )}
        {value.map((chip) => (
          <span
            key={chip}
            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700"
          >
            {chip}
            <button
              type="button"
              onClick={() => handleRemove(chip)}
              className="text-slate-400 transition hover:text-slate-700"
              aria-label={`${chip} を削除`}
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="flex-1 min-w-[120px] border-none bg-transparent text-sm outline-none"
        />
      </div>
    </div>
  );
}
