/**
 * Central place defining the Next.js Data Cache tag conventions used
 * across the app. Keeping every tag literal here lets the sync handler,
 * the page-level `fetch()` calls, and the documentation read from one
 * source of truth (plan.md section 7).
 *
 * Convention: tags are lowercase strings, scoped names use a colon
 * separator (`post:slug-foo`, `sector:residential`). Pages register the
 * tag they care about on their `fetch` call; the sync handler calls
 * `revalidateTag(tag)` for every tag a touched post belongs to.
 */
import type { WpPost, WpTerm } from "./wp-client";

/** Collection of tag-builder helpers. */
export const cacheTags = {
  /** Homepage list of latest articles. */
  homepage: (): string => "homepage",
  /** A single article-detail page, scoped by slug. */
  post: (slug: string): string => `post:${slug}`,
  /** A sector landing page, scoped by sector slug. */
  sector: (slug: string): string => `sector:${slug}`,
  /** A market landing page, scoped by market slug. */
  market: (slug: string): string => `market:${slug}`,
} as const;

/**
 * Returns every cache tag a touched post should invalidate. The sync
 * handler calls this for each upserted post and runs `revalidateTag()`
 * on the deduped output. Order: homepage first, the post itself, then
 * one tag per embedded sector and market term.
 */
export function tagsForPost(post: WpPost): string[] {
  const tags = new Set<string>();
  tags.add(cacheTags.homepage());
  tags.add(cacheTags.post(post.slug));

  const termGroups = post._embedded?.["wp:term"] ?? [];
  for (const group of termGroups) {
    for (const term of group as WpTerm[]) {
      if (term.taxonomy === "sector") {
        tags.add(cacheTags.sector(term.slug));
      } else if (term.taxonomy === "market") {
        tags.add(cacheTags.market(term.slug));
      }
    }
  }

  return Array.from(tags);
}
