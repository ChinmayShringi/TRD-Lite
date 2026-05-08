/**
 * Robots.txt generator.
 *
 * Per plan.md section 9.5 SEO #3 this is a demo deployment, not a
 * source of truth. We tell crawlers to stay away entirely so we never
 * compete with The Real Deal's real article URLs in search results.
 * The complementary signal lives in each page's `robots: { index:
 * false, follow: false }` metadata, but the file-level disallow makes
 * the intent explicit at `/robots.txt` even before any page is rendered.
 *
 * The sitemap reference is preserved so any explicitly-allowed crawler
 * (e.g., the user pasting a URL into a chat product) can still discover
 * the article surface on a per-page basis.
 */
import type { MetadataRoute } from "next";

import { getBaseUrl } from "@/src/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = getBaseUrl();
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
    sitemap: `${base}/sitemap.xml`,
  };
}
