/**
 * Sitemap generator backed by the in-process GraphQL handler.
 *
 * Per plan.md section 9.5 SEO #4 the sitemap is generated dynamically
 * from the `posts` table at revalidate time so it always reflects the
 * latest sync. Next 15 wires this file to `/sitemap.xml` automatically
 * by virtue of the filename and the default export shape.
 *
 * Notes:
 *  - We pull 100 posts which is enough to demonstrate the mechanism on
 *    the demo deployment without dragging in pagination plumbing. A
 *    production fork could either lift the limit or implement multiple
 *    sitemap files via Next's segment routing.
 *  - URL entries point at the deployment itself (see `getBaseUrl`),
 *    not the upstream TRD origin. The canonical link on each article
 *    page is what tells search engines where the source-of-truth lives.
 *  - `robots.ts` references this file so crawlers find it via robots.txt.
 */
import type { MetadataRoute } from "next";

import { gqlFetch } from "@/src/lib/graphql-fetch";
import { getBaseUrl } from "@/src/lib/seo";

// The sitemap depends on the in-process Yoga handler at /api/graphql,
// which is not running during `next build`. Marking the route dynamic
// (and revalidate=300) means /sitemap.xml renders at request time and
// keeps a 5-minute cache; that matches the homepage's freshness story
// without dragging the GraphQL fetch into the build step.
export const dynamic = "force-dynamic";
export const revalidate = 300;

interface SitemapPostsResponse {
  posts: {
    edges: { node: { slug: string; modifiedAt: string } }[];
  };
}

const SitemapQuery = /* GraphQL */ `
  query Sitemap($first: Int!) {
    posts(first: $first) {
      edges {
        node {
          slug
          modifiedAt
        }
      }
    }
  }
`;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getBaseUrl();
  const root: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
  ];

  let postsEntries: MetadataRoute.Sitemap = [];
  try {
    const data = await gqlFetch<SitemapPostsResponse>(
      SitemapQuery,
      { first: 100 },
      { tags: ["homepage"], revalidate: 300 },
    );
    postsEntries = data.posts.edges.map((edge) => ({
      url: `${base}/article/${edge.node.slug}`,
      lastModified: new Date(edge.node.modifiedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // Falling back to a sitemap that contains only the homepage is
    // strictly better than a 5xx response. Search engines re-fetch on
    // the next crawl, so the next successful render will fill it in.
    postsEntries = [];
  }

  return [...root, ...postsEntries];
}
