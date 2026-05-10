/**
 * Front-page lead story. Newspaper convention: kicker label,
 * oversized serif headline, italic standfirst (deck), byline, then a
 * generous image with a thin caption rule. No card, no shadow, no
 * rounded chrome - the type does the work.
 *
 * Wrapped in a single anchor for keyboard parity with `ArticleCard`
 * and `ArticleBrief` (one Tab stop per article, per `.impeccable.md`).
 */
import Link from "next/link";

import { cn } from "@/lib/utils";
import { AuthorByline } from "./AuthorByline";
import { FeaturedImage } from "./FeaturedImage";
import type { PostCard as PostCardData } from "@/src/lib/fragments";
import { stripHtml } from "@/src/lib/seo";
import { decodeText } from "@/src/lib/text";

export interface LeadStoryProps {
  post: PostCardData;
  className?: string;
}

export function LeadStory({ post, className }: LeadStoryProps) {
  const primarySector = post.sectors[0];
  const title = decodeText(post.title);
  const deck = stripHtml(post.excerpt).slice(0, 220);

  return (
    <article className={cn("group flex flex-col gap-5", className)}>
      <Link
        href={`/article/${post.slug}`}
        aria-label={title}
        className="flex flex-col gap-5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4"
      >
        {primarySector ? (
          <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {primarySector.name}
          </span>
        ) : null}
        <h2 className="font-heading font-bold leading-[1.02] tracking-tight text-foreground transition-colors group-hover:text-foreground/60 text-[clamp(2rem,4.4vw,3.75rem)]">
          {title}
        </h2>
        {deck ? (
          <p className="max-w-prose font-heading text-lg italic leading-snug text-muted-foreground sm:text-xl">
            {deck}
          </p>
        ) : null}
        <AuthorByline
          author={post.author}
          publishedAt={post.publishedAt}
          variant="detailed"
        />
        {post.featuredMedia ? (
          <figure className="mt-2 flex flex-col gap-2 border-t border-border pt-4">
            <FeaturedImage
              media={post.featuredMedia}
              variant="hero"
              priority
              className="transition-transform duration-500 group-hover:scale-[1.01]"
            />
            {post.featuredMedia.alt ? (
              <figcaption className="font-sans text-xs italic leading-snug text-muted-foreground">
                {post.featuredMedia.alt}
              </figcaption>
            ) : null}
          </figure>
        ) : null}
      </Link>
    </article>
  );
}
