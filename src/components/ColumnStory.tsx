/**
 * Mid-tier story used inside the "across the page" 3-column band.
 * Small image on top (4:3-ish via card variant), kicker, headline,
 * one-line italic dek. Designed to live inside a column-ruled grid
 * so the parent supplies the vertical hairlines.
 */
import Link from "next/link";

import { cn } from "@/lib/utils";
import { AuthorByline } from "./AuthorByline";
import { FeaturedImage } from "./FeaturedImage";
import type { PostCard as PostCardData } from "@/src/lib/fragments";
import { stripHtml } from "@/src/lib/seo";
import { decodeText } from "@/src/lib/text";

export interface ColumnStoryProps {
  post: PostCardData;
  className?: string;
}

export function ColumnStory({ post, className }: ColumnStoryProps) {
  const primarySector = post.sectors[0];
  const title = decodeText(post.title);
  const dek = stripHtml(post.excerpt).slice(0, 140);

  return (
    <article className={cn("group flex h-full flex-col gap-3", className)}>
      <Link
        href={`/article/${post.slug}`}
        aria-label={title}
        tabIndex={-1}
        className="block overflow-hidden rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4"
      >
        <FeaturedImage
          media={post.featuredMedia}
          variant="card"
          className="transition-transform duration-300 group-hover:scale-[1.02]"
        />
      </Link>
      {primarySector ? (
        <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.28em] text-accent">
          {primarySector.name}
        </span>
      ) : null}
      <h3 className="line-clamp-3 font-heading text-xl font-semibold leading-snug tracking-tight text-foreground">
        <Link
          href={`/article/${post.slug}`}
          className="transition-colors group-hover:text-accent focus-visible:outline-none focus-visible:underline"
        >
          {title}
        </Link>
      </h3>
      {dek ? (
        <p className="line-clamp-2 font-heading text-sm italic leading-snug text-muted-foreground">
          {dek}
        </p>
      ) : null}
      <AuthorByline
        author={post.author}
        publishedAt={post.publishedAt}
        className="mt-auto pt-1"
      />
    </article>
  );
}
