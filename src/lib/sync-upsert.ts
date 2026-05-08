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

import { sanitizeArticleHtml } from "./sanitize";
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

  try {
    await localHandle.db.transaction(async (tx) => {
      const mediaItems = collectMedia(pageData);
      // Set of media IDs we successfully collected from the embed.
      // Posts whose `featured_media` does not appear here (because the
      // media was deleted/restricted upstream and WP returned an error
      // envelope) get `null` to avoid FK violations.
      const knownMediaIds = new Set(mediaItems.map((m) => m.id));
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
              title: p.title.rendered,
              excerpt: p.excerpt.rendered.replace(/<[^>]*>/g, "").trim(),
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
