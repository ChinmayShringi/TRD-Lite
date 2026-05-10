/**
 * Left-slide masthead drawer. Modeled on the TRD primary nav: a
 * hamburger trigger that opens a full-height panel from the left,
 * carrying the X close + search at the top, a bold uppercase menu
 * list below, a hairline divider, and the theme toggle near the
 * bottom.
 *
 * Behavior:
 *  - Trigger toggles `open`. Backdrop click closes. Escape closes.
 *  - Body scroll is locked while open so the page underneath doesn't
 *    bounce when the drawer is animated in.
 *  - Slide is `transform: translateX` for GPU compositing; the
 *    backdrop fades via `opacity` so we never animate layout properties.
 *
 * The drawer is rendered server-side as a client component sibling of
 * the wordmark, so its server cost is zero - all of the open/close
 * state lives in the user's browser.
 */
"use client";

import { Menu, Moon, Search, Sun, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { HeaderCategoriesSector } from "./HeaderCategories";

const STORAGE_KEY = "trd-lite-theme";
type ThemeMode = "light" | "dark";

interface PrimaryLink {
  label: string;
  href: string;
}

const PRIMARY_LINKS: PrimaryLink[] = [
  { label: "Home", href: "/" },
  { label: "Search", href: "/search" },
  { label: "Sync status", href: "/sync-status" },
];

export interface MobileDrawerProps {
  sectors: HeaderCategoriesSector[];
}

export function MobileDrawer({ sectors }: MobileDrawerProps) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [mounted, setMounted] = useState(false);

  // Read the post-hydration theme from the document so the in-drawer
  // toggle agrees with whatever the pre-hydration script in
  // `app/layout.tsx` already applied.
  useEffect(() => {
    setMounted(true);
    setTheme(
      typeof document !== "undefined" &&
        document.documentElement.classList.contains("dark")
        ? "dark"
        : "light",
    );
  }, []);

  // Lock body scroll + close on Escape while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(ev: KeyboardEvent): void {
      if (ev.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function setThemeMode(next: ThemeMode): void {
    setTheme(next);
    const root = document.documentElement;
    if (next === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage may be disabled (private mode); ignore.
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="primary-drawer"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Panel */}
      <aside
        id="primary-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Primary navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-[20rem] max-w-[88vw] flex-col bg-[#0d0d0d] text-white shadow-2xl transition-transform duration-300 ease-out will-change-transform sm:w-[24rem] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-4 px-6 pt-6">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <Link
            href="/search"
            aria-label="Search"
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>

        <nav
          aria-label="Primary"
          className="flex flex-1 flex-col gap-7 overflow-y-auto px-6 py-8"
        >
          <ul className="flex flex-col gap-5">
            {PRIMARY_LINKS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="font-heading text-2xl font-bold uppercase tracking-[0.04em] text-white transition-colors hover:text-white/70 focus-visible:outline-none focus-visible:underline"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          {sectors.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.32em] text-white/50">
                Sectors
              </p>
              <ul className="flex flex-col gap-3">
                {sectors.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/sector/${s.slug}`}
                      onClick={() => setOpen(false)}
                      className="font-heading text-lg font-semibold uppercase tracking-[0.04em] text-white/80 transition-colors hover:text-white focus-visible:outline-none focus-visible:underline"
                    >
                      {s.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </nav>

        <div className="border-t border-white/15 px-6 py-5">
          <div
            role="group"
            aria-label="Theme"
            className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 p-1"
          >
            <button
              type="button"
              aria-label="Switch to dark theme"
              aria-pressed={mounted && theme === "dark"}
              onClick={() => setThemeMode("dark")}
              className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${
                mounted && theme === "dark"
                  ? "bg-white text-black"
                  : "text-white/70 hover:text-white"
              }`}
            >
              <Moon className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Switch to light theme"
              aria-pressed={mounted && theme === "light"}
              onClick={() => setThemeMode("light")}
              className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${
                mounted && theme === "light"
                  ? "bg-white text-black"
                  : "text-white/70 hover:text-white"
              }`}
            >
              <Sun className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
