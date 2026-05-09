/**
 * Site header. Three-band editorial masthead:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │  THURSDAY, MAY 9 2026          (date strip)   │
 *   ├──────────────────────────────────────────────┤
 *   │  TRD LITE      [search] [Categories ▾]        │
 *   └──────────────────────────────────────────────┘
 *
 * The flat opaque background and double hairline are deliberate: the
 * site is a publication, not an app, and the masthead should feel
 * printed rather than floating. No backdrop-blur (anti-reference per
 * `.impeccable.md`). The theme toggle has been demoted to the footer
 * so it stops competing with editorial controls for masthead space.
 *
 * Async server component: the Categories dropdown receives a
 * server-fetched sector list so the client ships zero GraphQL traffic
 * for menu data.
 */
import Link from "next/link";

import { HeaderCategories } from "./HeaderCategories";
import { HeaderSearch } from "./HeaderSearch";
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
  // Render server-side in the publication's local timezone (NYC) so
  // the date strip reads as a newsroom dateline rather than the
  // server's UTC clock.
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}

export async function Header() {
  // Sector list is stable in the corpus; cache for an hour and
  // invalidate via the `sectors` tag (the sync handler already
  // revalidates this tag on each successful run).
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
    // The dropdown is decorative; if the GraphQL call fails we hide it
    // rather than break the masthead.
  }

  const dateline = formatToday();

  return (
    <header className="sticky top-0 z-30 border-b-2 border-border bg-background">
      <div className="border-b border-border">
        <p className="mx-auto max-w-6xl px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:px-6">
          {dateline}
        </p>
      </div>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="font-heading text-3xl font-bold uppercase tracking-[0.04em] text-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:underline sm:text-[2rem]"
        >
          TRD Lite
        </Link>
        <div className="flex items-center gap-2">
          <HeaderSearch />
          <HeaderCategories sectors={sectors} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
