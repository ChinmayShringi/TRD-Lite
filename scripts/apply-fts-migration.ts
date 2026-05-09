/**
 * One-shot script to apply the Wave 10A FTS migration. Reads
 * `drizzle/0001_search_vector.sql`, splits it into statements, and
 * executes each against the configured Neon database. Uses the
 * unpooled URL because adding columns and creating indexes are
 * long-running statements that PgBouncer cannot proxy.
 *
 * Run with:
 *   pnpm tsx --env-file=.env.local scripts/apply-fts-migration.ts
 *   pnpm tsx --env-file=.env.production scripts/apply-fts-migration.ts
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL_UNPOOLED or DATABASE_URL must be set in the loaded env file",
    );
  }
  const sqlFn = neon(url);
  const filepath = resolve(process.cwd(), "drizzle/0001_search_vector.sql");
  const rawContent = readFileSync(filepath, "utf-8");
  // Strip whole-line `--` comments so the semicolon split below sees
  // only executable SQL. Avoids splitting inside a comment chunk and
  // accidentally producing a comment-only statement that fails parse.
  const content = rawContent
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  const statements = content
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    process.stdout.write(`Executing: ${stmt.slice(0, 80).replace(/\s+/g, " ")}...\n`);
    try {
      // The neon serverless driver's tag template only does parameter
      // binding. Use `query` for raw DDL.
      await sqlFn.query(stmt);
      process.stdout.write("  ok\n");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Tolerate idempotency: column / index already exists.
      if (
        msg.includes("already exists") ||
        msg.includes("duplicate column")
      ) {
        process.stdout.write(`  skipped (already applied): ${msg}\n`);
        continue;
      }
      throw err;
    }
  }
  process.stdout.write("FTS migration applied successfully.\n");
}

main().catch((err) => {
  process.stderr.write(`migration failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
