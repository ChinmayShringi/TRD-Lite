/**
 * Robots.txt generator.
 *
 * Article pages set their canonical to the original therealdeal.com
 * URL, so search engines that respect `rel="canonical"` will surface
 * TRD's article in results, not ours. That makes it safe to allow
 * crawlers across the whole tree: indexing TRD-Lite improves
 * discoverability of the demo and won't compete with TRD itself.
 *
 * Operational pages (sync status, admin, internal API routes) are
 * disallowed: they don't add user value in search results and the
 * admin path is auth-gated anyway.
 */
import type { MetadataRoute } from "next";

import { getBaseUrl } from "@/src/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const base = getBaseUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/sync-status"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
