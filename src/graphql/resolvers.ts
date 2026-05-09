/**
 * GraphQL resolvers for TRD Lite.
 *
 * Two principles, both from plan.md section 7:
 *
 * 1. List-page resolvers use Drizzle's relational query API. One call
 *    to `db.query.posts.findMany({ with: { author, featuredMedia,
 *    terms: { with: { term } } } })` plans a small fixed number of SQL
 *    statements regardless of page size, defeating the classic GraphQL
 *    N+1 pattern at the data layer instead of inside resolvers.
 *
 * 2. Per-row hydration that bypasses the relational query falls back to
 *    DataLoader (`ctx.loaders.{author,media,term}`). Loaders are built
 *    fresh per request inside `buildContext()`.
 *
 * The list resolvers normalize each row through `mapPost` so the
 * GraphQL layer never sees raw snake_case DB shapes. Field-level
 * resolvers are still defined for `Post` so detail responses stay
 * consistent regardless of which Drizzle helper produced the row.
 */
import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { GraphQLError } from "graphql";

import { decodeCursor, encodeCursor } from "./cursor";
import type { GraphQLContext } from "./context";
import {
  posts as postsTable,
  postTerms,
  syncRuns,
  terms as termsTable,
  type Author,
  type Media,
  type SyncRun,
  type Term,
} from "../db/schema";

// `searchPosts` uses an offset-based cursor instead of the keyset
// `(publishedAt, id)` cursor used elsewhere. Reason: results are
// ordered by `ts_rank`, which is not a stable column we can compare
// across pages (rank is computed per-query on the same plainto_tsquery
// input, and floating-point precision makes a tuple-cursor brittle).
// Offset is fine for a search surface where users rarely paginate
// past the first few pages and never bookmark deep links. See plan.md
// section 15 #2 honest accounting.
function encodeSearchCursor(offset: number): string {
  return Buffer.from(`offset|${offset}`, "utf-8").toString("base64");
}

function decodeSearchCursor(cursor: string): number {
  let raw: string;
  try {
    raw = Buffer.from(cursor, "base64").toString("utf-8");
  } catch {
    throw new GraphQLError("decodeSearchCursor: not valid base64", {
      extensions: { code: "BAD_CURSOR_INPUT" },
    });
  }
  if (!raw.startsWith("offset|")) {
    throw new GraphQLError("decodeSearchCursor: missing offset prefix", {
      extensions: { code: "BAD_CURSOR_INPUT" },
    });
  }
  const n = Number.parseInt(raw.slice("offset|".length), 10);
  if (!Number.isInteger(n) || n < 0) {
    throw new GraphQLError("decodeSearchCursor: invalid offset value", {
      extensions: { code: "BAD_CURSOR_INPUT" },
    });
  }
  return n;
}

// ---------- Local row shapes returned by Drizzle relational queries.
// We avoid importing `db.query.*` types directly because Drizzle's
// inferred relational result types are noisy; defining the relevant
// shape here keeps resolver signatures readable.

type TermLink = {
  termId: number;
  postId: number;
  term: Term | null;
};

type PostRowWithRelations = {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  excerptHtml: string | null;
  contentHtml: string;
  publishedAt: Date;
  modifiedAt: Date;
  link: string | null;
  authorId: number | null;
  featuredMediaId: number | null;
  author: Author | null;
  featuredMedia: Media | null;
  terms: TermLink[];
};

// ---------- The shape returned by `Post` field resolvers. We mirror
// the SDL one-for-one so resolver implementations stay in obvious
// sync with the schema string.

interface PostShape {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  excerptHtml: string;
  contentHtml: string;
  publishedAt: Date;
  modifiedAt: Date;
  link: string;
  authorId: number | null;
  featuredMediaId: number | null;
  // Pre-resolved relations from the relational query, when available.
  author: Author | null;
  featuredMedia: Media | null;
  // Bag of every linked term, separated by taxonomy in field resolvers.
  termsList: Term[];
}

// SDL enum values map directly to the `terms.taxonomy` text column.
const TAXONOMY_ENUM_TO_DB = {
  SECTOR: "sector",
  MARKET: "market",
  REGION: "region",
  NEIGHBORHOOD: "neighborhood",
  STORY_TYPE: "story_type",
  COMPANY: "company",
  PEOPLE: "people",
  TAG: "tags",
} as const;

const TAXONOMY_DB_TO_ENUM: Record<string, keyof typeof TAXONOMY_ENUM_TO_DB> = {
  sector: "SECTOR",
  market: "MARKET",
  region: "REGION",
  neighborhood: "NEIGHBORHOOD",
  story_type: "STORY_TYPE",
  company: "COMPANY",
  people: "PEOPLE",
  tags: "TAG",
};

function mapPost(row: PostRowWithRelations): PostShape {
  const termsList = row.terms
    .map((link) => link.term)
    .filter((t): t is Term => t !== null);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? "",
    excerptHtml: row.excerptHtml ?? "",
    contentHtml: row.contentHtml,
    publishedAt: row.publishedAt,
    modifiedAt: row.modifiedAt,
    link: row.link ?? "",
    authorId: row.authorId,
    featuredMediaId: row.featuredMediaId,
    author: row.author,
    featuredMedia: row.featuredMedia,
    termsList,
  };
}

// `(publishedAt, id) < (cursorPublishedAt, cursorId)` keyset pagination.
// Drizzle exposes both `lt` for the simple compare and `or/and` for the
// tie-breaker; the SQL is written long-form so it is obvious to readers
// what predicate Drizzle plans.
function cursorWhere(cursor: { publishedAt: Date; id: number }) {
  return or(
    lt(postsTable.publishedAt, cursor.publishedAt),
    and(eq(postsTable.publishedAt, cursor.publishedAt), lt(postsTable.id, cursor.id)),
  );
}

interface ConnectionArgs {
  first: number;
  after: string | null | undefined;
}

/**
 * Builds the unified posts connection used by `posts` and
 * `postsByTerm`. Accepts an optional pre-built `where` clause for the
 * taxonomy filter and applies the cursor predicate on top.
 */
async function fetchPostsConnection(
  ctx: GraphQLContext,
  args: ConnectionArgs,
  taxonomyFilter?: { taxonomy: string; slug: string },
): Promise<PostConnection> {
  const first = clampFirst(args.first);
  const cursor = args.after ? decodeCursor(args.after) : null;

  // The post id whitelist for taxonomy filtering. Implemented as a
  // pre-fetch instead of a join so we keep relational hydration intact;
  // this is one extra `WHERE post_id IN (SELECT ...)` SQL statement.
  let postIdAllowlist: number[] | null = null;
  if (taxonomyFilter) {
    const subquery = ctx.db
      .select({ postId: postTerms.postId })
      .from(postTerms)
      .innerJoin(termsTable, eq(postTerms.termId, termsTable.id))
      .where(
        and(
          eq(termsTable.taxonomy, taxonomyFilter.taxonomy),
          eq(termsTable.slug, taxonomyFilter.slug),
        ),
      );
    const allowlistRows = await subquery;
    postIdAllowlist = allowlistRows.map((r) => r.postId);
    if (postIdAllowlist.length === 0) {
      return emptyConnection();
    }
  }

  const whereClauses = [];
  if (cursor) whereClauses.push(cursorWhere(cursor));
  if (postIdAllowlist) whereClauses.push(inArray(postsTable.id, postIdAllowlist));
  // Only published posts surface in the public connection.
  whereClauses.push(eq(postsTable.status, "publish"));

  const rows = (await ctx.db.query.posts.findMany({
    limit: first + 1,
    where: whereClauses.length > 0 ? and(...whereClauses) : undefined,
    orderBy: [desc(postsTable.publishedAt), desc(postsTable.id)],
    with: {
      author: true,
      featuredMedia: true,
      terms: { with: { term: true } },
    },
  })) as unknown as PostRowWithRelations[];

  const hasNextPage = rows.length > first;
  const sliced = hasNextPage ? rows.slice(0, first) : rows;
  const edges = sliced.map((row) => ({
    cursor: encodeCursor({ publishedAt: row.publishedAt, id: row.id }),
    node: mapPost(row),
  }));
  const endCursor = edges.length > 0 ? edges[edges.length - 1]?.cursor ?? null : null;
  return {
    edges,
    pageInfo: {
      hasNextPage,
      endCursor,
    },
  };
}

function emptyConnection(): PostConnection {
  return { edges: [], pageInfo: { hasNextPage: false, endCursor: null } };
}

function clampFirst(first: number): number {
  if (!Number.isInteger(first) || first <= 0) {
    throw new GraphQLError("`first` must be a positive integer", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
  return Math.min(first, 50);
}

interface PostConnection {
  edges: { cursor: string; node: PostShape }[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

interface SearchPostConnection {
  edges: { cursor: string; node: PostShape; headline: string }[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
}

// ---------- Resolvers ----------

export const resolvers = {
  Query: {
    posts: async (
      _: unknown,
      args: { first?: number; after?: string | null; sector?: string | null; market?: string | null },
      ctx: GraphQLContext,
    ): Promise<PostConnection> => {
      const taxonomyFilter = args.sector
        ? { taxonomy: "sector", slug: args.sector }
        : args.market
          ? { taxonomy: "market", slug: args.market }
          : undefined;
      return fetchPostsConnection(
        ctx,
        { first: args.first ?? 10, after: args.after },
        taxonomyFilter,
      );
    },

    post: async (
      _: unknown,
      args: { slug: string },
      ctx: GraphQLContext,
    ): Promise<PostShape | null> => {
      // The `status = 'publish'` filter must match the list resolver
      // contract. Without it, a draft, pending, or private post that
      // happens to be in our local mirror could be retrieved by anyone
      // who knows the slug, even though `posts(...)` and `Author.posts`
      // would never list it.
      const row = (await ctx.db.query.posts.findFirst({
        where: and(
          eq(postsTable.slug, args.slug),
          eq(postsTable.status, "publish"),
        ),
        with: {
          author: true,
          featuredMedia: true,
          terms: { with: { term: true } },
        },
      })) as unknown as PostRowWithRelations | undefined;
      if (!row) return null;
      return mapPost(row);
    },

    sectors: async (
      _: unknown,
      __: unknown,
      ctx: GraphQLContext,
    ): Promise<Term[]> => {
      return ctx.db
        .select()
        .from(termsTable)
        .where(eq(termsTable.taxonomy, "sector"))
        .orderBy(termsTable.name);
    },

    markets: async (
      _: unknown,
      __: unknown,
      ctx: GraphQLContext,
    ): Promise<Term[]> => {
      return ctx.db
        .select()
        .from(termsTable)
        .where(eq(termsTable.taxonomy, "market"))
        .orderBy(termsTable.name);
    },

    postsByTerm: async (
      _: unknown,
      args: { taxonomy: keyof typeof TAXONOMY_ENUM_TO_DB; slug: string; first?: number; after?: string | null },
      ctx: GraphQLContext,
    ): Promise<PostConnection> => {
      const dbTaxonomy = TAXONOMY_ENUM_TO_DB[args.taxonomy];
      if (!dbTaxonomy) {
        throw new GraphQLError(`Unknown taxonomy: ${args.taxonomy}`, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      return fetchPostsConnection(
        ctx,
        { first: args.first ?? 10, after: args.after },
        { taxonomy: dbTaxonomy, slug: args.slug },
      );
    },

    /**
     * Postgres FTS over the generated `search_vector` column. Two SQL
     * statements: (1) rank-then-id ordered ID list with offset/limit,
     * (2) one relational hydration that pulls authors/media/terms in
     * one go. Re-orders the hydrated rows by the rank order from step
     * (1) so ts_rank decides edge order, not Drizzle's join planner.
     *
     * Empty / whitespace-only `query` returns an empty connection
     * without ever touching SQL: WP search UIs commonly send `?q=`
     * during typeahead and we should not treat that as an error.
     *
     * `args.query` is interpolated via Drizzle's `sql` template so it
     * is parameter-bound (no string concatenation). `plainto_tsquery`
     * is the right entry point for user input: it tolerates arbitrary
     * text where `to_tsquery` would throw on operators or punctuation.
     */
    searchPosts: async (
      _: unknown,
      args: { query: string; first?: number; after?: string | null },
      ctx: GraphQLContext,
    ): Promise<SearchPostConnection> => {
      const trimmed = (args.query ?? "").trim();
      if (trimmed.length === 0) {
        return { edges: [], pageInfo: { hasNextPage: false, endCursor: null } };
      }
      const first = clampFirst(args.first ?? 10);
      const offset = args.after ? decodeSearchCursor(args.after) : 0;

      // Step 1: ranked id list + a ts_headline snippet per row. The
      // headline corpus strips HTML tags out of `content_html` (a
      // regexp_replace, not a true parse) before concatenating with
      // `excerpt`, so the highlighted output never includes orphaned
      // tag fragments. ts_headline produces text with `<mark>...</mark>`
      // wrappers that the UI renders inline. The neon-http driver
      // returns pg-style results; we read `.rows`.
      const rankedResult = (await ctx.db.execute(sql`
        SELECT
          id,
          ts_rank(search_vector, plainto_tsquery('english', ${trimmed})) AS rank,
          ts_headline(
            'english',
            coalesce(excerpt, '') || ' ' || regexp_replace(coalesce(content_html, ''), '<[^>]+>', ' ', 'g'),
            plainto_tsquery('english', ${trimmed}),
            'StartSel="<mark>", StopSel="</mark>", MaxWords=24, MinWords=10, ShortWord=2, MaxFragments=1, FragmentDelimiter=" ... "'
          ) AS headline
        FROM posts
        WHERE status = 'publish'
          AND search_vector @@ plainto_tsquery('english', ${trimmed})
        ORDER BY rank DESC, id DESC
        LIMIT ${first + 1}
        OFFSET ${offset}
      `)) as unknown as {
        rows: { id: number | string; rank: number; headline: string | null }[];
      };
      const rankedRows = rankedResult.rows ?? [];

      const hasNextPage = rankedRows.length > first;
      const sliced = hasNextPage ? rankedRows.slice(0, first) : rankedRows;
      if (sliced.length === 0) {
        return { edges: [], pageInfo: { hasNextPage: false, endCursor: null } };
      }

      const orderedIds = sliced.map((r) => Number(r.id));
      const headlineById = new Map<number, string>(
        sliced.map((r) => [Number(r.id), r.headline ?? ""] as const),
      );

      // Step 2: hydrate via the relational query so author/media/terms
      // come back in the same shape every other resolver returns.
      const rows = (await ctx.db.query.posts.findMany({
        where: inArray(postsTable.id, orderedIds),
        with: {
          author: true,
          featuredMedia: true,
          terms: { with: { term: true } },
        },
      })) as unknown as PostRowWithRelations[];

      // Re-sort hydrated rows back into rank order (Drizzle's `where
      // in` does not preserve list order).
      const byId = new Map(rows.map((r) => [r.id, r] as const));
      const ordered = orderedIds
        .map((id) => byId.get(id))
        .filter((r): r is PostRowWithRelations => r !== undefined);

      const edges = ordered.map((row, idx) => ({
        cursor: encodeSearchCursor(offset + idx + 1),
        node: mapPost(row),
        headline: headlineById.get(row.id) ?? "",
      }));
      const endCursor =
        edges.length > 0 ? edges[edges.length - 1]?.cursor ?? null : null;
      return {
        edges,
        pageInfo: {
          hasNextPage,
          endCursor,
        },
      };
    },

    syncStatus: async (
      _: unknown,
      __: unknown,
      ctx: GraphQLContext,
    ): Promise<{
      lastRunAt: Date | null;
      lastSuccessAt: Date | null;
      postCount: number;
      status: string;
    }> => {
      const [latest] = await ctx.db
        .select()
        .from(syncRuns)
        .orderBy(desc(syncRuns.id))
        .limit(1);
      const [latestOk] = await ctx.db
        .select()
        .from(syncRuns)
        .where(eq(syncRuns.status, "ok"))
        .orderBy(desc(syncRuns.id))
        .limit(1);
      const [countRow] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(postsTable);
      return {
        lastRunAt: latest?.startedAt ?? null,
        lastSuccessAt: latestOk?.finishedAt ?? null,
        postCount: countRow?.count ?? 0,
        status: latest?.status ?? "idle",
      };
    },

    recentSyncRuns: async (
      _: unknown,
      args: { limit?: number | null; offset?: number | null },
      ctx: GraphQLContext,
    ): Promise<SyncRun[]> => {
      const requested = typeof args.limit === "number" ? args.limit : 20;
      // Clamp to a sane window so a malformed client cannot ask for the
      // full sync_runs history in one go.
      const limit = Math.min(Math.max(requested, 1), 100);
      const offsetIn = typeof args.offset === "number" ? args.offset : 0;
      const offset = Math.max(0, Math.floor(offsetIn));
      const rows = await ctx.db
        .select()
        .from(syncRuns)
        .orderBy(desc(syncRuns.id))
        .limit(limit)
        .offset(offset);
      return rows;
    },

    syncRunCount: async (
      _: unknown,
      __: unknown,
      ctx: GraphQLContext,
    ): Promise<number> => {
      const [row] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(syncRuns);
      return row?.count ?? 0;
    },
  },

  Post: {
    // Field resolvers map the post-shape into the SDL surface. We keep
    // them explicit so any Drizzle row shape (relational vs. raw) can
    // be handed to the GraphQL engine without surprises.
    id: (parent: PostShape): string => String(parent.id),
    sectors: (parent: PostShape): Term[] =>
      parent.termsList.filter((t) => t.taxonomy === "sector"),
    markets: (parent: PostShape): Term[] =>
      parent.termsList.filter((t) => t.taxonomy === "market"),
    people: (parent: PostShape): Term[] =>
      parent.termsList.filter((t) => t.taxonomy === "people"),
    companies: (parent: PostShape): Term[] =>
      parent.termsList.filter((t) => t.taxonomy === "company"),
    tags: (parent: PostShape): Term[] =>
      parent.termsList.filter((t) => t.taxonomy === "tags"),
    author: async (
      parent: PostShape,
      _: unknown,
      ctx: GraphQLContext,
    ): Promise<Author | null> => {
      // If the relational query already hydrated `author`, reuse it.
      // Otherwise fall through to DataLoader. This shape lets the
      // detail-page resolver and the homepage resolver share the same
      // field-resolver and stay correct for both.
      if (parent.author) return parent.author;
      if (parent.authorId === null) return null;
      return ctx.loaders.author.load(parent.authorId);
    },
    featuredMedia: async (
      parent: PostShape,
      _: unknown,
      ctx: GraphQLContext,
    ): Promise<Media | null> => {
      if (parent.featuredMedia) return parent.featuredMedia;
      if (parent.featuredMediaId === null) return null;
      return ctx.loaders.media.load(parent.featuredMediaId);
    },
  },

  Term: {
    id: (parent: Term): string => String(parent.id),
    taxonomy: (parent: Term): string => {
      const enumName = TAXONOMY_DB_TO_ENUM[parent.taxonomy];
      if (!enumName) {
        // Defensive: WP could theoretically return a taxonomy we don't
        // know about. The resolver should fail loud rather than emit
        // an invalid enum value into the GraphQL response.
        throw new GraphQLError(
          `Unknown taxonomy in DB row: ${parent.taxonomy}`,
          { extensions: { code: "INTERNAL_SERVER_ERROR" } },
        );
      }
      return enumName;
    },
  },

  Author: {
    id: (parent: Author): string => String(parent.id),
    posts: async (
      parent: Author,
      args: { first?: number; after?: string | null },
      ctx: GraphQLContext,
    ): Promise<PostConnection> => {
      const first = clampFirst(args.first ?? 10);
      const cursor = args.after ? decodeCursor(args.after) : null;
      const where = and(
        eq(postsTable.authorId, parent.id),
        eq(postsTable.status, "publish"),
        cursor ? cursorWhere(cursor) : undefined,
      );
      const rows = (await ctx.db.query.posts.findMany({
        limit: first + 1,
        where,
        orderBy: [desc(postsTable.publishedAt), desc(postsTable.id)],
        with: {
          author: true,
          featuredMedia: true,
          terms: { with: { term: true } },
        },
      })) as unknown as PostRowWithRelations[];
      const hasNextPage = rows.length > first;
      const sliced = hasNextPage ? rows.slice(0, first) : rows;
      const edges = sliced.map((row) => ({
        cursor: encodeCursor({ publishedAt: row.publishedAt, id: row.id }),
        node: mapPost(row),
      }));
      return {
        edges,
        pageInfo: {
          hasNextPage,
          endCursor: edges[edges.length - 1]?.cursor ?? null,
        },
      };
    },
  },

  SyncRun: {
    // The DB shape uses nullable defaults for `posts_upserted`, `errors`,
    // and `status`; the SDL surfaces them as non-null because every real
    // row has a value. Coerce nulls to safe sentinels here so the
    // GraphQL engine never has to drop the row entirely on a stale value.
    id: (parent: SyncRun): string => String(parent.id),
    postsUpserted: (parent: SyncRun): number => parent.postsUpserted ?? 0,
    errors: (parent: SyncRun): number => parent.errors ?? 0,
    status: (parent: SyncRun): string => parent.status ?? "unknown",
  },

  Media: {
    id: (parent: Media): string => String(parent.id),
    url: (parent: Media): string => parent.sourceUrl,
    alt: (parent: Media): string | null => parent.altText,
    width: (parent: Media): number | null => parent.width,
    height: (parent: Media): number | null => parent.height,
    sizes: (
      parent: Media,
    ): { name: string; url: string; width: number; height: number }[] => {
      const sizesObj = (parent.sizes ?? {}) as Record<
        string,
        { url?: string; width?: number; height?: number }
      >;
      const out: { name: string; url: string; width: number; height: number }[] = [];
      for (const [name, value] of Object.entries(sizesObj)) {
        if (
          value &&
          typeof value.url === "string" &&
          typeof value.width === "number" &&
          typeof value.height === "number"
        ) {
          out.push({
            name,
            url: value.url,
            width: value.width,
            height: value.height,
          });
        }
      }
      return out;
    },
  },
};
