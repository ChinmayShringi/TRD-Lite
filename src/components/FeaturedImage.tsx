/**
 * Wrapper around `next/image` that picks a sensible WP "size" entry for
 * the requested layout and emits proper `sizes` so the browser fetches
 * the right asset. Returns `null` when there is no image so callers do
 * not have to guard.
 *
 * The component never tries to be clever: it picks the first entry from
 * a preferred-name list per variant and falls back to `media.url`.
 */
import Image from "next/image";

import { cn } from "@/lib/utils";
import type { MediaFields, MediaSizeFields } from "@/src/lib/fragments";

export type FeaturedImageVariant = "hero" | "card" | "detail";

const PREFERRED_BY_VARIANT: Record<FeaturedImageVariant, string[]> = {
  hero: ["large", "medium_large", "xlarge", "full", "medium"],
  card: ["medium_large", "medium", "large", "full"],
  detail: ["large", "xlarge", "full", "medium_large"],
};

const SIZES_BY_VARIANT: Record<FeaturedImageVariant, string> = {
  hero: "(min-width: 1024px) 720px, (min-width: 640px) 60vw, 100vw",
  card: "(min-width: 1024px) 360px, (min-width: 640px) 45vw, 100vw",
  detail: "(min-width: 1024px) 800px, (min-width: 640px) 70vw, 100vw",
};

const ASPECT_BY_VARIANT: Record<FeaturedImageVariant, string> = {
  hero: "aspect-[16/10]",
  card: "aspect-[16/10]",
  detail: "aspect-[16/9]",
};

function pickSize(
  media: MediaFields,
  variant: FeaturedImageVariant,
): { url: string; width: number; height: number } {
  const sizes: MediaSizeFields[] = media.sizes ?? [];
  const preferred = PREFERRED_BY_VARIANT[variant];
  for (const name of preferred) {
    const match = sizes.find((s) => s.name === name);
    if (match && match.url && match.width > 0 && match.height > 0) {
      return { url: match.url, width: match.width, height: match.height };
    }
  }
  // Fallback to the canonical full image. Use sane numeric defaults if
  // dimensions are missing; next/image treats 0 as a layout error.
  return {
    url: media.url,
    width: media.width && media.width > 0 ? media.width : 1200,
    height: media.height && media.height > 0 ? media.height : 800,
  };
}

export interface FeaturedImageProps {
  media: MediaFields | null;
  variant?: FeaturedImageVariant;
  /** Pass true for above-the-fold images (hero / article). */
  priority?: boolean;
  className?: string;
}

export function FeaturedImage({
  media,
  variant = "card",
  priority,
  className,
}: FeaturedImageProps) {
  if (!media) {
    return (
      <div
        aria-hidden
        className={cn(
          "relative w-full overflow-hidden rounded-lg bg-muted",
          ASPECT_BY_VARIANT[variant],
          className,
        )}
      />
    );
  }
  const picked = pickSize(media, variant);
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-lg bg-muted",
        ASPECT_BY_VARIANT[variant],
        className,
      )}
    >
      <Image
        src={picked.url}
        alt={media.alt ?? ""}
        fill
        sizes={SIZES_BY_VARIANT[variant]}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}
