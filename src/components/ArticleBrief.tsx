/**
 * Dense brief used in the "More stories" tier of the homepage.
 * Thumbnail on the left, headline + byline on the right. Stacks
 * vertically as a list rather than a card grid so the page reads as
 * a newsroom front rather than a uniform card wall.
 *
 * Wrapped in a single anchor (with `focus-visible` ring on the whole
 * row) to keep the keyboard journey at one Tab stop per article, in
 * line with `ArticleCard` and `ArticleHero`.
 */
import Link from "next/link";

import { cn } from "@/lib/utils";
import { AuthorByline } from "./AuthorByline";
import { FeaturedImage } from "./FeaturedImage";
import { SectorChip } from "./SectorChip";
import type { PostCard as PostCardData } from "@/src/lib/fragments";
import { decodeText } from "@/src/lib/text";

export interface ArticleBriefProps {
  post: PostCardData;
  className?: string;
}

export function ArticleBrief({ post, className }: ArticleBriefProps) {
  const primarySector = post.sectors[0];
  const title = decodeText(post.title);

  return (
    <article
      className={cn(
        "group border-b border-border py-5 first:border-t",
        className,
      )}
    >
      <Link
        href={`/article/${post.slug}`}
        className="flex flex-row gap-4 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 sm:gap-5"
      >
        {post.featuredMedia ? (
          <div className="w-28 shrink-0 overflow-hidden rounded-md sm:w-40 md:w-48">
            <FeaturedImage
              media={post.featuredMedia}
              variant="card"
              className="h-full w-full transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {primarySector ? (
            <SectorChip
              slug={primarySector.slug}
              name={primarySector.name}
              asStatic
            />
          ) : null}
          <h3 className="font-heading text-lg font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-accent sm:text-xl">
            {title}
          </h3>
          <AuthorByline author={post.author} publishedAt={post.publishedAt} />
        </div>
      </Link>
    </article>
  );
}
