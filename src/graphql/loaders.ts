/**
 * Per-request DataLoader factories for entities the resolver layer has
 * to hydrate outside the relational query path.
 *
 * Plan.md section 7 calls these the "fallback" layer: list-page
 * resolvers use `db.query.posts.findMany({ with: { ... } })` to fetch
 * the post + author + media + terms graph in one trip, but standalone
 * field resolvers (e.g., a custom `Post.author` resolver that runs
 * independently per parent row) would otherwise re-issue N queries.
 * DataLoader batches and caches those for the lifetime of one request.
 *
 * Loaders MUST be created per-request inside `buildContext()`. Sharing
 * loaders across requests would leak data between unrelated GraphQL
 * operations.
 */
import DataLoader from "dataloader";
import { inArray } from "drizzle-orm";

import { db } from "../db";
import {
  authors as authorsTable,
  media as mediaTable,
  terms as termsTable,
  type Author,
  type Media,
  type Term,
} from "../db/schema";

// TODO: thread db through loader factories so measure-queries.ts can
// count loader hits. Today the loaders import the production `db`
// singleton directly, which means the counting db built by the
// measurement script does not see queries fired through DataLoader.
// Current resolvers do not trigger loader fallbacks (the relational
// query already hydrates author/media/term), so the recorded counts
// in docs/measurements/query-counts.md stay accurate; revisit when a
// future resolver actually uses one.
export type AuthorLoader = DataLoader<number, Author | null>;
export type MediaLoader = DataLoader<number, Media | null>;
export type TermLoader = DataLoader<number, Term | null>;

/**
 * Batches author lookups by id. The batch fn receives every id requested
 * during the current tick, fires one `WHERE id IN (...)` query, and
 * returns a row (or null) for each id, in input order, as the
 * DataLoader contract requires.
 */
export function makeAuthorLoader(): AuthorLoader {
  return new DataLoader<number, Author | null>(async (ids) => {
    if (ids.length === 0) return [];
    const rows = await db
      .select()
      .from(authorsTable)
      .where(inArray(authorsTable.id, [...ids]));
    const byId = new Map<number, Author>(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id) ?? null);
  });
}

export function makeMediaLoader(): MediaLoader {
  return new DataLoader<number, Media | null>(async (ids) => {
    if (ids.length === 0) return [];
    const rows = await db
      .select()
      .from(mediaTable)
      .where(inArray(mediaTable.id, [...ids]));
    const byId = new Map<number, Media>(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id) ?? null);
  });
}

export function makeTermLoader(): TermLoader {
  return new DataLoader<number, Term | null>(async (ids) => {
    if (ids.length === 0) return [];
    const rows = await db
      .select()
      .from(termsTable)
      .where(inArray(termsTable.id, [...ids]));
    const byId = new Map<number, Term>(rows.map((r) => [r.id, r]));
    return ids.map((id) => byId.get(id) ?? null);
  });
}
