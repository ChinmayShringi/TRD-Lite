// Wave 2A schema smoke test. Confirms the schema and relations modules
// load without side effects (no network, no live DB). Live insert + the
// relational hydration check live in scripts/smoke-db.ts and were run
// once during Wave 2A verification.
import { describe, expect, it } from "vitest";

import {
  authors,
  media,
  postTerms,
  posts,
  syncRuns,
  terms,
} from "@/src/db/schema";
import {
  authorsRelations,
  mediaRelations,
  postTermsRelations,
  postsRelations,
  termsRelations,
} from "@/src/db/relations";

describe("db schema", () => {
  it("exports all six tables expected by plan.md section 5", () => {
    expect(posts).toBeDefined();
    expect(authors).toBeDefined();
    expect(media).toBeDefined();
    expect(terms).toBeDefined();
    expect(postTerms).toBeDefined();
    expect(syncRuns).toBeDefined();
  });

  it("exports relations for the relational query API", () => {
    expect(postsRelations).toBeDefined();
    expect(authorsRelations).toBeDefined();
    expect(mediaRelations).toBeDefined();
    expect(termsRelations).toBeDefined();
    expect(postTermsRelations).toBeDefined();
  });
});
