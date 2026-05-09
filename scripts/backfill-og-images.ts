// One-shot: for each post whose `featured_media_id` is null but whose
// raw WP payload tells us a `featured_media` id was assigned upstream,
// scrape og:image from the canonical post URL and fill in a synthetic
// row in `media` so the article page renders a hero image.
//
// Idempotent: re-running skips posts that already have a featured_media_id
// AND skips posts whose canonical fetch returns no og:image. The script
// caps concurrency so a 500-row backfill cannot DoS the upstream site.
//
// Why this exists: when WP returns a 401 error envelope inside the
// `_embed` payload for a post's featured media, the regular sync path
// stores `featured_media_id = null` (FK safety). The og:image fallback
// in `src/lib/sync-upsert.ts` covers new sync passes; this script back-
// fills the rows that pre-date that change.
import "dotenv/config";

import { isNull, sql } from "drizzle-orm";

import { db } from "../src/db";
import { media as mediaTable, posts as postsTable } from "../src/db/schema";
import { logger } from "../src/lib/logger";
import { fetchOgImage } from "../src/lib/og-image";

interface CandidateRow {
  id: number;
  link: string | null;
  raw: { featured_media?: number } | null;
}

const CONCURRENCY = 4;

async function main(): Promise<void> {
  // Pull every post that currently has no featured_media_id. We only
  // attempt the fallback when the raw WP payload told us a media id
  // existed upstream (otherwise the article was published without a
  // hero and og:image would be a different image, e.g. the site logo).
  const rows = (await db
    .select({
      id: postsTable.id,
      link: postsTable.link,
      raw: postsTable.raw,
    })
    .from(postsTable)
    .where(isNull(postsTable.featuredMediaId))) as CandidateRow[];

  const candidates = rows.filter(
    (r) =>
      typeof r.link === "string" &&
      r.link.length > 0 &&
      typeof r.raw?.featured_media === "number" &&
      r.raw.featured_media > 0,
  );

  logger.info(
    { totalNullRows: rows.length, candidates: candidates.length },
    "backfill-og-images start",
  );

  let cursor = 0;
  let filled = 0;
  let skipped = 0;

  async function worker(): Promise<void> {
    while (cursor < candidates.length) {
      const idx = cursor;
      cursor += 1;
      const row = candidates[idx];
      if (!row) continue;
      const link = row.link;
      const featuredMediaId = row.raw?.featured_media;
      if (!link || typeof featuredMediaId !== "number") continue;

      const og = await fetchOgImage(link);
      if (!og) {
        skipped += 1;
        continue;
      }

      // Two-step write: upsert the synthetic media row, then patch the
      // post to point at it. Both run as plain SQL to sidestep Drizzle's
      // transaction-only batch helpers (the neon-http driver used by
      // src/db cannot start transactions).
      await db.execute(sql`
        INSERT INTO media (id, source_url, alt_text, width, height, sizes, raw)
        VALUES (
          ${featuredMediaId},
          ${og.url},
          ${og.alt ?? null},
          ${og.width ?? null},
          ${og.height ?? null},
          ${sql.raw(
            `'${JSON.stringify({
              full: {
                url: og.url,
                width: og.width ?? 0,
                height: og.height ?? 0,
              },
            }).replace(/'/g, "''")}'::jsonb`,
          )},
          ${sql.raw(
            `'${JSON.stringify({
              source: "og-image-backfill",
              canonical: link,
            }).replace(/'/g, "''")}'::jsonb`,
          )}
        )
        ON CONFLICT (id) DO UPDATE SET
          source_url = EXCLUDED.source_url,
          alt_text = COALESCE(media.alt_text, EXCLUDED.alt_text),
          width = COALESCE(media.width, EXCLUDED.width),
          height = COALESCE(media.height, EXCLUDED.height),
          sizes = EXCLUDED.sizes,
          raw = EXCLUDED.raw
      `);

      await db.execute(sql`
        UPDATE posts
        SET featured_media_id = ${featuredMediaId}
        WHERE id = ${row.id} AND featured_media_id IS NULL
      `);
      filled += 1;
      if (filled % 25 === 0) {
        logger.info({ filled, skipped }, "backfill-og-images progress");
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, candidates.length) }, () =>
      worker(),
    ),
  );

  logger.info({ filled, skipped }, "backfill-og-images done");
  process.exit(0);
}

main().catch((err: unknown) => {
  logger.error(
    { err: err instanceof Error ? err.message : String(err) },
    "backfill-og-images failed",
  );
  process.exit(1);
});
