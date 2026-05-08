// One-shot DB smoke test for Wave 2A.
//
// Inserts one row into each table, runs the relational query that the
// GraphQL resolver layer will lean on, prints the result, then deletes
// the test rows so Wave 3 backfill starts from an empty schema.
//
// Run with:
//   set -a && source .env.local && set +a && pnpm tsx scripts/smoke-db.ts
import { db } from "../src/db";
import {
  authors,
  media,
  postTerms,
  posts,
  terms,
} from "../src/db/schema";
import { eq } from "drizzle-orm";

const TEST_AUTHOR_ID = 999999901;
const TEST_MEDIA_ID = 999999902;
const TEST_TERM_ID = 999999903;
const TEST_POST_ID = 999999904;

async function cleanup(): Promise<void> {
  // Delete in FK-safe order: post_terms (cascade), posts, then leaves.
  await db.delete(postTerms).where(eq(postTerms.postId, TEST_POST_ID));
  await db.delete(posts).where(eq(posts.id, TEST_POST_ID));
  await db.delete(terms).where(eq(terms.id, TEST_TERM_ID));
  await db.delete(media).where(eq(media.id, TEST_MEDIA_ID));
  await db.delete(authors).where(eq(authors.id, TEST_AUTHOR_ID));
}

async function main(): Promise<void> {
  // Always start clean in case a prior smoke run aborted halfway.
  await cleanup();

  await db.insert(authors).values({
    id: TEST_AUTHOR_ID,
    slug: "smoke-author",
    name: "Smoke Author",
    description: "smoke test author",
    avatarUrl: "https://example.com/avatar.jpg",
    raw: { test: true },
  });

  await db.insert(media).values({
    id: TEST_MEDIA_ID,
    sourceUrl: "https://example.com/image.jpg",
    altText: "smoke",
    width: 800,
    height: 600,
    sizes: { full: { url: "https://example.com/image.jpg", width: 800, height: 600 } },
    raw: { test: true },
  });

  await db.insert(terms).values({
    id: TEST_TERM_ID,
    taxonomy: "sector",
    slug: "smoke-sector",
    name: "Smoke Sector",
    raw: { test: true },
  });

  await db.insert(posts).values({
    id: TEST_POST_ID,
    slug: "smoke-post",
    title: "Smoke Post",
    excerpt: "smoke",
    excerptHtml: "<p>smoke</p>",
    contentHtml: "<p>smoke content</p>",
    status: "publish",
    type: "post",
    link: "https://example.com/smoke-post",
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    modifiedAt: new Date("2026-01-02T00:00:00Z"),
    authorId: TEST_AUTHOR_ID,
    featuredMediaId: TEST_MEDIA_ID,
    raw: { test: true },
  });

  await db.insert(postTerms).values({
    postId: TEST_POST_ID,
    termId: TEST_TERM_ID,
  });

  // The query plan.md section 7 calls out as the primary N+1 prevention.
  const hydrated = await db.query.posts.findFirst({
    where: (post, { eq: eqOp }) => eqOp(post.id, TEST_POST_ID),
    with: {
      author: true,
      featuredMedia: true,
      terms: { with: { term: true } },
    },
  });

  console.log("Relational query result:");
  console.log(JSON.stringify(hydrated, null, 2));

  await cleanup();

  console.log("Smoke test passed: hydrated post + cleanup complete.");
}

main().catch(async (err) => {
  console.error("Smoke test failed:", err);
  try {
    await cleanup();
  } catch (cleanupErr) {
    console.error("Cleanup also failed:", cleanupErr);
  }
  process.exit(1);
});
