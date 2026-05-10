/**
 * Right-rail story used next to the homepage lead. Compact, type-led,
 * no image. Stack three of these vertically separated by hairlines to
 * mirror the WSJ/NYT "What's News" rail.
 */
import Link from "next/link";

import { cn } from "@/lib/utils";
import { AuthorByline } from "./AuthorByline";
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
        className="flex flex-col gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4"
      >
        {primarySector ? (
          <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
            {primarySector.name}
          </span>
        ) : null}
        <h3 className="font-heading text-xl font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-foreground/60">
          {title}
        </h3>
        <AuthorByline author={post.author} publishedAt={post.publishedAt} />
      </Link>
    </article>
  );
}
