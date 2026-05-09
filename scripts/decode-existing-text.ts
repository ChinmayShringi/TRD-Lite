// One-shot: decode HTML entities in `posts.title` and `posts.excerpt`
// for rows that were synced before src/lib/text.ts was wired in. Future
// sync passes already store decoded plain text via decodeText /
// stripAndDecode in src/lib/sync-upsert.ts; this script catches up the
// historical 509 rows so the JSX text rendering of `<h1>{post.title}</h1>`
// and the card excerpts no longer show literal `&#8220;` etc.
//
// Idempotent: re-running this with already-decoded text is a no-op
// because `he.decode` returns the same input when no entities are
// present, and we only UPDATE rows whose decoded value actually
// differs.

import "dotenv/config";

import { sql } from "drizzle-orm";

import { db } from "../src/db";
import { posts as postsTable } from "../src/db/schema";
import { logger } from "../src/lib/logger";
import { decodeText, stripAndDecode } from "../src/lib/text";

interface Row {
  id: number;
  title: string;
  excerpt: string | null;
  excerpt_html: string | null;
}

async function main(): Promise<void> {
  const rows = (await db
    .select({
      id: postsTable.id,
      title: postsTable.title,
      excerpt: postsTable.excerpt,
      excerptHtml: postsTable.excerptHtml,
    })
    .from(postsTable)) as Array<{
    id: number;
    title: string;
    excerpt: string | null;
    excerptHtml: string | null;
  }>;

  let updated = 0;
  let scanned = 0;
  for (const r of rows) {
    scanned += 1;
    const newTitle = decodeText(r.title);
    // Re-derive the excerpt from `excerpt_html` (the source of truth in
    // the DB) rather than from `excerpt` so we get a clean strip + decode
    // even if a previous sync stored a half-stripped value.
    const newExcerpt = stripAndDecode(r.excerptHtml ?? r.excerpt ?? "");
    if (newTitle === r.title && newExcerpt === (r.excerpt ?? "")) continue;
    await db.execute(
      sql`UPDATE posts SET title = ${newTitle}, excerpt = ${newExcerpt} WHERE id = ${r.id}`,
    );
    updated += 1;
  }
  logger.info({ scanned, updated }, "decode-existing-text done");
  process.exit(0);
}

main().catch((err: unknown) => {
  logger.error(
    { err: err instanceof Error ? err.message : String(err) },
    "decode-existing-text failed",
  );
  process.exit(1);
});
