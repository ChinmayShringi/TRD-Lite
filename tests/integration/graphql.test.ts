/**
 * GraphQL integration tests. These exercise the schema directly via
 * `graphql()` (no HTTP server, no Yoga) to keep them fast and so a
 * Vitest run does not depend on the Next.js dev server being up.
 *
 * Three contracts under test (Wave 4 brief):
 * 1. `post(slug)` with a real DB slug returns a hydrated post.
 * 2. `posts(first: 5)` returns 5 edges with cursors and `hasNextPage`.
 * 3. Pagination round-trip: a second page fetched via `after: endCursor`
 *    contains different IDs from the first page.
 *
 * Plus a syncStatus smoke test that the resolver returns `postCount > 0`.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createYoga } from "graphql-yoga";
import { sql } from "drizzle-orm";

import { schema } from "@/src/graphql/schema";
import { buildContext } from "@/src/graphql/context";
import { db } from "@/src/db";
import { posts } from "@/src/db/schema";
import { desc, eq } from "drizzle-orm";

// Use Yoga's `fetch` interface to execute operations without standing
// up an HTTP server. Yoga internally uses the same `graphql` instance
// the schema was built against, which sidesteps the dual-instance
// "Cannot use GraphQLSchema from another module or realm" footgun that
// Vitest's ESM/CJS resolver hits when calling `graphql()` directly.
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
  return {
    data: json.data ?? null,
    errors: json.errors,
  };
}

async function pickRealSlug(): Promise<string> {
  const [row] = await db
    .select({ slug: posts.slug })
    .from(posts)
    .where(eq(posts.status, "publish"))
    .orderBy(desc(posts.publishedAt))
    .limit(1);
  if (!row) {
    throw new Error("graphql.test.ts: no posts in DB; run scripts/backfill.ts first");
  }
  return row.slug;
}

describe("GraphQL: post(slug)", () => {
  it("returns a hydrated post for a real slug from the DB", async () => {
    const slug = await pickRealSlug();
    const query = /* GraphQL */ `
      query Post($slug: String!) {
        post(slug: $slug) {
          id
          slug
          title
          publishedAt
          author {
            id
            name
          }
          featuredMedia {
            id
            url
          }
          sectors {
            id
            slug
            name
            taxonomy
          }
        }
      }
    `;
    const { data, errors } = await run<{ post: { slug: string; title: string } | null }>(
      query,
      { slug },
    );
    expect(errors).toBeUndefined();
    expect(data?.post).toBeTruthy();
    expect(data?.post?.slug).toBe(slug);
    expect(typeof data?.post?.title).toBe("string");
  }, 30_000);

  it("returns null for an unknown slug", async () => {
    const query = /* GraphQL */ `
      query Post($slug: String!) {
        post(slug: $slug) {
          id
        }
      }
    `;
    const { data, errors } = await run<{ post: unknown }>(query, {
      slug: "this-slug-definitely-does-not-exist-12345",
    });
    expect(errors).toBeUndefined();
    expect(data?.post).toBeNull();
  }, 30_000);
});

describe("GraphQL: post(slug) status filter (regression)", () => {
  // High id outside the range any WP backfill would touch so the test
  // row cannot collide with real data even if cleanup misses.
  const DRAFT_POST_ID = 800500001;
  const DRAFT_SLUG = "graphql-test-draft-post-do-not-publish";

  beforeAll(async () => {
    // Insert a non-published row directly. The post(slug) resolver must
    // refuse to return it; the contract matches `posts(...)` and
    // `Author.posts` which both already gate on status='publish'.
    await db
      .insert(posts)
      .values({
        id: DRAFT_POST_ID,
        slug: DRAFT_SLUG,
        title: "Draft (should never be returned)",
        excerpt: "",
        excerptHtml: "",
        contentHtml: "<p>secret</p>",
        status: "draft",
        type: "post",
        link: "https://example.com/draft",
        publishedAt: new Date("2026-05-08T00:00:00Z"),
        modifiedAt: new Date("2026-05-08T00:00:00Z"),
        authorId: null,
        featuredMediaId: null,
        raw: { test: true },
      })
      .onConflictDoNothing();
  });

  afterAll(async () => {
    await db.execute(sql`delete from posts where id = ${DRAFT_POST_ID}`);
  });

  it("returns null when the matching row has status != 'publish'", async () => {
    const query = /* GraphQL */ `
      query Post($slug: String!) {
        post(slug: $slug) {
          id
          slug
        }
      }
    `;
    const { data, errors } = await run<{ post: unknown }>(query, {
      slug: DRAFT_SLUG,
    });
    expect(errors).toBeUndefined();
    expect(data?.post).toBeNull();
  }, 30_000);
});

describe("GraphQL: posts pagination", () => {
  it("returns N edges with cursors and a sane pageInfo", async () => {
    const query = /* GraphQL */ `
      query Posts($first: Int!) {
        posts(first: $first) {
          edges {
            cursor
            node {
              id
              slug
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
      posts: {
        edges: { cursor: string; node: { id: string; slug: string } }[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    }>(query, { first: 5 });
    expect(errors).toBeUndefined();
    expect(data?.posts.edges).toHaveLength(5);
    for (const edge of data?.posts.edges ?? []) {
      expect(typeof edge.cursor).toBe("string");
      expect(edge.cursor.length).toBeGreaterThan(0);
      expect(typeof edge.node.id).toBe("string");
      expect(typeof edge.node.slug).toBe("string");
    }
    // We have at least 48 backfilled posts, so 5 < total => hasNextPage true.
    expect(data?.posts.pageInfo.hasNextPage).toBe(true);
    expect(typeof data?.posts.pageInfo.endCursor).toBe("string");
  }, 30_000);

  it("paginates a second page that does not overlap the first", async () => {
    const firstQuery = /* GraphQL */ `
      query Posts($first: Int!) {
        posts(first: $first) {
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
    const firstResult = await run<{
      posts: {
        edges: { node: { id: string } }[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    }>(firstQuery, { first: 5 });
    expect(firstResult.errors).toBeUndefined();
    const firstIds = new Set(
      (firstResult.data?.posts.edges ?? []).map((e) => e.node.id),
    );
    expect(firstIds.size).toBe(5);
    const cursor = firstResult.data?.posts.pageInfo.endCursor;
    expect(cursor).toBeTruthy();

    const nextQuery = /* GraphQL */ `
      query Posts($first: Int!, $after: String) {
        posts(first: $first, after: $after) {
          edges {
            node {
              id
            }
          }
        }
      }
    `;
    const nextResult = await run<{
      posts: { edges: { node: { id: string } }[] };
    }>(nextQuery, { first: 5, after: cursor });
    expect(nextResult.errors).toBeUndefined();
    const nextIds = new Set(
      (nextResult.data?.posts.edges ?? []).map((e) => e.node.id),
    );
    // No overlap between page 1 and page 2.
    for (const id of nextIds) {
      expect(firstIds.has(id)).toBe(false);
    }
    expect(nextIds.size).toBeGreaterThan(0);
  }, 30_000);
});

describe("GraphQL: syncStatus", () => {
  it("returns a postCount greater than zero on the seeded DB", async () => {
    const query = /* GraphQL */ `
      query {
        syncStatus {
          lastRunAt
          lastSuccessAt
          postCount
          status
        }
      }
    `;
    const { data, errors } = await run<{
      syncStatus: {
        lastRunAt: string | null;
        lastSuccessAt: string | null;
        postCount: number;
        status: string;
      };
    }>(query);
    expect(errors).toBeUndefined();
    expect(data?.syncStatus.postCount).toBeGreaterThan(0);
    expect(typeof data?.syncStatus.status).toBe("string");
  }, 30_000);
});
