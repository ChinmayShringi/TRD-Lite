/**
 * Unit tests for the cache-tag conventions used across the app and the
 * sync handler. The tags are short literals, so the contract here is
 * that the helpers stay stable; rename one and the rest of the system
 * is now invalidating the wrong entries.
 */
import { describe, expect, it } from "vitest";

import { cacheTags, tagsForPost } from "@/src/lib/cache-tags";
import type { WpPost } from "@/src/lib/wp-client";

function makePost(overrides: Partial<WpPost> = {}): WpPost {
  const base: WpPost = {
    id: 1,
    slug: "the-slug",
    date: "2026-05-08T00:00:00",
    date_gmt: "2026-05-08T00:00:00",
    modified: "2026-05-08T00:00:00",
    modified_gmt: "2026-05-08T00:00:00",
    link: "https://example.com/the-slug",
    status: "publish",
    type: "post",
    title: { rendered: "title" },
    excerpt: { rendered: "<p>x</p>" },
    content: { rendered: "<p>body</p>" },
    author: 0,
    featured_media: 0,
  };
  return { ...base, ...overrides };
}

describe("cacheTags helpers", () => {
  it("produces the canonical scoped tag literals", () => {
    expect(cacheTags.homepage()).toBe("homepage");
    expect(cacheTags.post("hello")).toBe("post:hello");
    expect(cacheTags.sector("residential")).toBe("sector:residential");
    expect(cacheTags.market("la")).toBe("market:la");
  });
});

describe("tagsForPost", () => {
  it("returns homepage + post-slug for a bare post with no embedded terms", () => {
    const post = makePost({ slug: "no-terms" });
    const tags = tagsForPost(post);
    expect(tags).toContain("homepage");
    expect(tags).toContain("post:no-terms");
    expect(tags).toHaveLength(2);
  });

  it("appends one sector and market tag per embedded term", () => {
    const post = makePost({
      slug: "with-terms",
      _embedded: {
        "wp:term": [
          [
            {
              id: 10,
              taxonomy: "sector",
              slug: "residential",
              name: "Residential",
            },
            {
              id: 11,
              taxonomy: "sector",
              slug: "commercial",
              name: "Commercial",
            },
          ],
          [
            { id: 20, taxonomy: "market", slug: "la", name: "LA" },
          ],
          [
            { id: 30, taxonomy: "tags", slug: "hot", name: "hot" },
          ],
        ],
      },
    });

    const tags = tagsForPost(post);
    expect(tags).toEqual(
      expect.arrayContaining([
        "homepage",
        "post:with-terms",
        "sector:residential",
        "sector:commercial",
        "market:la",
      ]),
    );
    // Tags taxonomy is intentionally NOT mapped (not a landing page).
    expect(tags.find((t) => t.startsWith("tags:"))).toBeUndefined();
  });

  it("dedupes tags when an embedded term repeats", () => {
    const post = makePost({
      _embedded: {
        "wp:term": [
          [
            { id: 1, taxonomy: "sector", slug: "x", name: "X" },
            { id: 1, taxonomy: "sector", slug: "x", name: "X" },
          ],
        ],
      },
    });
    const tags = tagsForPost(post);
    const xCount = tags.filter((t) => t === "sector:x").length;
    expect(xCount).toBe(1);
  });
});
