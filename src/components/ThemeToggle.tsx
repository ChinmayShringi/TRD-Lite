/**
 * Header theme toggle. Flips a `dark` class on `<html>` and writes the
 * preference to `localStorage` so subsequent page loads keep the
 * choice. The initial mount reads whatever the inline pre-hydration
 * script in `app/layout.tsx` has already applied to the document, so
 * the button never disagrees with the rendered theme.
 *
 * No external theme provider (we deliberately skip `next-themes` for a
 * one-toggle surface): a few lines of useEffect are clearer than a
 * runtime dependency for this scope, and the app stays free of
 * provider boilerplate.
 */
"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "trd-lite-theme";

function readDocumentTheme(): ThemeMode {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(readDocumentTheme());
    setMounted(true);
  }, []);

  function toggle(): void {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    const root = document.documentElement;
    if (next === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage may be disabled (private browsing, quota); the
      // toggle still works for the current page even without persist.
    }
  }

  // Render a placeholder before hydration so the icon does not flicker
  // between sun and moon on first paint.
  if (!mounted) {
    return (
      <span
        aria-hidden
        className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground"
      />
    );
  }

  const Icon = theme === "dark" ? Sun : Moon;
  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
