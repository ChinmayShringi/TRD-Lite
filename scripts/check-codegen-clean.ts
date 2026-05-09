/**
 * CI guardrail for graphql-codegen output.
 *
 * Runs after `pnpm codegen` and asserts that none of the codegen
 * outputs (the dumped SDL `.graphql` file and the contents of
 * `src/graphql/__generated__/`) have a different on-disk shape than
 * what's already committed. If they do, the committed types are stale
 * relative to the schema or the operation strings, which is exactly
 * the drift codegen exists to catch.
 *
 * Why not `git diff --exit-code`: that ignores untracked files. On
 * the very first PR that adds these generated artifacts, or any time
 * a new query introduces a brand-new generated entry, the diff would
 * be empty even though the working tree contains uncommitted output.
 * `git status --porcelain` reports both tracked-modified and
 * untracked, which is the actual invariant we want.
 */
import { execFileSync } from "node:child_process";

const CODEGEN_PATHS = [
  "src/graphql/schema.graphql",
  "src/graphql/__generated__",
];

function statusFor(paths: readonly string[]): string {
  const stdout = execFileSync(
    "git",
    ["status", "--porcelain", "--", ...paths],
    { encoding: "utf-8" },
  );
  return stdout.trim();
}

function main(): void {
  const dirty = statusFor(CODEGEN_PATHS);
  if (dirty.length === 0) {
    // eslint-disable-next-line no-console
    console.log("[codegen-check] generated files are up to date.");
    return;
  }
  // eslint-disable-next-line no-console
  console.error(
    [
      "[codegen-check] generated GraphQL files are out of date or uncommitted.",
      "Run `pnpm codegen` and commit the result.",
      "",
      "Files in question:",
      dirty,
      "",
    ].join("\n"),
  );
  process.exit(1);
}

main();
