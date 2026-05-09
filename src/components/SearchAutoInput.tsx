/**
 * Search-page input that auto-runs the query 2s after the user stops
 * typing. Uses `router.replace` (not `push`) so the browser history
 * does not collect one entry per keystroke; the back button still
 * lands the reader on whatever page they came from.
 *
 * Empty/whitespace queries clear the URL (`/search`) so the page
 * collapses back to its zero state instead of running an empty FTS.
 *
 * The form still has a real submit handler so pressing Enter searches
 * immediately (no waiting on the debounce). Hitting Escape clears the
 * input and the URL.
 */
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

const DEBOUNCE_MS = 2000;

interface SearchAutoInputProps {
  initialValue: string;
}

export function SearchAutoInput({ initialValue }: SearchAutoInputProps) {
  const router = useRouter();
  const [value, setValue] = useState<string>(initialValue);
  // Track the query already reflected in the URL so we don't re-navigate
  // when the input merely re-mounts with the same value (e.g. after the
  // server re-renders the page following our own router.replace).
  const lastNavigatedRef = useRef<string>(initialValue.trim());

  // Re-sync if the URL changes from outside this input (back/forward).
  useEffect(() => {
    setValue(initialValue);
    lastNavigatedRef.current = initialValue.trim();
  }, [initialValue]);

  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed === lastNavigatedRef.current) return;

    const handle = setTimeout(() => {
      lastNavigatedRef.current = trimmed;
      const url =
        trimmed.length === 0
          ? "/search"
          : `/search?${new URLSearchParams({ q: trimmed }).toString()}`;
      router.replace(url);
    }, DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [value, router]);

  function handleSubmit(ev: FormEvent<HTMLFormElement>): void {
    ev.preventDefault();
    const trimmed = value.trim();
    lastNavigatedRef.current = trimmed;
    const url =
      trimmed.length === 0
        ? "/search"
        : `/search?${new URLSearchParams({ q: trimmed }).toString()}`;
    router.replace(url);
  }

  function handleKeyDown(ev: KeyboardEvent<HTMLInputElement>): void {
    if (ev.key === "Escape" && value.length > 0) {
      ev.preventDefault();
      setValue("");
    }
  }

  return (
    <form
      action="/search"
      method="get"
      role="search"
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 sm:flex-row"
    >
      <label htmlFor="search-q" className="sr-only">
        Search query
      </label>
      <input
        id="search-q"
        name="q"
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search articles..."
        autoComplete="off"
        autoFocus
        className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      />
      <button
        type="submit"
        className="rounded-md border border-border bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        Search
      </button>
    </form>
  );
}
