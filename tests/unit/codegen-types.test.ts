/**
 * Compile-time + runtime sanity test for the graphql-codegen output.
 *
 * Per plan.md section 15 #4, codegen exists to prevent silent drift
 * between the SDL in `src/graphql/schema.ts`, the operation strings in
 * `src/lib/fragments.ts`, and the consumers in `app/`. This test
 * imports a couple of generated operation types and constructs sample
 * values against them; if codegen ever produces a shape that doesn't
 * match what consumers expect, the assignment fails to compile and
 * `vitest` (running through tsc) blows up here loudly instead of
 * letting a bad shape ride to production.
 *
 * Runtime assertions are deliberately trivial. The test's real value
 * is in the type annotations and `satisfies` checks. CI's
 * `pnpm codegen:check` catches the "you forgot to re-run codegen"
 * variant of the same drift.
 */
import { describe, expect, it } from "vitest";

import type {
  HomePageQuery,
  HomePageQueryVariables,
  SyncBadgeQuery,
  TermFieldsFragment,
} from "@/src/graphql/__generated__/graphql";

describe("graphql-codegen output", () => {
  it("HomePageQuery has the expected top-level shape", () => {
    const sample: HomePageQuery = {
      posts: {
        edges: [],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
      sectors: [],
    };
    expect(sample.posts.edges).toEqual([]);
    expect(sample.posts.pageInfo.hasNextPage).toBe(false);
    expect(sample.sectors).toEqual([]);
  });

  it("HomePageQueryVariables exposes `first: number`", () => {
    const variables: HomePageQueryVariables = { first: 10 };
    expect(variables.first).toBe(10);
  });

  it("SyncBadgeQuery surfaces the lastSuccessAt field as nullable string", () => {
    const empty: SyncBadgeQuery = {
      syncStatus: { lastSuccessAt: null, postCount: 0, status: "idle" },
    };
    const populated: SyncBadgeQuery = {
      syncStatus: {
        lastSuccessAt: "2026-05-08T17:00:00.000Z",
        postCount: 42,
        status: "ok",
      },
    };
    expect(empty.syncStatus.lastSuccessAt).toBeNull();
    expect(populated.syncStatus.postCount).toBe(42);
  });

  it("TermFieldsFragment carries the four core term fields", () => {
    const term: TermFieldsFragment = {
      id: "1",
      slug: "residential",
      name: "Residential",
      taxonomy: "SECTOR",
    };
    expect(term.taxonomy).toBe("SECTOR");
  });
});
