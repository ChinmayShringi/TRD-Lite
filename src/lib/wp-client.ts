/**
 * Typed wrapper around the WordPress REST endpoint at
 * `${WP_BASE_URL}/posts`. Always sends `_embed=1` so each response
 * carries author, featured media, and term objects, turning N+1
 * lookups into a single round trip (plan.md section 2).
 *
 * Behaviour the caller relies on:
 *  - Retries with exponential backoff on 5xx, 429, and network errors
 *    (3 attempts total, 500ms base delay, +/- 20% jitter).
 *  - Does NOT retry on other 4xx responses; those are surfaced as
 *    `WpClientError` so the caller can bail fast.
 *  - `total` and `totalPages` are read from `X-WP-Total` and
 *    `X-WP-TotalPages` so paginated callers (Wave 3 backfill) can plan
 *    their loop without a probe request.
 *  - The function never sleeps between calls. The caller decides
 *    pagination cadence; `sleep(ms)` is exported for that purpose.
 *
 * No caching, de-duplication, or persistence happens here. Those are
 * Wave 3+ concerns layered on top of this primitive.
 */

const DEFAULT_BASE_URL = "https://therealdeal.com/wp-json/wp/v2";
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const JITTER_RATIO = 0.2;

export interface WpRendered {
  rendered: string;
  protected?: boolean;
}

export interface WpUser {
  id: number;
  slug: string;
  name: string;
  description?: string;
  url?: string;
  link?: string;
  avatar_urls?: Record<string, string>;
}

export interface WpMediaSize {
  source_url: string;
  width: number;
  height: number;
  file?: string;
  mime_type?: string;
}

export interface WpMediaDetails {
  width?: number;
  height?: number;
  file?: string;
  sizes?: Record<string, WpMediaSize>;
}

/**
 * Featured media can come back as either a real media object or as a
 * WP REST error envelope (`{ code, message, data }`) when the media has
 * been deleted or restricted. Callers should narrow on `source_url`.
 */
export interface WpMedia {
  id?: number;
  source_url?: string;
  alt_text?: string;
  media_type?: string;
  mime_type?: string;
  media_details?: WpMediaDetails;
  // Error-envelope shape, when WP could not embed the media:
  code?: string;
  message?: string;
  data?: unknown;
}

export interface WpTerm {
  id: number;
  taxonomy: string;
  slug: string;
  name: string;
  link?: string;
}

export interface WpEmbedded {
  author?: WpUser[];
  "wp:featuredmedia"?: WpMedia[];
  /** Outer array is per-taxonomy, inner array is the terms in that taxonomy. */
  "wp:term"?: WpTerm[][];
  "acf:user"?: unknown[];
}

export interface WpPost {
  id: number;
  slug: string;
  date: string;
  date_gmt: string;
  modified: string;
  modified_gmt: string;
  link: string;
  status: string;
  type: string;
  title: WpRendered;
  excerpt: WpRendered;
  content: WpRendered;
  author: number;
  featured_media: number;
  // Taxonomies: each is an array of term IDs.
  market?: number[];
  neighborhood?: number[];
  region?: number[];
  sector?: number[];
  story_type?: number[];
  company?: number[];
  people?: number[];
  tags?: number[];
  _embedded?: WpEmbedded;
  // Allow the unknown bag of WP plugin extras (yoast, parsely, acf, etc.)
  // without forcing every consumer to enumerate them.
  [extra: string]: unknown;
}

export interface GetPostsArgs {
  page?: number;
  perPage?: number;
  /** ISO-8601 string. Sent as `modified_after`. */
  modifiedAfter?: string;
  orderBy?: "date" | "modified";
  order?: "asc" | "desc";
  /** Optional AbortSignal, primarily for tests. */
  signal?: AbortSignal;
}

export interface GetPostsResult {
  posts: WpPost[];
  total: number;
  totalPages: number;
}

export class WpClientError extends Error {
  readonly status?: number;
  readonly attempts: number;
  readonly url: string;

  constructor(message: string, opts: { status?: number; attempts: number; url: string; cause?: unknown }) {
    super(message);
    this.name = "WpClientError";
    this.status = opts.status;
    this.attempts = opts.attempts;
    this.url = opts.url;
    if (opts.cause !== undefined) {
      (this as { cause?: unknown }).cause = opts.cause;
    }
  }
}

function getBaseUrl(): string {
  const fromEnv = process.env.WP_BASE_URL;
  if (typeof fromEnv === "string" && fromEnv.length > 0) {
    return fromEnv.replace(/\/+$/, "");
  }
  return DEFAULT_BASE_URL;
}

function buildPostsUrl(args: GetPostsArgs): string {
  const params = new URLSearchParams();
  params.set("_embed", "1");
  params.set("per_page", String(args.perPage ?? 10));
  params.set("page", String(args.page ?? 1));
  if (args.modifiedAfter) {
    params.set("modified_after", args.modifiedAfter);
  }
  if (args.orderBy) {
    params.set("orderby", args.orderBy);
  }
  if (args.order) {
    params.set("order", args.order);
  }
  return `${getBaseUrl()}/posts?${params.toString()}`;
}

function isRetriableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

function jitteredDelay(attempt: number): number {
  // Exponential backoff: 500ms, 1000ms, 2000ms, ... with +/- 20% jitter.
  const base = BASE_DELAY_MS * 2 ** attempt;
  const jitter = base * JITTER_RATIO * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(base + jitter));
}

/**
 * Sleep helper. Exposed so the backfill loop can pace itself between
 * pages (default 1000ms in callers) without `getPosts` itself adding
 * latency to single-page fetches.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseIntHeader(headers: Headers, name: string): number {
  const raw = headers.get(name);
  if (raw === null) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getPosts(args: GetPostsArgs = {}): Promise<GetPostsResult> {
  const url = buildPostsUrl(args);

  let lastError: unknown;
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: args.signal,
      });

      if (response.ok) {
        const total = parseIntHeader(response.headers, "x-wp-total");
        const totalPages = parseIntHeader(response.headers, "x-wp-totalpages");
        const posts = (await response.json()) as WpPost[];
        return { posts, total, totalPages };
      }

      lastStatus = response.status;
      // Drain the body so the connection can be reused.
      try {
        await response.text();
      } catch {
        // ignore drain errors
      }

      if (!isRetriableStatus(response.status)) {
        throw new WpClientError(
          `WP REST request failed with status ${response.status}`,
          { status: response.status, attempts: attempt + 1, url },
        );
      }
    } catch (err) {
      // If it's already a non-retriable WpClientError, rethrow now.
      if (err instanceof WpClientError && err.status !== undefined && !isRetriableStatus(err.status)) {
        throw err;
      }
      lastError = err;
    }

    // If this was the final attempt, stop sleeping.
    if (attempt < MAX_ATTEMPTS - 1) {
      await sleep(jitteredDelay(attempt));
    }
  }

  if (lastStatus !== undefined) {
    throw new WpClientError(
      `WP REST request failed after ${MAX_ATTEMPTS} attempts (last status ${lastStatus})`,
      { status: lastStatus, attempts: MAX_ATTEMPTS, url, cause: lastError },
    );
  }
  throw new WpClientError(
    `WP REST request failed after ${MAX_ATTEMPTS} attempts (network error)`,
    { attempts: MAX_ATTEMPTS, url, cause: lastError },
  );
}
