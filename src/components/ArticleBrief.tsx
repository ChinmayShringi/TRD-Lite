/**
 * Dense, text-only brief used in the "More stories" tier of the
 * homepage. No image, no excerpt, just the section label, headline,
 * and byline. Stacks vertically as a list rather than a card grid so
 * the page reads as a newsroom front rather than a uniform card wall.
 *
 * Wrapped in a single anchor (with `focus-visible` ring on the whole
 * row) to keep the keyboard journey at one Tab stop per article, in
 * line with `ArticleCard` and `ArticleHero`.
 */
import Link from "next/link";

import { cn } from "@/lib/utils";
import { AuthorByline } from "./AuthorByline";
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
        className="flex flex-col gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4"
      >
        {primarySector ? (
          <SectorChip
            slug={primarySector.slug}
            name={primarySector.name}
            asStatic
          />
        ) : null}
        <h3 className="font-heading text-lg font-semibold leading-snug tracking-tight text-foreground sm:text-xl">
          {title}
        </h3>
        <AuthorByline author={post.author} publishedAt={post.publishedAt} />
      </Link>
    </article>
  );
}
