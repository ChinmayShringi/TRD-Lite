/**
 * Medium card used in the homepage grid and on sector pages. Always
 * renders the featured image, primary sector chip, title, excerpt
 * snippet, and byline. The card is wrapped in a single anchor to keep
 * keyboard users one Tab stop per article.
 */
import Link from "next/link";

import { cn } from "@/lib/utils";
import { AuthorByline } from "./AuthorByline";
import { FeaturedImage } from "./FeaturedImage";
import { SectorChip } from "./SectorChip";
import type { PostCard as PostCardData } from "@/src/lib/fragments";

export interface ArticleCardProps {
  post: PostCardData;
  className?: string;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

export function ArticleCard({ post, className }: ArticleCardProps) {
  const primarySector = post.sectors[0];
  const excerptText = stripHtml(post.excerpt);
  const excerpt = excerptText.length > 160
    ? `${excerptText.slice(0, 160).trim()}...`
    : excerptText;

  return (
    <article
      className={cn(
        "group flex flex-col gap-4 focus-within:outline-none",
        className,
      )}
    >
      <Link
        href={`/article/${post.slug}`}
        // Image-wrap link has no visible text; the post title here gives
        // screen-reader and assistive-tech users a meaningful name and
        // keeps axe-core's `link-name` rule happy.
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
            {post.title}
          </Link>
        </h3>
        {excerpt ? (
          <p className="line-clamp-3 text-sm leading-6 text-muted-foreground">
            {excerpt}
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
