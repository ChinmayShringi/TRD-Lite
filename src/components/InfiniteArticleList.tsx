/**
 * Client-side infinite-scroll grid. Receives the first page of edges
 * from the server (so the initial paint already has real content),
 * then watches a sentinel element with `IntersectionObserver` and
 * fetches the next page from the in-process Yoga handler when the
 * sentinel approaches the viewport.
 *
 * Skeleton cards fill the grid while a fetch is in flight so the
 * layout never jumps. Errors are recoverable: a failed fetch shows a
 * "Try again" button rather than blocking further pagination.
 *
 * The component is intentionally narrow:
 *  - It only knows about the homepage's `posts(first, after)` shape.
 *    Sector and search pages have their own pagination semantics
 *    (keyset cursor vs. ts_rank offset) so we keep this component
 *    focused.
 *  - The GraphQL query string is supplied by the parent so the
 *    bundle does not pull in the larger `fragments.ts` file just for
 *    this list.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ArticleBrief } from "./ArticleBrief";
import { ArticleCard } from "./ArticleCard";
import { ArticleCardSkeleton } from "./ArticleCardSkeleton";
import type { PostCard } from "@/src/lib/fragments";

export interface InfiniteEdge {
  cursor: string;
  node: PostCard;
}

interface PostsPageResponse {
  data?: {
    posts: {
      edges: InfiniteEdge[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
  errors?: Array<{ message: string }>;
}

export interface InfiniteArticleListProps {
  initialEdges: InfiniteEdge[];
  initialHasNextPage: boolean;
  initialEndCursor: string | null;
  /** GraphQL query string with `$first: Int!, $after: String`. */
  query: string;
  /** Page size to request per fetch (default 12). */
  pageSize?: number;
  /**
   * "card" → 3-col grid of image cards (existing behavior).
   * "brief" → single-column text-only list (homepage "More stories"
   *   tier). Skeletons hide in brief mode because the row geometry
   *   isn't expensive to settle.
   */
  variant?: "card" | "brief";
}

const SKELETON_COUNT = 6;

export function InfiniteArticleList({
  initialEdges,
  initialHasNextPage,
  initialEndCursor,
  query,
  pageSize = 12,
  variant = "card",
}: InfiniteArticleListProps) {
  const [edges, setEdges] = useState<InfiniteEdge[]>(initialEdges);
  const [endCursor, setEndCursor] = useState<string | null>(
    initialEndCursor,
  );
  const [hasNextPage, setHasNextPage] = useState<boolean>(
    initialHasNextPage,
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasNextPage) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          variables: { first: pageSize, after: endCursor },
        }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json: PostsPageResponse = await res.json();
      if (json.errors && json.errors.length > 0) {
        throw new Error(json.errors[0]?.message ?? "GraphQL error");
      }
      const conn = json.data?.posts;
      if (!conn) {
        throw new Error("Empty response");
      }
      setEdges((prev) => {
        // Defend against duplicate inserts if the user double-triggers
        // pagination (e.g. fast scroll up-and-down).
        const seen = new Set(prev.map((e) => e.node.id));
        const fresh = conn.edges.filter((e) => !seen.has(e.node.id));
        return [...prev, ...fresh];
      });
      setEndCursor(conn.pageInfo.endCursor);
      setHasNextPage(conn.pageInfo.hasNextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more");
    } finally {
      setLoading(false);
    }
  }, [endCursor, hasNextPage, loading, pageSize, query]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage || loading || error) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            loadMore();
          }
        }
      },
      { rootMargin: "320px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, loading, error, loadMore]);

  return (
    <div className="flex flex-col gap-8">
      {variant === "card" ? (
        <div
          className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy={loading}
        >
          {edges.map((edge) => (
            <ArticleCard key={edge.node.id} post={edge.node} />
          ))}
          {loading
            ? Array.from({ length: SKELETON_COUNT }).map((_, idx) => (
                <ArticleCardSkeleton key={`skeleton-${idx}`} />
              ))
            : null}
        </div>
      ) : (
        <div className="flex flex-col" aria-busy={loading}>
          {edges.map((edge) => (
            <ArticleBrief key={edge.node.id} post={edge.node} />
          ))}
          {loading ? (
            <p className="border-b border-border py-5 text-sm text-muted-foreground">
              Loading more stories...
            </p>
          ) : null}
        </div>
      )}

      {hasNextPage ? (
        <div
          ref={sentinelRef}
          aria-hidden
          className="h-px w-full"
          data-testid="infinite-scroll-sentinel"
        />
      ) : null}

      {error ? (
        <div className="flex flex-col items-center gap-2 py-4 text-sm text-muted-foreground">
          <p>Could not load more stories ({error}).</p>
          <button
            type="button"
            onClick={loadMore}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Try again
          </button>
        </div>
      ) : null}

      {!hasNextPage && edges.length > 0 ? (
        <p className="border-t border-border pt-6 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
          End of feed
        </p>
      ) : null}

      {!loading && hasNextPage && !error ? (
        <button
          type="button"
          onClick={loadMore}
          className="mx-auto rounded-md border border-border bg-background px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Load more
        </button>
      ) : null}
    </div>
  );
}
