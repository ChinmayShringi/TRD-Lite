/**
 * Per-page upsert pipeline. Split out from `sync.ts` so each file stays
 * focused: this file only knows how to map a `WpPost[]` page into our
 * normalized tables and write it inside one transaction. The
 * orchestrator (`sync.ts`) owns paging, cursor strategy, and Next.js
 * cache invalidation.
 *
 * Driver choice: this module imports `drizzle-orm/neon-serverless`, the
 * WebSocket driver, because the HTTP driver used by the rest of the app
 * cannot batch a page of upserts into a single transaction. Each page
 * is one DB transaction so partial failures roll back cleanly and the
 * cursor never advances past a half-applied page.
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

import { fetchOgImage, type OgImageResult } from "./og-image";
import { sanitizeArticleHtml } from "./sanitize";
import { decodeText, stripAndDecode } from "./text";
import {
  isMediaSuccess,
  type WpMediaSuccess,
  type WpPost,
  type WpTerm,
  type WpUser,
} from "./wp-client";
import {
  authors,
  media,
  postTerms,
  posts,
  terms,
} from "../db/schema";
import * as schema from "../db/schema";
import * as relations from "../db/relations";

// Neon's WebSocket driver requires a Node `ws` polyfill. Set once at
// import time; the assignment is idempotent.
neonConfig.webSocketConstructor = ws;

const TAXONOMY_FIELDS = [
  "sector",
  "market",
  "region",
  "neighborhood",
  "story_type",
  "company",
  "people",
  "tags",
] as const;

export type SyncDb = ReturnType<typeof drizzle<typeof schema & typeof relations>>;

export interface SyncDbHandle {
  db: SyncDb;
  pool: Pool;
}

export function buildSyncDb(): SyncDbHandle {
  const connectionString =
    process.env.DATABASE_URL ?? process.env.DATABASE_URL_UNPOOLED;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL or DATABASE_URL_UNPOOLED must be set for sync. Run `vercel env pull .env.local`.",
    );
  }
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema: { ...schema, ...relations } });
  return { db, pool };
}

function pickAvatar(avatarUrls?: Record<string, string>): string | null {
  if (!avatarUrls) return null;
  return (
    avatarUrls["96"] ?? avatarUrls["48"] ?? avatarUrls["24"] ?? Object.values(avatarUrls)[0] ?? null
  );
}

function buildSizesJson(detail: WpMediaSuccess): Record<string, unknown> {
  const sizes = detail.media_details?.sizes ?? {};
  const out: Record<string, { url: string; width: number; height: number }> = {};
  for (const [name, value] of Object.entries(sizes)) {
    out[name] = {
      url: value.source_url,
      width: value.width,
      height: value.height,
    };
  }
  // Always include `full` from the top-level source_url, even if WP
  // omits it from media_details.sizes.
  if (!out.full) {
    out.full = {
      url: detail.source_url,
      width: detail.media_details?.width ?? 0,
      height: detail.media_details?.height ?? 0,
    };
  }
  return out;
}

function collectMedia(allPosts: WpPost[]): WpMediaSuccess[] {
  const byId = new Map<number, WpMediaSuccess>();
  for (const post of allPosts) {
    const embedded = post._embedded?.["wp:featuredmedia"] ?? [];
    for (const item of embedded) {
      if (isMediaSuccess(item) && !byId.has(item.id)) {
        byId.set(item.id, item);
      }
    }
  }
  return Array.from(byId.values());
}

/**
 * Builds a synthetic `WpMediaSuccess`-shaped object from an og:image
 * scrape so it can flow through the existing `media` upsert path with
 * no special casing. The `id` is the WP `featured_media` numeric id WP
 * told us about even though WP itself refuses to serve the row; reusing
 * that id keeps the FK from `posts.featured_media_id` intact and makes
 * the fallback transparent to the GraphQL/UI layer.
 */
function ogImageToSynthetic(
  id: number,
  og: OgImageResult,
): WpMediaSuccess {
  return {
    id,
    source_url: og.url,
    alt_text: og.alt ?? undefined,
    media_details: {
      width: og.width ?? undefined,
      height: og.height ?? undefined,
      sizes: {},
    },
  };
}

/**
 * For each post whose `featured_media` id was not delivered by the WP
 * embed, scrape the canonical post URL once and turn the og:image into
 * a synthetic media row. Concurrency is capped so a page of 100 posts
 * cannot fan out into 100 simultaneous outbound HTTP connections.
 */
async function fetchOgImageFallbacks(
  pageData: WpPost[],
  knownMediaIds: ReadonlySet<number>,
  concurrency = 5,
): Promise<WpMediaSuccess[]> {
  type PendingPost = { id: number; mediaId: number; link: string };
  const dedupedById = new Map<number, PendingPost>();
  for (const p of pageData) {
    if (
      p.featured_media > 0 &&
      !knownMediaIds.has(p.featured_media) &&
      typeof p.link === "string" &&
      p.link.length > 0
    ) {
      // First post wins for a shared restricted media id; later posts
      // reuse the same scrape result via `knownMediaIds` membership in
      // the caller.
      if (!dedupedById.has(p.featured_media)) {
        dedupedById.set(p.featured_media, {
          id: p.id,
          mediaId: p.featured_media,
          link: p.link,
        });
      }
    }
  }
  const pending = Array.from(dedupedById.values());
  if (pending.length === 0) return [];

  const out: WpMediaSuccess[] = [];
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < pending.length) {
      const idx = cursor;
      cursor += 1;
      const item = pending[idx];
      if (!item) continue;
      const og = await fetchOgImage(item.link);
      if (og) out.push(ogImageToSynthetic(item.mediaId, og));
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, pending.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return out;
}

function collectAuthors(allPosts: WpPost[]): WpUser[] {
  const byId = new Map<number, WpUser>();
  for (const post of allPosts) {
    const embedded = post._embedded?.author ?? [];
    for (const author of embedded) {
      if (!byId.has(author.id)) {
        byId.set(author.id, author);
      }
    }
  }
  return Array.from(byId.values());
}

function collectTerms(allPosts: WpPost[]): WpTerm[] {
  const byId = new Map<number, WpTerm>();
  for (const post of allPosts) {
    const groups = post._embedded?.["wp:term"] ?? [];
    for (const group of groups) {
      for (const term of group as WpTerm[]) {
        if (!byId.has(term.id)) {
          byId.set(term.id, term);
        }
      }
    }
  }
  return Array.from(byId.values());
}

function collectPostTerms(post: WpPost): { postId: number; termId: number }[] {
  const ids = new Set<number>();
  for (const field of TAXONOMY_FIELDS) {
    const list = post[field];
    if (Array.isArray(list)) {
      for (const id of list) {
        if (typeof id === "number") {
          ids.add(id);
        }
      }
    }
  }
  return Array.from(ids).map((termId) => ({ postId: post.id, termId }));
}

/**
 * Dedupes a WP page by post id. A single batch with the same id twice
 * would trigger postgres's `cardinality violation: ON CONFLICT DO
 * UPDATE command cannot affect row a second time` error. Last write
 * wins (the later occurrence supersedes the earlier in this page).
 */
function dedupeById(pageData: WpPost[]): WpPost[] {
  const byId = new Map<number, WpPost>();
  for (const post of pageData) {
    byId.set(post.id, post);
  }
  return Array.from(byId.values());
}

/**
 * Upserts one full WP page (up to 100 posts) into the DB inside a
 * single transaction. Order is media -> authors -> terms -> posts ->
 * post_terms so foreign keys are satisfied at every step.
 */
export async function upsertPage(
  rawPageData: WpPost[],
  handle?: SyncDbHandle,
): Promise<{ upserted: number }> {
  if (rawPageData.length === 0) return { upserted: 0 };
  const pageData = dedupeById(rawPageData);
  const ownsHandle = handle === undefined;
  const localHandle = handle ?? buildSyncDb();

  // Collect media from the embed payload first, then fill any gaps via
  // og:image scraping. Both happen BEFORE we open the DB transaction so
  // network latency never holds a Postgres row lock.
  const embedMedia = collectMedia(pageData);
  const embedKnownIds = new Set(embedMedia.map((m) => m.id));
  const ogFallbackMedia = await fetchOgImageFallbacks(
    pageData,
    embedKnownIds,
  );
  // Merge keeping the embed item if both sources resolve to the same id
  // (embed has full size variants; og:image only has `full`).
  const mediaItems: WpMediaSuccess[] = [...embedMedia];
  const seenMediaIds = new Set(embedKnownIds);
  for (const m of ogFallbackMedia) {
    if (!seenMediaIds.has(m.id)) {
      mediaItems.push(m);
      seenMediaIds.add(m.id);
    }
  }

  try {
    await localHandle.db.transaction(async (tx) => {
      // Set of media IDs we successfully collected (embed + og:image
      // fallback). Posts whose `featured_media` does not appear here
      // get `null` on `featured_media_id` to avoid FK violations.
      const knownMediaIds = seenMediaIds;
      const knownAuthorIds = new Set<number>();
      if (mediaItems.length > 0) {
        await tx
          .insert(media)
          .values(
            mediaItems.map((m) => ({
              id: m.id,
              sourceUrl: m.source_url,
              altText: m.alt_text ?? null,
              width: m.media_details?.width ?? null,
              height: m.media_details?.height ?? null,
              sizes: buildSizesJson(m),
              raw: m as unknown as Record<string, unknown>,
            })),
          )
          .onConflictDoUpdate({
            target: media.id,
            set: {
              sourceUrl: sql`excluded.source_url`,
              altText: sql`excluded.alt_text`,
              width: sql`excluded.width`,
              height: sql`excluded.height`,
              sizes: sql`excluded.sizes`,
              raw: sql`excluded.raw`,
            },
          });
      }

      const authorRows = collectAuthors(pageData);
      for (const author of authorRows) knownAuthorIds.add(author.id);
      if (authorRows.length > 0) {
        await tx
          .insert(authors)
          .values(
            authorRows.map((a) => ({
              id: a.id,
              slug: a.slug,
              name: a.name,
              description: a.description ?? null,
              avatarUrl: pickAvatar(a.avatar_urls),
              raw: a as unknown as Record<string, unknown>,
            })),
          )
          .onConflictDoUpdate({
            target: authors.id,
            set: {
              slug: sql`excluded.slug`,
              name: sql`excluded.name`,
              description: sql`excluded.description`,
              avatarUrl: sql`excluded.avatar_url`,
              raw: sql`excluded.raw`,
            },
          });
      }

      const termRows = collectTerms(pageData);
      const knownTermIds = new Set(termRows.map((t) => t.id));
      if (termRows.length > 0) {
        await tx
          .insert(terms)
          .values(
            termRows.map((t) => ({
              id: t.id,
              taxonomy: t.taxonomy,
              slug: t.slug,
              name: t.name,
              raw: t as unknown as Record<string, unknown>,
            })),
          )
          .onConflictDoUpdate({
            target: terms.id,
            set: {
              taxonomy: sql`excluded.taxonomy`,
              slug: sql`excluded.slug`,
              name: sql`excluded.name`,
              raw: sql`excluded.raw`,
            },
          });
      }

      // Posts: sanitize content_html on write so the DB never holds
      // dangerous HTML (plan.md section 9.5). Foreign keys to authors
      // and media are nulled when the embed payload did not produce a
      // matching parent row (deleted/restricted upstream content).
      await tx
        .insert(posts)
        .values(
          pageData.map((p) => {
            const featuredMediaId =
              p.featured_media > 0 && knownMediaIds.has(p.featured_media)
                ? p.featured_media
                : null;
            const authorId =
              p.author > 0 && knownAuthorIds.has(p.author) ? p.author : null;
            return {
              id: p.id,
              slug: p.slug,
              title: decodeText(p.title.rendered),
              excerpt: stripAndDecode(p.excerpt.rendered),
              excerptHtml: p.excerpt.rendered,
              contentHtml: sanitizeArticleHtml(p.content.rendered),
              status: p.status,
              type: p.type,
              link: p.link,
              publishedAt: new Date(p.date_gmt + "Z"),
              modifiedAt: new Date(p.modified_gmt + "Z"),
              authorId,
              featuredMediaId,
              raw: p as unknown as Record<string, unknown>,
              syncedAt: new Date(),
            };
          }),
        )
        .onConflictDoUpdate({
          target: posts.id,
          set: {
            slug: sql`excluded.slug`,
            title: sql`excluded.title`,
            excerpt: sql`excluded.excerpt`,
            excerptHtml: sql`excluded.excerpt_html`,
            contentHtml: sql`excluded.content_html`,
            status: sql`excluded.status`,
            type: sql`excluded.type`,
            link: sql`excluded.link`,
            publishedAt: sql`excluded.published_at`,
            modifiedAt: sql`excluded.modified_at`,
            authorId: sql`excluded.author_id`,
            featuredMediaId: sql`excluded.featured_media_id`,
            raw: sql`excluded.raw`,
            syncedAt: sql`excluded.synced_at`,
          },
        });

      // post_terms is filtered by knownTermIds because some posts
      // reference taxonomy term IDs whose term object did not appear in
      // the embed payload (e.g. trashed terms, or taxonomies that WP
      // omits from `_embedded["wp:term"]`). Inserting those would
      // violate the FK to `terms.id`.
      const ptRows = pageData
        .flatMap((p) => collectPostTerms(p))
        .filter((row) => knownTermIds.has(row.termId));
      if (ptRows.length > 0) {
        await tx.insert(postTerms).values(ptRows).onConflictDoNothing();
      }
    });
  } finally {
    if (ownsHandle) {
      await localHandle.pool.end();
    }
  }

  return { upserted: pageData.length };
}
