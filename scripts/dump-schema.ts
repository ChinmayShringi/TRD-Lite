/**
 * Dumps the hand-written SDL string from `src/graphql/schema.ts` to
 * `src/graphql/schema.graphql`. Runs as the first step of `pnpm codegen`
 * so graphql-codegen can load the schema from a plain `.graphql` file
 * without having to evaluate TypeScript at codegen time.
 *
 * Why a dump step instead of a custom loader: per plan.md section 13
 * the schema is hand-written SDL (not Pothos), and the simplest path
 * is to keep `src/graphql/schema.ts` as the single source of truth and
 * mirror its `typeDefs` to a sibling `.graphql` file just for codegen.
 * Decouples schema authoring from codegen's loader plumbing.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { typeDefs } from "../src/graphql/schema";

const OUTPUT_PATH = resolve(process.cwd(), "src/graphql/schema.graphql");

function main(): void {
  if (typeof typeDefs !== "string" || typeDefs.length === 0) {
    throw new Error(
      "src/graphql/schema.ts did not export a non-empty `typeDefs` string",
    );
  }
  writeFileSync(OUTPUT_PATH, typeDefs, "utf-8");
  // eslint-disable-next-line no-console
  console.log(`[dump-schema] wrote ${typeDefs.length} chars to ${OUTPUT_PATH}`);
}

main();
