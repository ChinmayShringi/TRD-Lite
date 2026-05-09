/**
 * Header "Categories" dropdown. Lists every sector in the local mirror
 * (taxonomy = `sector`) so a reader can jump straight from any page to
 * a topic landing page. Sits to the right of the expand-on-focus
 * search so the masthead reads: brand | primary nav | search | menu.
 *
 * Behavior:
 *  - Click the trigger to open; click anywhere else to close.
 *  - Escape collapses the menu and returns focus to the trigger.
 *  - Picking a category navigates via `<Link>` and closes the menu.
 *
 * Server-fetched sector list is passed in as a prop, so the dropdown
 * itself ships with no GraphQL round trip on the client.
 */
"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

export interface HeaderCategoriesSector {
  slug: string;
  name: string;
}

export interface HeaderCategoriesProps {
  sectors: HeaderCategoriesSector[];
}

export function HeaderCategories({ sectors }: HeaderCategoriesProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(ev: KeyboardEvent): void {
      if (ev.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onPointer(ev: MouseEvent): void {
      const target = ev.target as Node | null;
      if (target && wrapperRef.current && !wrapperRef.current.contains(target)) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  if (sectors.length === 0) {
    return null;
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-1 rounded-full border border-border px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        Categories
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Browse categories"
          className="absolute right-0 z-40 mt-2 w-[20rem] overflow-hidden rounded-lg border border-border bg-background shadow-lg sm:w-[24rem]"
        >
          <ul className="grid max-h-[28rem] grid-cols-1 gap-x-1 gap-y-0.5 overflow-auto p-2 sm:grid-cols-2">
            {sectors.map((s) => (
              <li key={s.slug} role="none">
                <Link
                  role="menuitem"
                  href={`/sector/${s.slug}`}
                  onClick={() => setOpen(false)}
                  className="block rounded px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
