import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface UseCloseOnInteractOutsideOptions {
  closeOnEscape?: boolean;
}

export const useCloseOnInteractOutside = (
  options: UseCloseOnInteractOutsideOptions = {},
) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery("");
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, close]);

  useEffect(() => {
    if (!isOpen || options.closeOnEscape === false) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, options.closeOnEscape, close]);

  return useMemo(
    () => ({
      containerRef,
      listRef,
      isOpen,
      toggleOpen,
      close,
      query,
      setQuery,
    }),
    [isOpen, toggleOpen, close, query],
  );
};

interface ScrollOptions {
  listRef: React.RefObject<HTMLDivElement | null>;
  isOpen: boolean;
  filtered: { value: string }[];
  value: string;
}

export const useScrollSelectedIntoView = ({
  listRef,
  isOpen,
  filtered,
  value,
}: ScrollOptions) => {
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
  }, [filtered, isOpen, listRef, value]);
};
