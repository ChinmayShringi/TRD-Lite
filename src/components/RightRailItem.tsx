/**
 * Right-rail story used next to the homepage lead. Small thumbnail on
 * the right, kicker + headline + byline on the left. Stack three of
 * these vertically separated by hairlines to mirror the WSJ "What's
 * News" rail.
 */
import Link from "next/link";

import { cn } from "@/lib/utils";
import { AuthorByline } from "./AuthorByline";
import { FeaturedImage } from "./FeaturedImage";
import type { PostCard as PostCardData } from "@/src/lib/fragments";
import { decodeText } from "@/src/lib/text";

export interface RightRailItemProps {
  post: PostCardData;
  className?: string;
}

export function RightRailItem({ post, className }: RightRailItemProps) {
  const primarySector = post.sectors[0];
  const title = decodeText(post.title);

  return (
    <article className={cn("group", className)}>
      <Link
        href={`/article/${post.slug}`}
        className="flex flex-row items-start gap-4 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {primarySector ? (
            <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
              {primarySector.name}
            </span>
          ) : null}
          <h3 className="font-heading text-lg font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-foreground/60 sm:text-xl">
            {title}
          </h3>
          <AuthorByline author={post.author} publishedAt={post.publishedAt} />
        </div>
        {post.featuredMedia ? (
          <div className="w-24 shrink-0 overflow-hidden rounded-sm sm:w-28">
            <FeaturedImage
              media={post.featuredMedia}
              variant="card"
              className="h-full w-full transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </div>
        ) : null}
      </Link>
    </article>
  );
}
