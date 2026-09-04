"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";

export interface ComboboxOption {
  id: string;
  name: string;
  /** Shown after the name, e.g. a paused status. */
  note?: string;
  /** Sorts below active options and renders dimmed. */
  deemphasised?: boolean;
}

/**
 * A searchable single-select.
 *
 * A native select is unusable past a couple of dozen options — an ad account
 * can hold eighty campaigns, and the one you want is somewhere in the middle.
 * Typing filters in place, so finding an item is one gesture rather than
 * scrolling a list you cannot search.
 */
export function Combobox({
  label,
  value,
  options,
  placeholder = "Choose…",
  /** Seeded into the search on first open — usually the client's own name. */
  suggestedQuery,
  hint,
  error,
  disabled,
  loading,
  emptyMessage = "Nothing matches",
  onChange,
}: {
  label: string;
  value: string;
  options: ComboboxOption[];
  placeholder?: string;
  suggestedQuery?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [seeded, setSeeded] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? options.filter((o) => o.name.toLowerCase().includes(q))
      : options;
    // Active first; a paused campaign is rarely the target.
    return [...matches].sort((a, b) => Number(a.deemphasised) - Number(b.deemphasised));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function openList() {
    if (disabled) return;
    // Seed the search with the client's own name the first time, so a list of
    // eighty opens already narrowed to the handful that could be right.
    if (!seeded && suggestedQuery && !value) {
      const q = suggestedQuery.trim();
      if (options.some((o) => o.name.toLowerCase().includes(q.toLowerCase()))) {
        setQuery(q);
      }
      setSeeded(true);
    }
    setOpen(true);
    setActive(0);
    requestAnimationFrame(() => input.current?.select());
  }

  function choose(option: ComboboxOption) {
    onChange(option.id);
    setOpen(false);
    setQuery("");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) return openList();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const option = filtered[active];
      if (option) choose(option);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapper} className="relative flex flex-col">
      <span className="mb-1.5 text-[12px] font-[550] text-text-secondary">{label}</span>

      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-[34px] items-center justify-between gap-2 rounded-md border bg-surface px-2.5 text-left text-[13px] outline-none",
          "disabled:border-border disabled:bg-background disabled:text-text-tertiary",
          error
            ? "border-danger focus-visible:focus-ring-danger"
            : "border-border-strong focus-visible:border-accent focus-visible:focus-ring",
        )}
      >
        <span className={cn("truncate", !selected && "text-text-tertiary")}>
          {loading ? "Loading…" : (selected?.name ?? placeholder)}
        </span>
        <span aria-hidden className="shrink-0 text-text-tertiary">▾</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-overlay)]">
          <div className="border-b border-border p-1.5">
            <input
              ref={input}
              value={query}
              autoFocus
              placeholder="Type to filter…"
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="h-7 w-full rounded-sm bg-transparent px-1.5 text-[13px] outline-none placeholder:text-text-tertiary"
            />
          </div>

          <ul role="listbox" className="max-h-64 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-2 py-3 text-center text-[12px] text-text-tertiary">
                {emptyMessage}
              </li>
            ) : (
              filtered.map((option, i) => (
                <li key={option.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.id === value}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(option)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px]",
                      i === active && "bg-surface-muted",
                      option.deemphasised && "text-text-secondary",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{option.name}</span>
                    {option.note && (
                      <span className="shrink-0 text-[11px] text-text-tertiary">{option.note}</span>
                    )}
                    {option.id === value && <span aria-hidden className="text-accent">✓</span>}
                  </button>
                </li>
              ))
            )}
          </ul>

          {options.length > filtered.length && (
            <p className="border-t border-border px-2.5 py-1.5 text-[11px] text-text-tertiary">
              {filtered.length} of {options.length}
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="ml-2 underline hover:text-text-primary"
                >
                  clear filter
                </button>
              )}
            </p>
          )}
        </div>
      )}

      {error ? (
        <p className="mt-1.5 flex gap-[5px] text-[12px] text-danger-on-subtle">
          <span aria-hidden className="font-bold">!</span>
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[12px] leading-[1.4] text-text-tertiary">{hint}</p>
      ) : null}
    </div>
  );
}
