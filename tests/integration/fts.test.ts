/**
 * FTS integration tests (Wave 10A bonus). Two contracts:
 *
 * 1. Empty / whitespace-only `query` returns an empty connection
 *    without raising. Common in typeahead UIs where the field
 *    momentarily holds whitespace.
 *
 * 2. Two synthetic posts with controlled wording are inserted and
 *    queried. The post whose title contains the search term every
 *    time scores higher than the post that mentions it once buried in
 *    `content_html`. Asserts that ts_rank decides the order.
 *
 * Tests insert with high IDs (>900_000_000) so they cannot collide
 * with backfilled WP rows even if cleanup misses. `afterAll` always
 * runs the delete in case a test failed mid-way.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createYoga } from "graphql-yoga";
import { sql } from "drizzle-orm";

import { schema } from "@/src/graphql/schema";
import { buildContext } from "@/src/graphql/context";
import { db } from "@/src/db";
import { posts } from "@/src/db/schema";

const yoga = createYoga({
  schema,
  context: () => buildContext(),
  graphqlEndpoint: "/api/graphql",
  graphiql: false,
  fetchAPI: { Response, Request },
});

async function run<T = Record<string, unknown>>(
  source: string,
  variableValues?: Record<string, unknown>,
): Promise<{ data: T | null | undefined; errors?: readonly { message: string }[] }> {
  const req = new Request("http://localhost/api/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query: source, variables: variableValues ?? {} }),
  });
  const res = await yoga.fetch(req);
  const json = (await res.json()) as {
    data?: T | null;
    errors?: readonly { message: string }[];
  };
  return { data: json.data ?? null, errors: json.errors };
}

// Picked to be obviously synthetic and rare in any real corpus so the
// rank assertion is not perturbed by background data.
const TOKEN = "ftsalpacaxyzzy";
const HIGH_RANK_POST_ID = 950_000_001;
const LOW_RANK_POST_ID = 950_000_002;
const HIGH_RANK_SLUG = "fts-test-high-rank-do-not-publish";
const LOW_RANK_SLUG = "fts-test-low-rank-do-not-publish";

describe("GraphQL: searchPosts (Postgres FTS)", () => {
  beforeAll(async () => {
    // High-rank: token in title (highest FTS weight) + body.
    await db
      .insert(posts)
      .values({
        id: HIGH_RANK_POST_ID,
        slug: HIGH_RANK_SLUG,
        title: `${TOKEN} ${TOKEN} headline about ${TOKEN}`,
        excerpt: `Excerpt mentions ${TOKEN}`,
        excerptHtml: `<p>Excerpt mentions ${TOKEN}</p>`,
        contentHtml: `<p>${TOKEN} appears multiple times in the body. ${TOKEN}.</p>`,
        status: "publish",
        type: "post",
        link: "https://example.com/fts-high",
        publishedAt: new Date("2026-05-08T00:00:00Z"),
        modifiedAt: new Date("2026-05-08T00:00:00Z"),
        authorId: null,
        featuredMediaId: null,
        raw: { test: "fts-high" },
      })
      .onConflictDoNothing();
    // Low-rank: token only in body, once.
    await db
      .insert(posts)
      .values({
        id: LOW_RANK_POST_ID,
        slug: LOW_RANK_SLUG,
        title: "An ordinary headline with no special tokens",
        excerpt: "Plain excerpt",
        excerptHtml: "<p>Plain excerpt</p>",
        contentHtml: `<p>Buried far down the body, the word ${TOKEN} appears once.</p>`,
        status: "publish",
        type: "post",
        link: "https://example.com/fts-low",
        publishedAt: new Date("2026-05-08T00:00:00Z"),
        modifiedAt: new Date("2026-05-08T00:00:00Z"),
        authorId: null,
        featuredMediaId: null,
        raw: { test: "fts-low" },
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db.execute(
      sql`delete from posts where id in (${HIGH_RANK_POST_ID}, ${LOW_RANK_POST_ID})`,
    );
  });

  it("returns matches ordered by ts_rank (title beats body)", async () => {
    const query = /* GraphQL */ `
      query Search($q: String!) {
        searchPosts(query: $q, first: 10) {
          edges {
            node {
              id
              slug
              title
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;
    const { data, errors } = await run<{
      searchPosts: {
        edges: { node: { id: string; slug: string; title: string } }[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    }>(query, { q: TOKEN });

    expect(errors).toBeUndefined();
    const slugs = (data?.searchPosts.edges ?? []).map((e) => e.node.slug);
    // Both seeded rows must appear in the result set.
    expect(slugs).toContain(HIGH_RANK_SLUG);
    expect(slugs).toContain(LOW_RANK_SLUG);
    // The high-rank row (token in title) must come before the low-rank
    // row (token only in body). ts_rank weights title much higher than
    // content because of the default 'A','B','C','D' weight tuple in
    // ts_rank applied to to_tsvector output.
    const highIdx = slugs.indexOf(HIGH_RANK_SLUG);
    const lowIdx = slugs.indexOf(LOW_RANK_SLUG);
    expect(highIdx).toBeGreaterThanOrEqual(0);
    expect(lowIdx).toBeGreaterThanOrEqual(0);
    expect(highIdx).toBeLessThan(lowIdx);
  }, 30_000);

  it("returns an empty connection (no error) for blank query", async () => {
    const query = /* GraphQL */ `
      query Search($q: String!) {
        searchPosts(query: $q, first: 10) {
          edges {
            node {
              id
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;
    const { data, errors } = await run<{
      searchPosts: {
        edges: unknown[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    }>(query, { q: "   " });
    expect(errors).toBeUndefined();
    expect(data?.searchPosts.edges).toHaveLength(0);
    expect(data?.searchPosts.pageInfo.hasNextPage).toBe(false);
    expect(data?.searchPosts.pageInfo.endCursor).toBeNull();
  }, 30_000);
});
