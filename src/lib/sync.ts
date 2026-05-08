/**
 * Sync orchestrator. Pulls posts from WordPress (via wp-client) and
 * upserts in dependency order via `upsertPage` (sync-upsert.ts):
 * media -> authors -> terms -> posts -> post_terms.
 *
 * Idempotency model (plan.md section 6): every write goes through
 * `INSERT ... ON CONFLICT (id) DO UPDATE`, so re-running with the same
 * input is a no-op semantically. Any DB row that the WP payload no
 * longer contains is deliberately left in place; delete detection is a
 * known limitation listed in the plan.
 *
 * This file owns paging, cursor strategy, sync_runs bookkeeping, and
 * Next.js cache invalidation. The transactional upsert lives in
 * `sync-upsert.ts` so each file stays under the 400-line cap.
 */
import { sql } from "drizzle-orm";
import { revalidateTag } from "next/cache";

import { cacheTags, tagsForPost } from "./cache-tags";
import { logger } from "./logger";
import {
  buildSyncDb,
  upsertPage,
  type SyncDbHandle,
} from "./sync-upsert";
// Imported as a namespace so tests can `vi.spyOn(wpClient, "getPosts")`
// to inject controlled responses without touching the network. Direct
// named imports would bind at module load and bypass the spy.
import * as wpClient from "./wp-client";
import {
  sleep,
  type GetPostsArgs,
  type WpPost,
} from "./wp-client";
import { posts as postsTable, syncRuns } from "../db/schema";

interface IncrementalOptions {
  since?: Date;
  perPage?: number;
  maxPages?: number;
  /**
   * Optional notes string written to `sync_runs.notes`. Tests use this
   * to tag rows so cleanup is deterministic; production callers leave
   * it blank.
   */
  notes?: string;
}

interface BackfillOptions {
  limit?: number;
  perPage?: number;
}

export interface IncrementalResult {
  runId: number;
  postsUpserted: number;
  status: "ok" | "failed";
  durationMs: number;
}

export interface BackfillResult {
  runId: number;
  postsUpserted: number;
  durationMs: number;
}

/**
 * Fires the configured cache tags for every upserted post. Wrapped in
 * try/catch because `revalidateTag()` raises if called outside a Next
 * request context (e.g. from `scripts/sync.ts`). Failing to invalidate
 * is not fatal; the time-based fallback will eventually catch up.
 */
function invalidateTagsForPosts(allPosts: WpPost[]): void {
  const allTags = new Set<string>();
  for (const post of allPosts) {
    for (const tag of tagsForPost(post)) {
      allTags.add(tag);
    }
  }
  for (const tag of allTags) {
    try {
      revalidateTag(tag);
    } catch (err) {
      logger.warn(
        { tag, err: err instanceof Error ? err.message : String(err) },
        "revalidateTag failed (likely outside Next request context)",
      );
    }
  }
}

/**
 * Returns the cursor for the next incremental sync: max
 * `posts.modified_at` from prior runs, minus 60s overlap (plan.md §6).
 * The 60-second window covers WP's clock skew and any sub-second posts
 * that landed inside the previous run's read window. Returning `null`
 * for an empty `posts` table tells the caller to omit `modified_after`,
 * which is the correct behaviour on a fresh DB (full backfill).
 */
async function readCursor(handle: SyncDbHandle): Promise<Date | null> {
  const rows = await handle.db
    .select({ at: sql<Date | null>`max(${postsTable.modifiedAt})` })
    .from(postsTable);
  const max = rows[0]?.at ?? null;
  if (!max) return null;
  return new Date(new Date(max).getTime() - 60_000);
}

/**
 * Cron-driven incremental sync. Cursor source: max `posts.modified_at`
 * from prior runs, minus 60s overlap. Pages forward through WP until it
 * sees an empty page or hits `maxPages`, and writes a single
 * `sync_runs` record with the final status.
 */
export async function syncIncremental(
  opts: IncrementalOptions = {},
  injectedHandle?: SyncDbHandle,
): Promise<IncrementalResult> {
  const ownsHandle = injectedHandle === undefined;
  const handle = injectedHandle ?? buildSyncDb();
  const startedAt = new Date();
  const perPage = opts.perPage ?? 100;
  const maxPages = opts.maxPages ?? 10;

  let modifiedAfter: Date | null = opts.since ?? null;
  if (!modifiedAfter) {
    modifiedAfter = await readCursor(handle);
  }

  const [runRow] = await handle.db
    .insert(syncRuns)
    .values({
      startedAt,
      modifiedAfter: modifiedAfter ?? null,
      postsUpserted: 0,
      errors: 0,
      status: "running",
      notes: opts.notes ?? null,
    })
    .returning({ id: syncRuns.id });

  if (!runRow) {
    if (ownsHandle) await handle.pool.end();
    throw new Error("failed to insert sync_runs row");
  }
  const runId = runRow.id;
  let postsUpserted = 0;
  let errors = 0;
  let status: "ok" | "failed" = "ok";
  const allTouched: WpPost[] = [];

  try {
    for (let page = 1; page <= maxPages; page += 1) {
      const args: GetPostsArgs = {
        page,
        perPage,
        orderBy: "modified",
        order: "asc",
        ...(modifiedAfter ? { modifiedAfter: modifiedAfter.toISOString() } : {}),
      };
      const { posts: pagePosts } = await wpClient.getPosts(args);
      if (pagePosts.length === 0) break;
      const { upserted } = await upsertPage(pagePosts, handle);
      postsUpserted += upserted;
      allTouched.push(...pagePosts);
      if (pagePosts.length < perPage) break;
      await sleep(500);
    }
    invalidateTagsForPosts(allTouched);
  } catch (err) {
    status = "failed";
    errors += 1;
    const errMsg = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && err.cause ? String(err.cause) : undefined;
    logger.error(
      {
        err: errMsg.slice(0, 500),
        cause: cause?.slice(0, 500),
        runId,
      },
      "syncIncremental failed",
    );
  }

  const finishedAt = new Date();
  await handle.db
    .update(syncRuns)
    .set({
      finishedAt,
      postsUpserted,
      errors,
      status,
    })
    .where(sql`${syncRuns.id} = ${runId}`);

  if (ownsHandle) await handle.pool.end();
  return {
    runId,
    postsUpserted,
    status,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  };
}

/**
 * One-shot backfill driver for `scripts/backfill.ts`. Pages through the
 * most recent posts (orderby=date, desc) until `limit` posts have been
 * upserted. Sleeps 1s between pages to be polite to WP's cache layer.
 */
export async function backfill(
  opts: BackfillOptions = {},
): Promise<BackfillResult> {
  const handle = buildSyncDb();
  const startedAt = new Date();
  const limit = opts.limit ?? 500;
  const perPage = Math.min(opts.perPage ?? 100, 100);

  const [runRow] = await handle.db
    .insert(syncRuns)
    .values({
      startedAt,
      postsUpserted: 0,
      errors: 0,
      status: "running",
      notes: `backfill limit=${limit}`,
    })
    .returning({ id: syncRuns.id });

  if (!runRow) {
    await handle.pool.end();
    throw new Error("failed to insert sync_runs row");
  }
  const runId = runRow.id;

  let totalUpserted = 0;
  let errors = 0;
  let status: "ok" | "failed" = "ok";

  try {
    let page = 1;
    while (totalUpserted < limit) {
      const remaining = limit - totalUpserted;
      const args: GetPostsArgs = {
        page,
        perPage: Math.min(perPage, remaining),
        orderBy: "date",
        order: "desc",
      };
      const { posts: pagePosts } = await wpClient.getPosts(args);
      if (pagePosts.length === 0) break;
      const slice = pagePosts.slice(0, remaining);
      const { upserted } = await upsertPage(slice, handle);
      totalUpserted += upserted;
      logger.info(
        { page, upsertedThisPage: upserted, totalUpserted, limit },
        "backfill page complete",
      );
      if (pagePosts.length < perPage) break;
      page += 1;
      await sleep(1000);
    }
    // Nudge homepage cache; per-slug tags would be excessive here.
    try {
      revalidateTag(cacheTags.homepage());
    } catch {
      // Backfill always runs from a script, so this is expected.
    }
  } catch (err) {
    status = "failed";
    errors += 1;
    const errMsg = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error && err.cause ? String(err.cause) : undefined;
    logger.error(
      {
        err: errMsg.slice(0, 500),
        cause: cause?.slice(0, 500),
        runId,
      },
      "backfill failed",
    );
  }

  const finishedAt = new Date();
  await handle.db
    .update(syncRuns)
    .set({
      finishedAt,
      postsUpserted: totalUpserted,
      errors,
      status,
    })
    .where(sql`${syncRuns.id} = ${runId}`);

  await handle.pool.end();
  return {
    runId,
    postsUpserted: totalUpserted,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  };
}

// Re-export upsertPage for tests that drive the inner loop directly.
export { upsertPage } from "./sync-upsert";
