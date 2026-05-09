/**
 * og:image fallback for WordPress posts whose `wp:featuredmedia` embed
 * returns a 401 / 403 error envelope. Scrapes the canonical TRD URL once
 * per affected post and reads the OpenGraph image meta tag.
 *
 * Why scrape: TRD's storefront SSRs `<meta property="og:image">` from a
 * different image pipeline than the REST API. When a media item is
 * restricted in WP (publisher locked it post-publish), the storefront
 * meta still resolves. Scraping lets us recover the hero image without
 * any auth on our end.
 *
 * Trade-off: one extra HTTP request per affected post during sync. We
 * cap concurrency in the caller and always cache the result by writing
 * a synthetic row into the `media` table keyed by `featured_media` id,
 * so re-syncs are no-ops once the fallback has succeeded.
 */

const META_FETCH_TIMEOUT_MS = 8_000;
const USER_AGENT =
  "TRD-Lite/1.0 (+https://github.com/ChinmayShringi/TRD-Lite) sync-bot";

export interface OgImageResult {
  url: string;
  width: number | null;
  height: number | null;
  alt: string | null;
}

/**
 * Pulls a single meta property value from rendered HTML. Tolerates both
 * `property="..." content="..."` and the flipped `content="..." property="..."`
 * orderings, plus single/double quote variants. Returns the first match.
 */
function extractMeta(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+property=["']${escaped}["'][^>]*content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]*property=["']${escaped}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match && match[1]) return match[1].trim();
  }
  return null;
}

function parseIntOrNull(value: string | null): number | null {
  if (value === null) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Parses the og:image cluster out of a rendered HTML document. Exposed
 * for unit testing without an HTTP fetch.
 */
export function parseOgImageFromHtml(html: string): OgImageResult | null {
  const url = extractMeta(html, "og:image");
  if (!url) return null;
  return {
    url,
    width: parseIntOrNull(extractMeta(html, "og:image:width")),
    height: parseIntOrNull(extractMeta(html, "og:image:height")),
    alt: extractMeta(html, "og:image:alt"),
  };
}

/**
 * Fetches a canonical post URL and extracts the og:image metadata.
 * Returns null on any non-2xx response, network error, timeout, or
 * missing meta tag. Never throws; sync should treat a missing fallback
 * as "no hero image, render the placeholder" rather than as a failure.
 */
export async function fetchOgImage(
  canonicalUrl: string,
  init: { signal?: AbortSignal } = {},
): Promise<OgImageResult | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), META_FETCH_TIMEOUT_MS);
  if (init.signal) {
    init.signal.addEventListener("abort", () => controller.abort(), {
      once: true,
    });
  }
  try {
    const response = await fetch(canonicalUrl, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const html = await response.text();
    return parseOgImageFromHtml(html);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
