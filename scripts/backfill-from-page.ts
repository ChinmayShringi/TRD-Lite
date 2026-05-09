// One-off: fetch older posts starting from a specific WP page (skipping the
// most-recent ones we already mirrored) and upsert them. The default backfill
// always starts at page 1, which is wasted work when the local DB already
// has the most-recent N posts. Read BACKFILL_START_PAGE / BACKFILL_END_PAGE /
// BACKFILL_PER_PAGE / BACKFILL_TARGET (stop early once posts table reaches
// this size) from env. After Wave 9 we no longer need this and it can be
// deleted.
import "dotenv/config";

import { sql } from "drizzle-orm";

import { db } from "../src/db";
import { posts as postsTable } from "../src/db/schema";
import { logger } from "../src/lib/logger";
import { upsertPage } from "../src/lib/sync-upsert";
import { getPosts, sleep } from "../src/lib/wp-client";

async function publishCount(): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(postsTable)
    .where(sql`${postsTable.status} = 'publish'`);
  return rows[0]?.c ?? 0;
}

async function main() {
  const startPage = Number(process.env.BACKFILL_START_PAGE ?? "35");
  const endPage = Number(process.env.BACKFILL_END_PAGE ?? "70");
  const perPage = Number(process.env.BACKFILL_PER_PAGE ?? "10");
  const target = Number(process.env.BACKFILL_TARGET ?? "500");
  const initial = await publishCount();
  logger.info({ startPage, endPage, perPage, target, initial }, "offset backfill starting");

  let totalUpserted = 0;
  for (let page = startPage; page <= endPage; page++) {
    const r = await getPosts({ page, perPage, orderBy: "date", order: "desc" });
    if (r.posts.length === 0) {
      logger.info({ page }, "empty page, stopping");
      break;
    }
    const before = await publishCount();
    await upsertPage(r.posts);
    const after = await publishCount();
    const newRows = after - before;
    totalUpserted += r.posts.length;
    logger.info(
      { page, fetched: r.posts.length, newPublishedRows: newRows, totalUpserted, publishCount: after },
      "page complete",
    );
    if (after >= target) {
      logger.info({ after, target }, "reached target, stopping");
      break;
    }
    await sleep(1000);
  }
  const final = await publishCount();
  logger.info({ initial, final, totalUpserted }, "offset backfill done");
  process.exit(0);
}

main().catch((err: unknown) => {
  logger.error({ err: err instanceof Error ? err.message : String(err) }, "offset backfill failed");
  process.exit(1);
});
