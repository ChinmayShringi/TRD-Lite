/**
 * Curated "Editor's Choice" tile on the homepage. Pulls a hand-picked
 * article (slug below) and surfaces a muted, looping YouTube embed
 * extracted from the article body as the visual anchor. The right
 * column carries the kicker, headline, italic deck, and a
 * "Continue reading" link.
 *
 * Newsroom convention: the editor flags one story as the editor's
 * pick - it earns its size by being deliberately curated, not by
 * algorithm. We treat it the same way: the slug is hardcoded.
 */
import Link from "next/link";

import { cn } from "@/lib/utils";
import { AuthorByline } from "./AuthorByline";
import type { PostCard as PostCardData } from "@/src/lib/fragments";
import { decodeText } from "@/src/lib/text";

export const EDITORS_CHOICE_SLUG =
  "why-billionaires-are-whining-about-the-pied-a-terre-tax";

export interface EditorsChoiceProps {
  post: PostCardData;
  /**
   * YouTube video ID extracted from the article body. If absent, the
   * component falls back to a still image of the featured media so the
   * tile never collapses.
   */
  youtubeId: string | null;
  className?: string;
}

function buildYoutubeEmbed(id: string): string {
  // autoplay+mute+loop+playlist (loop only honors when playlist is set
  // to the same id). controls/modestbranding/rel keep the iframe quiet
  // so the chrome doesn't compete with the headline beside it.
  const params = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    loop: "1",
    playlist: id,
    controls: "0",
    modestbranding: "1",
    rel: "0",
    playsinline: "1",
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

export function EditorsChoice({ post, youtubeId, className }: EditorsChoiceProps) {
  const title = decodeText(post.title);
  const href = `/article/${post.slug}`;

  return (
    <article
      className={cn(
        "grid gap-8 lg:grid-cols-[3fr_2fr] lg:items-stretch lg:gap-12 lg:divide-x lg:divide-border",
        className,
      )}
    >
      <div className="lg:pr-12">
        {youtubeId ? (
          // Mobile: aspect-video gives the iframe a sane height.
          // lg: drop the fixed aspect ratio and stretch to the row's
          // height (set by the right column's content via items-stretch
          // on the parent grid) so the video matches the text block
          // beside it instead of overshooting it.
          <div className="relative aspect-video w-full overflow-hidden rounded-sm bg-muted lg:aspect-auto lg:h-full lg:min-h-[18rem]">
            <iframe
              src={buildYoutubeEmbed(youtubeId)}
              title={title}
              loading="lazy"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        ) : post.featuredMedia ? (
          // Fallback to a still poster so the tile keeps weight even if
          // the article is swapped to one without a video.
          <Link
            href={href}
            aria-label={title}
            className="block aspect-video overflow-hidden rounded-sm bg-cover bg-center lg:aspect-auto lg:h-full lg:min-h-[18rem]"
            style={{ backgroundImage: `url(${post.featuredMedia.url})` }}
          />
        ) : null}
      </div>
      <div className="flex flex-col justify-center gap-4 lg:pl-12">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">
          Editor&rsquo;s choice
        </span>
        <h2 className="font-heading text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
          <Link
            href={href}
            className="transition-colors hover:text-foreground/60 focus-visible:outline-none focus-visible:underline"
          >
            {title}
          </Link>
        </h2>
        <AuthorByline author={post.author} publishedAt={post.publishedAt} />
        <Link
          href={href}
          className="self-start font-sans text-xs font-semibold uppercase tracking-[0.24em] text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4"
        >
          Continue reading &rarr;
        </Link>
      </div>
    </article>
  );
}
