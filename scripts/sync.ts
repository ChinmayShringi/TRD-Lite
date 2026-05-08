// Ad-hoc CLI trigger for an incremental sync. Reads the latest
// successful run's `started_at` from `sync_runs`, subtracts a 60s
// safety overlap, then pages forward through WP. Idempotent.
//
// Run with:
//   pnpm tsx --env-file=.env.local scripts/sync.ts
import { syncIncremental } from "../src/lib/sync";
import { logger } from "../src/lib/logger";

async function main(): Promise<void> {
  logger.info({}, "incremental sync starting");
  const result = await syncIncremental({ maxPages: 10 });
  logger.info(
    {
      runId: result.runId,
      postsUpserted: result.postsUpserted,
      status: result.status,
      durationMs: result.durationMs,
    },
    "incremental sync done",
  );
  if (result.status === "failed") {
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error(
    { err: err instanceof Error ? err.message : String(err) },
    "sync crashed",
  );
  process.exit(1);
});
