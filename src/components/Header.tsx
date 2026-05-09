/**
 * Site header. Editorial layout: brand wordmark on the left;
 * search, Categories dropdown, and theme toggle on the right.
 * Async server component: the Categories dropdown receives a
 * server-fetched sector list so the client ships zero GraphQL
 * traffic for menu data.
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

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="font-heading text-2xl font-semibold tracking-tight text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:underline"
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
