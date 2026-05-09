/**
 * SEO and metadata helpers for TRD-Lite per plan.md section 9.5.
 *
 * Two responsibilities:
 *
 * 1. Compute the absolute base URL of the running deployment so
 *    sitemap/robots can emit fully-qualified URLs without callers having
 *    to thread `process.env.VERCEL_URL` everywhere.
 *
 * 2. Fetch the small projection of a Post needed for `generateMetadata`
 *    (title, excerpt, dates, author name, featured image, canonical
 *    `link` pointing back to TRD). Reuses the in-process Yoga handler
 *    via `gqlFetch` so the metadata route benefits from the same Data
 *    Cache and tag invalidation as the page itself.
 *
 * Why a separate file: the page components import only what they need,
 * keeps file sizes small per the user's coding-style rules, and the
 * helper is exercised from `app/page.tsx`, `app/article/[slug]/page.tsx`,
 * `app/sector/[slug]/page.tsx`, `app/sitemap.ts`, and `app/robots.ts`.
 */
import { gqlFetch } from "./graphql-fetch";

/**
 * Returns the absolute base URL (no trailing slash) of the current
 * deployment. Used to build canonical/sitemap URLs.
 *
 * Resolution order:
 *   1. `NEXT_PUBLIC_SITE_URL` if set (handy for staging or custom domains).
 *   2. `VERCEL_URL` (Vercel injects this on every deploy).
 *   3. `http://localhost:3000` for local dev.
 */
export function getBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit && explicit.length > 0) {
    return stripTrailingSlash(explicit);
  }
  const vercelHost = process.env.VERCEL_URL;
  if (vercelHost && vercelHost.length > 0) {
    return `https://${vercelHost}`;
  }
  return "http://localhost:3000";
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

/**
 * Strips any HTML tags and decodes a small set of common entities.
 * Used for the description/excerpt fields where Next's metadata API
 * expects plain text.
 *
 * We intentionally do not pull in a full HTML parser here. The excerpts
 * we receive are short (a few sentences) and have already been
 * sanitized at sync time, so a tag-stripping regex is sufficient.
 */
import { stripAndDecode } from "./text";

export function stripHtml(input: string | null | undefined): string {
  // Delegate to the shared helper, then collapse runs of whitespace so
  // metadata descriptions don't carry the original line breaks from the
  // WordPress excerpt. The shared helper already covers every numeric
  // and named HTML entity via the `he` library.
  return stripAndDecode(input).replace(/\s+/g, " ").trim();
}

/** Smallest projection of a Post used for metadata + JSON-LD. */
export interface PostMetadata {
  slug: string;
  title: string;
  excerpt: string;
  link: string;
  publishedAt: string;
  modifiedAt: string;
  author: { name: string } | null;
  featuredMedia: {
    url: string;
    width: number | null;
    height: number | null;
  } | null;
}

const PostMetadataQuery = /* GraphQL */ `
  query PostMetadata($slug: String!) {
    post(slug: $slug) {
      slug
      title
      excerpt
      link
      publishedAt
      modifiedAt
      author {
        name
      }
      featuredMedia {
        url
        width
        height
      }
    }
  }
`;

interface PostMetadataResponse {
  post: PostMetadata | null;
}

/**
 * Fetches just enough fields about a single post to populate
 * `generateMetadata` and the JSON-LD `NewsArticle` block. Tag-cached
 * with the same `post:{slug}` tag the article page itself uses, so the
 * sync pipeline's `revalidateTag` invalidation cascades to metadata too.
 */
export async function getPostForMetadata(
  slug: string,
): Promise<PostMetadata | null> {
  try {
    const data = await gqlFetch<PostMetadataResponse>(
      PostMetadataQuery,
      { slug },
      { tags: [`post:${slug}`], revalidate: 60 },
    );
    return data.post;
  } catch {
    // The metadata route should never bring down a page render. If the
    // GraphQL handler is unreachable (cold-start, transient network),
    // returning null lets the caller fall back to root-level metadata.
    return null;
  }
}

/** Small projection used by sector pages to resolve a human-readable name. */
export interface SectorTermInfo {
  slug: string;
  name: string;
}

const SectorMetadataQuery = /* GraphQL */ `
  query SectorMetadata($slug: String!) {
    postsByTerm(taxonomy: SECTOR, slug: $slug, first: 1) {
      edges {
        node {
          sectors {
            slug
            name
          }
        }
      }
    }
  }
`;

interface SectorMetadataResponse {
  postsByTerm: {
    edges: {
      node: {
        sectors: { slug: string; name: string }[];
      };
    }[];
  };
}

/**
 * Resolves the canonical sector name for a given slug. Returns null if
 * no posts are tagged with that sector (or on transport failure). The
 * page falls back to a humanized form of the slug in that case.
 */
export async function getSectorNameForMetadata(
  slug: string,
): Promise<string | null> {
  try {
    const data = await gqlFetch<SectorMetadataResponse>(
      SectorMetadataQuery,
      { slug },
      { tags: [`sector:${slug}`], revalidate: 300 },
    );
    for (const edge of data.postsByTerm.edges) {
      for (const sector of edge.node.sectors) {
        if (sector.slug === slug) return sector.name;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Humanize a slug fallback (e.g. "real-estate-tech" -> "Real Estate Tech"). */
export function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}
