/**
 * Featured-card variant used at the top of the homepage. Larger image,
 * heavier headline, optional excerpt body. Visually anchors the page
 * before the article grid.
 */
import Link from "next/link";

import { cn } from "@/lib/utils";
import { AuthorByline } from "./AuthorByline";
import { FeaturedImage } from "./FeaturedImage";
import { SectorChip } from "./SectorChip";
import type { PostCard as PostCardData } from "@/src/lib/fragments";
import { decodeText } from "@/src/lib/text";

export interface ArticleHeroProps {
  post: PostCardData;
  className?: string;
}

export function ArticleHero({ post, className }: ArticleHeroProps) {
  const primarySector = post.sectors[0];
  const title = decodeText(post.title);

  return (
    <article
      className={cn(
        "group grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-stretch",
        className,
      )}
    >
      <Link
        href={`/article/${post.slug}`}
        // Image-wrap link has no visible text; the post title here gives
        // screen-reader and assistive-tech users a meaningful name and
        // keeps axe-core's `link-name` rule happy.
        aria-label={title}
        tabIndex={-1}
        className="block h-full overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        <FeaturedImage
          media={post.featuredMedia}
          variant="hero"
          priority
          // On wide layouts the hero stretches to match the text column
          // height; below the lg breakpoint it falls back to its natural
          // 16/10 aspect so the mobile stack still has a faithful frame.
          className="transition-transform duration-500 group-hover:scale-[1.015] lg:aspect-auto lg:h-full"
        />
      </Link>
      <div className="flex flex-col justify-center gap-4">
        {primarySector ? (
          <div>
            <SectorChip slug={primarySector.slug} name={primarySector.name} />
          </div>
        ) : null}
        <h2 className="font-heading text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          <Link
            href={`/article/${post.slug}`}
            className="transition-colors group-hover:text-foreground/60 focus-visible:outline-none focus-visible:underline"
          >
            {title}
          </Link>
        </h2>
        <AuthorByline
          author={post.author}
          publishedAt={post.publishedAt}
          variant="detailed"
          className="mt-1"
        />
      </div>
    </article>
  );
}
