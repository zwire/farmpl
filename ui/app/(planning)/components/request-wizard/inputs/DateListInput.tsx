"use client";

import type { ChangeEvent, KeyboardEvent } from "react";
import { useState } from "react";

interface DateListInputProps {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function DateListInput({
  value,
  onChange,
  placeholder,
}: DateListInputProps) {
  const [draft, setDraft] = useState("");

  const addDate = (input: string) => {
    if (!ISO_DATE_PATTERN.test(input)) return;
    if (value.includes(input)) {
      setDraft("");
      return;
    }
    onChange([...value, input].sort());
    setDraft("");
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value);
  };

  const handleBlur = () => {
    if (draft) addDate(draft);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (draft) addDate(draft);
    }
  };

  const removeDate = (date: string) => {
    onChange(value.filter((item) => item !== date));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {value.map((date) => (
          <span
            key={date}
            className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700"
          >
            {date}
            <button
              type="button"
              onClick={() => removeDate(date)}
              className="text-slate-400 transition hover:text-slate-700"
              aria-label={`${date} を削除`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="date"
        value={draft}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </div>
  );
}
