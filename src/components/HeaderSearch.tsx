/**
 * Sticky-header search. Pure-CSS open/close animation: the input
 * sits at icon-size and expands when it gains focus or holds text,
 * driven by `:focus` / `:not(:placeholder-shown)` selectors in
 * `app/globals.css` (`.search-box` block). The trailing
 * `button[type="reset"]` is a single element that morphs from a
 * magnifier handle (closed) to an X (open) using two pseudo-element
 * bars; React does not manage that state.
 *
 * React still owns:
 *  - controlled `value` so URL-seeding (`?q=`) carries between
 *    /search navigations,
 *  - submit handling that pushes to /search via the App Router,
 *  - reset that blurs the input so it animates back to icon-size.
 *
 * The `placeholder=" "` (single space) is load-bearing: an empty
 * placeholder would make `:placeholder-shown` always evaluate true
 * and prevent the open state from sticking when text is present.
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

export function HeaderSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const initialQuery = searchParams?.get("q") ?? "";
  const [value, setValue] = useState<string>(initialQuery);

  // Stay in sync with URL changes (back/forward, server navigation).
  useEffect(() => {
    setValue(searchParams?.get("q") ?? "");
  }, [searchParams]);

  function handleSubmit(ev: FormEvent<HTMLFormElement>): void {
    ev.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length === 0) return;
    router.push(
      `/search?${new URLSearchParams({ q: trimmed }).toString()}`,
    );
  }

  function handleReset(): void {
    setValue("");
    // Blur on the next frame so React re-renders the empty value
    // first; otherwise the CSS `:focus` state keeps the box open.
    requestAnimationFrame(() => inputRef.current?.blur());
  }

  return (
    <form
      role="search"
      method="get"
      action="/search"
      onSubmit={handleSubmit}
      onReset={handleReset}
      className="search-box"
    >
      <label htmlFor={inputId} className="sr-only">
        Search articles
      </label>
      <input
        id={inputId}
        ref={inputRef}
        name="q"
        type="text"
        autoComplete="off"
        placeholder=" "
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="reset" aria-label={value ? "Clear search" : "Search"} />
    </form>
  );
}
