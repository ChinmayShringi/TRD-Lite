/**
 * Site header. TRD-style three-column masthead:
 *
 *   ┌──────────────────────────────────────────────────────┐
 *   │  THURSDAY, MAY 9 2026                  (date strip)   │
 *   ├──────────────────────────────────────────────────────┤
 *   │  ☰ ⌕            TRD LITE              [theme toggle]  │
 *   │                  REAL ESTATE NEWS                     │
 *   └──────────────────────────────────────────────────────┘
 *
 * Hamburger opens a left-slide drawer that carries primary nav and
 * the sector list. Search is a direct link (kept on the masthead so
 * it's reachable without opening the drawer). Wordmark is centered.
 *
 * Distinct from TRD's red sans-serif wordmark per `.impeccable.md`
 * anti-references: layout is borrowed, brand identity is not.
 */
import Link from "next/link";

import { HeaderSearch } from "./HeaderSearch";
import { MobileDrawer } from "./MobileDrawer";
import { ThemeToggle } from "./ThemeToggle";
import { gqlFetch } from "@/src/lib/graphql-fetch";

const SectorsForHeaderQuery = /* GraphQL */ `
  query SectorsForHeader {
    sectors {
      slug
      name
    }
  }
`;

interface SectorsForHeader {
  sectors: { slug: string; name: string }[];
}

function formatToday(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

export async function Header() {
  let sectors: { slug: string; name: string }[] = [];
  try {
    const data = await gqlFetch<SectorsForHeader>(
      SectorsForHeaderQuery,
      undefined,
      { tags: ["sectors"], revalidate: 3600 },
    );
    sectors = [...data.sectors].sort((a, b) =>
      a.name.localeCompare(b.name, "en", { sensitivity: "base" }),
    );
  } catch {
    // Drawer hides the sector list when empty.
  }

  const dateline = formatToday();

  return (
    <header className="sticky top-0 z-30 border-b-2 border-border bg-background">
      <div className="border-b border-border">
        <p className="mx-auto max-w-6xl px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:px-6">
          {dateline}
        </p>
      </div>
      <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-1">
          <MobileDrawer sectors={sectors} />
          <HeaderSearch />
        </div>
        <div className="flex flex-col items-center justify-center text-center">
          <Link
            href="/"
            aria-label="TheRealDeal home"
            className="font-heading font-bold leading-none text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:underline"
          >
            <span className="text-3xl uppercase tracking-[0.08em] lg:hidden">
              TRD
            </span>
            <span className="hidden text-[2.25rem] tracking-tight lg:inline">
              TheRealDeal
            </span>
          </Link>
          <p className="mt-1 font-sans text-[10px] font-semibold uppercase tracking-[0.32em] text-muted-foreground">
            Real estate news
          </p>
        </div>
        <div className="flex items-center justify-end">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
