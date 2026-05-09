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
import { decodeText, stripAndDecode } from "@/src/lib/text";

export interface ArticleHeroProps {
  post: PostCardData;
  className?: string;
}

export function ArticleHero({ post, className }: ArticleHeroProps) {
  const primarySector = post.sectors[0];
  const title = decodeText(post.title);
  const excerptText = stripAndDecode(post.excerpt);
  const excerpt = excerptText.length > 240
    ? `${excerptText.slice(0, 240).trim()}...`
    : excerptText;

  return (
    <article
      className={cn(
        "group grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center",
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
        className="block overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        <FeaturedImage
          media={post.featuredMedia}
          variant="hero"
          priority
          className="transition-transform duration-500 group-hover:scale-[1.015]"
        />
      </Link>
      <div className="flex flex-col gap-4">
        {primarySector ? (
          <div>
            <SectorChip slug={primarySector.slug} name={primarySector.name} />
          </div>
        ) : null}
        <h2 className="font-heading text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          <Link
            href={`/article/${post.slug}`}
            className="transition-colors group-hover:text-accent focus-visible:outline-none focus-visible:underline"
          >
            {title}
          </Link>
        </h2>
        {excerpt ? (
          <p className="text-base leading-7 text-muted-foreground sm:text-lg">
            {excerpt}
          </p>
        ) : null}
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
