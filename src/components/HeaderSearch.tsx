/**
 * Sticky-header search input. Renders as a single magnifier button
 * when collapsed; on focus, the button hides and a width-animated
 * input slides in. Submitting (Enter or the "Go" button) navigates to
 * /search?q=... via a plain GET form, so the surface works without JS
 * the moment it has been mounted.
 *
 * State machine is intentionally tiny: `expanded` becomes true the
 * moment the user gives the input keyboard or pointer focus, stays
 * true while the input is non-empty, and collapses back when both
 * focus is lost AND the input is empty. This keeps the user from
 * losing their query if they tab into the input by mistake.
 */
"use client";

import { Search as SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";

export interface HeaderSearchProps {
  /** Optional placeholder; falls back to a generic prompt. */
  placeholder?: string;
}

export function HeaderSearch({
  placeholder = "Search articles...",
}: HeaderSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Seed from the existing `?q=` so navigating between search-result
  // pages keeps the term visible without re-typing.
  const initialQuery = searchParams?.get("q") ?? "";
  const [value, setValue] = useState<string>(initialQuery);
  const [expanded, setExpanded] = useState<boolean>(initialQuery.length > 0);

  // Stay in sync if the URL changes from outside (back/forward, server
  // navigation). We only widen when the URL has a real query.
  useEffect(() => {
    const next = searchParams?.get("q") ?? "";
    setValue(next);
    if (next.length > 0) setExpanded(true);
  }, [searchParams]);

  function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      router.push("/search");
      return;
    }
    const params = new URLSearchParams({ q: trimmed });
    router.push(`/search?${params.toString()}`);
  }

  function handleBlur() {
    if (value.trim().length === 0) {
      setExpanded(false);
    }
  }

  function openAndFocus() {
    setExpanded(true);
    // Focus deferred to next tick so the width transition does not
    // start until the input has been laid out at its new size.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  return (
    <form
      action="/search"
      method="get"
      role="search"
      onSubmit={handleSubmit}
      className="relative flex items-center"
    >
      <label htmlFor={inputId} className="sr-only">
        Search articles
      </label>
      <button
        type="button"
        aria-label="Open search"
        aria-expanded={expanded}
        onClick={openAndFocus}
        className={`flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
          expanded ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <SearchIcon className="h-4 w-4" aria-hidden="true" />
      </button>
      <div
        className={`flex items-stretch overflow-hidden rounded-full border border-border bg-background transition-[width,opacity] duration-200 ease-out focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 ${
          expanded ? "w-56 opacity-100 sm:w-72" : "pointer-events-none w-0 opacity-0"
        }`}
        aria-hidden={!expanded}
      >
        <input
          id={inputId}
          ref={inputRef}
          name="q"
          type="search"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          tabIndex={expanded ? 0 : -1}
          className="h-9 w-full bg-transparent px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:outline-none"
        />
        <button
          type="submit"
          tabIndex={expanded ? 0 : -1}
          aria-label="Search"
          className="flex h-9 shrink-0 items-center bg-foreground px-3 text-xs font-medium uppercase tracking-wider text-background transition-colors hover:bg-foreground/90 focus:outline-none focus-visible:outline-none"
        >
          Go
        </button>
      </div>
    </form>
  );
}
