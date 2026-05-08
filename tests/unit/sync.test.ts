/**
 * Unit tests for the sync orchestrator. These tests use a real Neon DB
 * connection (the smoke pattern from Wave 2A), namespaced to high IDs
 * (8xxxxxxxx) so they cannot collide with WordPress data. Cleanup runs
 * before AND after each test so a prior aborted run cannot bleed in.
 *
 * Three contracts under test, all called out in the Wave 3 brief:
 *  1. Idempotency: running upsertPage twice is a no-op on row counts.
 *  2. Cursor advancement: incremental sync writes a sync_runs row and
 *     the next call's `since` is >= the prior run's max modified_gmt.
 *  3. Bearer-token rejection: the /api/sync handler returns 401 on a
 *     missing or wrong header, 200 on the right one.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

import { upsertPage, syncIncremental } from "@/src/lib/sync";
import { buildSyncDb, type SyncDbHandle } from "@/src/lib/sync-upsert";
import { authors, media, postTerms, posts, syncRuns, terms } from "@/src/db/schema";
import * as wpClient from "@/src/lib/wp-client";
import type { WpPost } from "@/src/lib/wp-client";

const TEST_AUTHOR_ID = 800000001;
const TEST_MEDIA_ID = 800000002;
const TEST_TERM_SECTOR_ID = 800000003;
const TEST_TERM_MARKET_ID = 800000004;
const TEST_POST_ID_A = 800000010;
const TEST_POST_ID_B = 800000011;

function makePost(overrides: Partial<WpPost> = {}): WpPost {
  const base: WpPost = {
    id: TEST_POST_ID_A,
    slug: "sync-test-post-a",
    date: "2026-05-08T00:00:00",
    date_gmt: "2026-05-08T00:00:00",
    modified: "2026-05-08T00:00:00",
    modified_gmt: "2026-05-08T00:00:00",
    link: "https://example.com/sync-test-post-a",
    status: "publish",
    type: "post",
    title: { rendered: "Sync Test Post A" },
    excerpt: { rendered: "<p>excerpt</p>" },
    content: { rendered: "<p>body</p><script>alert(1)</script>" },
    author: TEST_AUTHOR_ID,
    featured_media: TEST_MEDIA_ID,
    sector: [TEST_TERM_SECTOR_ID],
    market: [TEST_TERM_MARKET_ID],
    _embedded: {
      author: [
        {
          id: TEST_AUTHOR_ID,
          slug: "sync-test-author",
          name: "Sync Test Author",
          description: "test",
          avatar_urls: { "96": "https://example.com/a96.jpg", "48": "https://example.com/a48.jpg" },
        },
      ],
      "wp:featuredmedia": [
        {
          id: TEST_MEDIA_ID,
          source_url: "https://example.com/img.jpg",
          alt_text: "alt",
          media_details: {
            width: 800,
            height: 600,
            sizes: {
              full: {
                source_url: "https://example.com/img.jpg",
                width: 800,
                height: 600,
              },
              thumbnail: {
                source_url: "https://example.com/thumb.jpg",
                width: 100,
                height: 100,
              },
            },
          },
        },
      ],
      "wp:term": [
        [
          {
            id: TEST_TERM_SECTOR_ID,
            taxonomy: "sector",
            slug: "sync-test-sector",
            name: "Sync Test Sector",
          },
        ],
        [
          {
            id: TEST_TERM_MARKET_ID,
            taxonomy: "market",
            slug: "sync-test-market",
            name: "Sync Test Market",
          },
        ],
      ],
    },
  };
  return { ...base, ...overrides };
}

/**
 * Tag used on every `sync_runs` row that this test file creates so
 * cleanup can target them without false positives. Tests pass this via
 * `syncIncremental({ notes: SYNC_TEST_NOTES_TAG })`; cleanup runs a
 * single `DELETE WHERE notes LIKE 'sync-test:%'`. This avoids the
 * AND/OR precedence bug the auditor flagged in the previous version.
 */
const SYNC_TEST_NOTES_TAG = "sync-test:cursor";

async function cleanupTestData(handle: SyncDbHandle): Promise<void> {
  await handle.db.execute(
    sql`delete from post_terms where post_id in (${TEST_POST_ID_A}, ${TEST_POST_ID_B})`,
  );
  await handle.db.execute(
    sql`delete from posts where id in (${TEST_POST_ID_A}, ${TEST_POST_ID_B})`,
  );
  await handle.db.execute(
    sql`delete from terms where id in (${TEST_TERM_SECTOR_ID}, ${TEST_TERM_MARKET_ID})`,
  );
  await handle.db.execute(sql`delete from media where id = ${TEST_MEDIA_ID}`);
  await handle.db.execute(sql`delete from authors where id = ${TEST_AUTHOR_ID}`);
  await handle.db.execute(
    sql`delete from sync_runs where notes like 'sync-test:%'`,
  );
}

async function countRows(handle: SyncDbHandle): Promise<{
  posts: number;
  authors: number;
  media: number;
  terms: number;
  postTerms: number;
}> {
  const [postsRow] = await handle.db
    .select({ c: sql<number>`count(*)::int` })
    .from(posts)
    .where(sql`${posts.id} in (${TEST_POST_ID_A}, ${TEST_POST_ID_B})`);
  const [authorsRow] = await handle.db
    .select({ c: sql<number>`count(*)::int` })
    .from(authors)
    .where(sql`${authors.id} = ${TEST_AUTHOR_ID}`);
  const [mediaRow] = await handle.db
    .select({ c: sql<number>`count(*)::int` })
    .from(media)
    .where(sql`${media.id} = ${TEST_MEDIA_ID}`);
  const [termsRow] = await handle.db
    .select({ c: sql<number>`count(*)::int` })
    .from(terms)
    .where(sql`${terms.id} in (${TEST_TERM_SECTOR_ID}, ${TEST_TERM_MARKET_ID})`);
  const [postTermsRow] = await handle.db
    .select({ c: sql<number>`count(*)::int` })
    .from(postTerms)
    .where(sql`${postTerms.postId} in (${TEST_POST_ID_A}, ${TEST_POST_ID_B})`);
  return {
    posts: postsRow?.c ?? 0,
    authors: authorsRow?.c ?? 0,
    media: mediaRow?.c ?? 0,
    terms: termsRow?.c ?? 0,
    postTerms: postTermsRow?.c ?? 0,
  };
}

describe("upsertPage (idempotency)", () => {
  let handle: SyncDbHandle;

  beforeAll(() => {
    handle = buildSyncDb();
  });

  afterAll(async () => {
    await cleanupTestData(handle);
    await handle.pool.end();
  });

  beforeEach(async () => {
    await cleanupTestData(handle);
  });

  it("re-running upsertPage with the same posts produces identical row counts", async () => {
    const page: WpPost[] = [
      makePost({ id: TEST_POST_ID_A, slug: "idem-a" }),
      makePost({
        id: TEST_POST_ID_B,
        slug: "idem-b",
        modified_gmt: "2026-05-09T00:00:00",
      }),
    ];

    const first = await upsertPage(page, handle);
    expect(first.upserted).toBe(2);
    const after1 = await countRows(handle);

    const second = await upsertPage(page, handle);
    expect(second.upserted).toBe(2);
    const after2 = await countRows(handle);

    expect(after1).toEqual(after2);
    expect(after1.posts).toBe(2);
    expect(after1.authors).toBe(1);
    expect(after1.media).toBe(1);
    expect(after1.terms).toBe(2);
    expect(after1.postTerms).toBe(4);
  }, 30000);
});

describe("syncIncremental (cursor advancement)", () => {
  let handle: SyncDbHandle;

  beforeAll(() => {
    handle = buildSyncDb();
  });

  afterAll(async () => {
    await cleanupTestData(handle);
    await handle.pool.end();
  });

  beforeEach(async () => {
    await cleanupTestData(handle);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes an OK sync_runs row and the next `since` >= prior max modified_gmt", async () => {
    // Use a `modified_gmt` that is far in the future so this test post
    // becomes max(posts.modified_at) regardless of any real backfilled
    // rows already in the DB. Cursor source is `posts.modified_at` per
    // plan.md section 6.
    const POST_MODIFIED = "2099-12-31T12:00:00";
    const post = makePost({
      id: TEST_POST_ID_A,
      slug: "cursor-test",
      modified_gmt: POST_MODIFIED,
    });
    const expectedPostTime = new Date(POST_MODIFIED + "Z").getTime();

    let calls = 0;
    const getPostsSpy = vi
      .spyOn(wpClient, "getPosts")
      .mockImplementation(async () => {
        calls += 1;
        // First call: return one post. Subsequent calls: empty page.
        if (calls === 1) {
          return { posts: [post], total: 1, totalPages: 1 };
        }
        return { posts: [], total: 0, totalPages: 0 };
      });

    const result = await syncIncremental(
      { maxPages: 3, notes: SYNC_TEST_NOTES_TAG },
      handle,
    );
    expect(result.status).toBe("ok");
    expect(result.postsUpserted).toBe(1);
    expect(getPostsSpy).toHaveBeenCalled();

    // Read back sync_runs to confirm the row landed with status=ok.
    const rows = await handle.db
      .select()
      .from(syncRuns)
      .where(sql`${syncRuns.id} = ${result.runId}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("ok");

    // Cursor source is now max(posts.modified_at) - 60s, so the next
    // call's `modifiedAfter` should be (POST_MODIFIED - 60s).
    let secondModifiedAfterSeen: string | undefined;
    vi.spyOn(wpClient, "getPosts").mockImplementation(async (args) => {
      secondModifiedAfterSeen = args?.modifiedAfter;
      return { posts: [], total: 0, totalPages: 0 };
    });

    const second = await syncIncremental(
      { maxPages: 1, notes: SYNC_TEST_NOTES_TAG },
      handle,
    );
    expect(second.status).toBe("ok");
    expect(secondModifiedAfterSeen).toBeTruthy();
    const cursorTime = new Date(secondModifiedAfterSeen as string).getTime();
    // The cursor must be the upserted post's modified_at minus 60s.
    expect(cursorTime).toBe(expectedPostTime - 60_000);
    // And the cursor must be >= the prior run's recorded modified_gmt
    // minus the 60s overlap window (the contract from plan.md section 6).
    expect(cursorTime).toBeGreaterThanOrEqual(expectedPostTime - 60_000);
  }, 30000);
});

describe("/api/sync bearer-token rejection", () => {
  const ORIGINAL_TOKEN = process.env.SYNC_TOKEN;

  beforeAll(() => {
    process.env.SYNC_TOKEN = "test-token-abc-123";
  });

  afterAll(() => {
    if (ORIGINAL_TOKEN === undefined) {
      delete process.env.SYNC_TOKEN;
    } else {
      process.env.SYNC_TOKEN = ORIGINAL_TOKEN;
    }
  });

  it("returns 401 without an Authorization header", async () => {
    const route = await import("@/app/api/sync/route");
    const req = new Request("http://localhost/api/sync");
    const res = await route.GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("unauthorized");
  });

  it("returns 401 with the wrong bearer token", async () => {
    const route = await import("@/app/api/sync/route");
    const req = new Request("http://localhost/api/sync", {
      headers: { Authorization: "Bearer wrong-token" },
    });
    const res = await route.GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 with the correct bearer token", async () => {
    const route = await import("@/app/api/sync/route");
    // Stub syncIncremental so the test is fast and DB-free.
    const sync = await import("@/src/lib/sync");
    vi.spyOn(sync, "syncIncremental").mockResolvedValue({
      runId: 999,
      postsUpserted: 0,
      status: "ok",
      durationMs: 5,
    });

    const req = new Request("http://localhost/api/sync", {
      headers: { Authorization: "Bearer test-token-abc-123" },
    });
    const res = await route.GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.runId).toBe(999);
    vi.restoreAllMocks();
  });
});
