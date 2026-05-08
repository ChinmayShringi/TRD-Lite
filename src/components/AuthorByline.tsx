/**
 * Author byline used at the top of an article and inside cards. The
 * <time> element exposes a machine-readable timestamp via `dateTime`
 * (per WCAG/SEO best practice in plan.md section 9.5).
 */
import Image from "next/image";

import { cn } from "@/lib/utils";
import type { AuthorFields } from "@/src/lib/fragments";

export interface AuthorBylineProps {
  author: AuthorFields | null;
  publishedAt: string;
  /** Compact variant used on cards; verbose variant used on detail page. */
  variant?: "compact" | "detailed";
  className?: string;
}

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function AuthorByline({
  author,
  publishedAt,
  variant = "compact",
  className,
}: AuthorBylineProps) {
  const isDetailed = variant === "detailed";
  return (
    <address
      className={cn(
        "not-italic flex items-center gap-3 text-sm text-muted-foreground",
        isDetailed && "text-base",
        className,
      )}
    >
      {isDetailed && author?.avatarUrl ? (
        <Image
          src={author.avatarUrl}
          alt=""
          width={40}
          height={40}
          className="h-10 w-10 rounded-full bg-muted object-cover"
        />
      ) : null}
      <div className="flex flex-col">
        {author ? (
          <span className="font-medium text-foreground">{author.name}</span>
        ) : (
          <span className="font-medium text-foreground">TRD Newsroom</span>
        )}
        <time
          dateTime={publishedAt}
          className={cn(
            "text-xs",
            isDetailed && "text-sm",
          )}
        >
          {formatDate(publishedAt)}
        </time>
      </div>
    </address>
  );
}
