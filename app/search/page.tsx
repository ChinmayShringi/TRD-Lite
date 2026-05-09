/**
 * Search results page (Wave 10A bonus). Backed by Postgres FTS via
 * the GraphQL `searchPosts` query (see plan.md section 15 #2). Three
 * states:
 *
 * 1. No `?q=`: render the search form with empty input, no results.
 * 2. `?q=` whitespace-only: same as (1); the resolver returns an
 *    empty connection without touching SQL.
 * 3. `?q=<term>`: render the matching cards and a result count.
 *
 * Server Component. Always dynamic (`force-dynamic`) so a query
 * change always re-renders fresh; the underlying GraphQL call is
 * cached by `gqlFetch`'s 60-second `revalidate`, which is the right
 * tradeoff for a search surface (popular queries hit the cache,
 * long-tail queries pay the round trip).
 */
import type { Metadata } from "next";
import Link from "next/link";

import { SearchResultCard } from "@/src/components/SearchResultCard";
import {
  SearchPostsQuery,
  type SearchPostsData,
} from "@/src/lib/fragments";
import { gqlFetch } from "@/src/lib/graphql-fetch";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Search",
  description: "Full-text search across the TRD-Lite mirror.",
  robots: { index: false, follow: false },
};

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

const PAGE_SIZE = 12;

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const rawQuery = (params.q ?? "").trim();

  if (rawQuery.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-12 sm:px-6 lg:py-16">
        <header className="flex flex-col gap-2 border-b border-border pb-4">
          <span className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Search
          </span>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Search articles
          </h1>
          <p className="text-sm text-muted-foreground">
            Postgres full-text search across titles, excerpts, and article body
            text in the local mirror.
          </p>
        </header>
        <SearchForm initialValue="" />
      </div>
    );
  }

  let data: SearchPostsData | null = null;
  let fetchError: string | null = null;
  try {
    data = await gqlFetch<SearchPostsData>(
      SearchPostsQuery,
      { query: rawQuery, first: PAGE_SIZE, after: null },
      { tags: [`search:${rawQuery}`], revalidate: 60 },
    );
  } catch (err) {
    fetchError = err instanceof Error ? err.message : String(err);
  }

  const edges = data?.searchPosts.edges ?? [];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:py-14">
      <header className="flex flex-col gap-3 border-b border-border pb-4">
        <span className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Search results
        </span>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Results for &ldquo;{rawQuery}&rdquo;
        </h1>
        <p className="text-sm text-muted-foreground">
          {edges.length === 0
            ? "No matches"
            : `${edges.length} match${edges.length === 1 ? "" : "es"}`}
          {data?.searchPosts.pageInfo?.hasNextPage ? " (showing first page)" : ""}.
        </p>
        <SearchForm initialValue={rawQuery} />
      </header>

      {fetchError ? (
        <section
          aria-label="Search unavailable"
          className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900"
        >
          Could not run search: {fetchError}
        </section>
      ) : null}

      {edges.length === 0 && !fetchError ? (
        <section className="rounded-md border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          No articles match{" "}
          <code className="rounded bg-background px-1.5 py-0.5">{rawQuery}</code>
          . Try a broader query, or check{" "}
          <Link
            href="/"
            className="text-accent underline-offset-4 hover:underline focus-visible:underline"
          >
            the homepage
          </Link>{" "}
          for the latest articles.
        </section>
      ) : null}

      {edges.length > 0 ? (
        <section
          aria-label="Search results"
          className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3"
        >
          {edges.map((edge) => (
            <SearchResultCard
              key={edge.node.id}
              post={edge.node}
              headline={edge.headline}
              query={rawQuery}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}

/**
 * Minimal GET form. Submits `q` to `/search`; no JS required and
 * works inside a Server Component without a client boundary.
 */
function SearchForm({ initialValue }: { initialValue: string }) {
  return (
    <form
      action="/search"
      method="get"
      role="search"
      className="flex flex-col gap-2 sm:flex-row"
    >
      <label htmlFor="search-q" className="sr-only">
        Search query
      </label>
      <input
        id="search-q"
        name="q"
        type="search"
        defaultValue={initialValue}
        placeholder="Search articles..."
        autoComplete="off"
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
