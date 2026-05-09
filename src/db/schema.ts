// Drizzle schema for TRD Lite. Mirrors the relevant subset of WordPress
// REST data into a queryable shape. See plan.md section 5 for the full
// rationale (why bigint for WP IDs, why JSONB raw payloads, why a single
// `terms` table with a taxonomy discriminator instead of 8 join tables).
//
// TypeScript exports use camelCase; database identifiers use snake_case.
// All bigint columns use `mode: 'number'` so JS receives plain numbers
// (every WP ID safely fits under 2^53).
import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Custom Drizzle type for Postgres `tsvector`. Drizzle does not ship a
 * built-in tsvector helper as of v0.45, so we declare one here. The
 * column itself is generated and STORED at the SQL level (see
 * `drizzle/0001_search_vector.sql`); we only need Drizzle to know it
 * exists so it appears on `Post`'s inferred row type.
 */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

/**
 * `posts` mirrors WordPress posts. `raw` keeps the original payload so we
 * can re-derive columns later without a full backfill.
 */
export const posts = pgTable(
  "posts",
  {
    id: bigint("id", { mode: "number" }).primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    excerptHtml: text("excerpt_html"),
    contentHtml: text("content_html").notNull(),
    status: text("status").notNull(),
    type: text("type").notNull(),
    link: text("link"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull(),
    authorId: bigint("author_id", { mode: "number" }).references(
      () => authors.id,
    ),
    featuredMediaId: bigint("featured_media_id", { mode: "number" }).references(
      () => media.id,
    ),
    raw: jsonb("raw").notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    // Generated STORED tsvector. Maintained automatically by Postgres
    // from `coalesce(title,'') || ' ' || coalesce(excerpt,'') || ' ' ||
    // coalesce(content_html,'')`. We never write to it directly. See
    // `drizzle/0001_search_vector.sql` for the generated-expression
    // definition and the GIN index that backs `searchPosts`.
    searchVector: tsvector("search_vector"),
  },
  (table) => [
    index("posts_published_at_idx").on(table.publishedAt.desc()),
    index("posts_modified_at_idx").on(table.modifiedAt.desc()),
    index("posts_status_published_at_idx").on(
      table.status,
      table.publishedAt.desc(),
    ),
  ],
);

/**
 * `authors` mirrors the embedded WP author objects (one per WP user).
 */
export const authors = pgTable("authors", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  avatarUrl: text("avatar_url"),
  raw: jsonb("raw").notNull(),
});

/**
 * `media` holds featured-image entries. `sizes` is a JSONB map from a
 * size name (thumbnail, medium, large, ...) to `{url, width, height}`.
 */
export const media = pgTable("media", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  sourceUrl: text("source_url").notNull(),
  altText: text("alt_text"),
  width: integer("width"),
  height: integer("height"),
  sizes: jsonb("sizes").notNull(),
  raw: jsonb("raw").notNull(),
});

/**
 * `terms` collapses every WP taxonomy (sector, market, region, ...) into
 * one table with a `taxonomy` discriminator. Cleaner than 8 join tables.
 */
export const terms = pgTable(
  "terms",
  {
    id: bigint("id", { mode: "number" }).primaryKey(),
    taxonomy: text("taxonomy").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    raw: jsonb("raw").notNull(),
  },
  (table) => [
    uniqueIndex("terms_taxonomy_slug_unique").on(table.taxonomy, table.slug),
    index("terms_taxonomy_idx").on(table.taxonomy),
  ],
);

/**
 * `post_terms` is the M:N bridge between posts and terms. ON DELETE
 * CASCADE on both sides so cleaning a post or term removes its bridges.
 */
export const postTerms = pgTable(
  "post_terms",
  {
    postId: bigint("post_id", { mode: "number" })
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    termId: bigint("term_id", { mode: "number" })
      .notNull()
      .references(() => terms.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.postId, table.termId] }),
    index("post_terms_term_id_idx").on(table.termId),
  ],
);

/**
 * `sync_runs` is the operational log for incremental sync. The
 * `/sync-status` page reads this. `status` is text (not pg enum) so
 * adding new values later does not require a migration.
 */
export const syncRuns = pgTable("sync_runs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  modifiedAfter: timestamp("modified_after", { withTimezone: true }),
  postsUpserted: integer("posts_upserted").default(0),
  errors: integer("errors").default(0),
  status: text("status"),
  notes: text("notes"),
});

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Author = typeof authors.$inferSelect;
export type NewAuthor = typeof authors.$inferInsert;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type Term = typeof terms.$inferSelect;
export type NewTerm = typeof terms.$inferInsert;
export type PostTerm = typeof postTerms.$inferSelect;
export type NewPostTerm = typeof postTerms.$inferInsert;
export type SyncRun = typeof syncRuns.$inferSelect;
export type NewSyncRun = typeof syncRuns.$inferInsert;
