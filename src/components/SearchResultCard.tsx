/**
 * Result row used by `/search`. Renders the same article-card layout
 * as the homepage but folds in three highlight surfaces:
 *
 *  - Title: client-side regex highlight against the user's query.
 *  - Excerpt: same client-side regex.
 *  - Body snippet: server-built `headline` from Postgres ts_headline,
 *    parsed into segments so the UI never sets raw HTML on the DOM.
 *
 * The component is a Server Component (no "use client") because the
 * highlight helpers are pure string functions and `<mark>` is a stock
 * HTML element. Rendering all three on the server keeps the search
 * page free of client JS for the result list itself.
 */
import Link from "next/link";

import { AuthorByline } from "./AuthorByline";
import { FeaturedImage } from "./FeaturedImage";
import { SectorChip } from "./SectorChip";
import type { PostCard as PostCardData } from "@/src/lib/fragments";
import {
  buildHighlightRegex,
  splitHighlightedSnippet,
  splitPlainText,
  type HighlightSegment,
} from "@/src/lib/highlight";

export interface SearchResultCardProps {
  post: PostCardData;
  /** Postgres ts_headline snippet with `<mark>...</mark>` wrappers. */
  headline: string;
  /** The raw user query string. Used for title/excerpt highlighting. */
  query: string;
}

function renderSegments(segments: HighlightSegment[]) {
  return segments.map((seg, idx) => {
    if (seg.matched) {
      return (
        <mark
          key={idx}
          className="rounded bg-accent/20 px-0.5 text-foreground"
        >
          {seg.text}
        </mark>
      );
    }
    return <span key={idx}>{seg.text}</span>;
  });
}

export function SearchResultCard({
  post,
  headline,
  query,
}: SearchResultCardProps) {
  const primarySector = post.sectors[0];
  const regex = buildHighlightRegex(query);
  const titleSegments = splitPlainText(post.title, regex);
  const excerptText = post.excerpt;
  const excerptSegments = splitPlainText(
    excerptText.length > 220
      ? `${excerptText.slice(0, 220).trim()}...`
      : excerptText,
    regex,
  );
  const headlineSegments = splitHighlightedSnippet(headline);

  return (
    <article className="group flex flex-col gap-4 focus-within:outline-none">
      <Link
        href={`/article/${post.slug}`}
        aria-label={post.title}
        tabIndex={-1}
        className="block overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        <FeaturedImage
          media={post.featuredMedia}
          variant="card"
          className="transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </Link>
      <div className="flex flex-col gap-2">
        {primarySector ? (
          <div>
            <SectorChip slug={primarySector.slug} name={primarySector.name} />
          </div>
        ) : null}
        <h3 className="font-heading text-xl font-semibold leading-snug tracking-tight text-foreground">
          <Link
            href={`/article/${post.slug}`}
            className="transition-colors group-hover:text-accent focus-visible:outline-none focus-visible:underline"
          >
            {renderSegments(titleSegments)}
          </Link>
        </h3>
        {excerptText ? (
          <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
            {renderSegments(excerptSegments)}
          </p>
        ) : null}
        {headlineSegments.length > 0 ? (
          <p className="rounded-md border-l-2 border-accent/60 bg-muted/20 px-3 py-2 text-xs leading-6 text-muted-foreground">
            <span className="mr-2 font-heading text-[10px] font-semibold uppercase tracking-[0.2em] text-foreground/70">
              Match
            </span>
            {renderSegments(headlineSegments)}
          </p>
        ) : null}
        <AuthorByline
          author={post.author}
          publishedAt={post.publishedAt}
          className="mt-1"
        />
      </div>
    </article>
  );
}
