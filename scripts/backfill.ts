// One-shot backfill of the most-recent WordPress posts. Run once after
// initial deploy or whenever the local DB is empty. Idempotent against
// the same upstream content, so it is safe to run repeatedly while
// developing.
//
// Run with:
//   pnpm tsx --env-file=.env.local scripts/backfill.ts
//
// Tunables (env):
//   BACKFILL_LIMIT     default 500
//   BACKFILL_PER_PAGE  default 100 (capped at 100 by WP)
import { backfill } from "../src/lib/sync";
import { logger } from "../src/lib/logger";

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

async function main(): Promise<void> {
  const limit = readPositiveInt("BACKFILL_LIMIT", 500);
  const perPage = readPositiveInt("BACKFILL_PER_PAGE", 100);

  logger.info({ limit, perPage }, "backfill starting");
  const result = await backfill({ limit, perPage });
  logger.info(
    {
      runId: result.runId,
      postsUpserted: result.postsUpserted,
      durationMs: result.durationMs,
    },
    "backfill done",
  );
}

main().catch((err) => {
  logger.error(
    { err: err instanceof Error ? err.message : String(err) },
    "backfill crashed",
  );
  process.exit(1);
});
