/**
 * Sync visibility integration tests (Wave 7).
 *
 * Three contracts under test:
 *   1. The Basic-Auth middleware returns 401 + WWW-Authenticate when no
 *      credentials are presented.
 *   2. The middleware admits a request with the correct credentials.
 *   3. The new `recentSyncRuns` GraphQL field returns rows with the
 *      expected shape (the `/sync-status` and `/admin/sync` pages depend
 *      on this contract).
 *
 * The full HTTP loop (Force-sync button, Basic Auth challenge against a
 * running dev server, `SYNC_TOKEN` leak check) is covered by the
 * Playwright suite at `tests/e2e/sync-ui.spec.ts`. Keeping the Vitest
 * tests at the unit/integration boundary avoids requiring a live dev
 * server for the regular `pnpm test` invocation.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createYoga } from "graphql-yoga";

import { schema } from "@/src/graphql/schema";
import { buildContext } from "@/src/graphql/context";
import { db } from "@/src/db";
import { syncRuns } from "@/src/db/schema";
import { sql } from "drizzle-orm";

import { middleware } from "@/middleware";

const TEST_RUN_NOTE = "sync-ui-test-run-do-not-keep";
const ORIGINAL_USER = process.env.ADMIN_USER;
const ORIGINAL_PASS = process.env.ADMIN_PASS;

beforeAll(() => {
  // Lock the credentials to known values so the tests do not depend on
  // whatever a developer happens to have in `.env.local`.
  process.env.ADMIN_USER = "test-user";
  process.env.ADMIN_PASS = "test-pass";
});

afterAll(() => {
  if (ORIGINAL_USER === undefined) delete process.env.ADMIN_USER;
  else process.env.ADMIN_USER = ORIGINAL_USER;
  if (ORIGINAL_PASS === undefined) delete process.env.ADMIN_PASS;
  else process.env.ADMIN_PASS = ORIGINAL_PASS;
});

function buildAdminRequest(authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader) headers.authorization = authHeader;
  return new Request("http://localhost/admin/sync", { headers });
}

function basicAuth(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}

describe("middleware: HTTP Basic Auth on /admin/*", () => {
  it("returns 401 with WWW-Authenticate when no credentials are present", async () => {
    const res = middleware(
      buildAdminRequest() as unknown as Parameters<typeof middleware>[0],
    );
    expect(res?.status).toBe(401);
    const wwwAuth = res?.headers.get("www-authenticate") ?? "";
    expect(wwwAuth.toLowerCase()).toContain("basic");
    // Realm is set so HTTP clients display a useful prompt.
    expect(wwwAuth.toLowerCase()).toContain("realm=");
  });

  it("returns 401 when credentials are wrong", async () => {
    const res = middleware(
      buildAdminRequest(
        basicAuth("test-user", "wrong-pass"),
      ) as unknown as Parameters<typeof middleware>[0],
    );
    expect(res?.status).toBe(401);
  });

  it("admits the request with correct credentials (NextResponse.next)", async () => {
    const res = middleware(
      buildAdminRequest(
        basicAuth("test-user", "test-pass"),
      ) as unknown as Parameters<typeof middleware>[0],
    );
    expect(res).toBeTruthy();
    // NextResponse.next() returns a passthrough response with status 200.
    expect(res?.status).toBe(200);
    // It must not include WWW-Authenticate (that is only for the 401).
    expect(res?.headers.get("www-authenticate")).toBeNull();
  });
});

// ---- GraphQL `recentSyncRuns` ----

const yoga = createYoga({
  schema,
  context: () => buildContext(),
  graphqlEndpoint: "/api/graphql",
  graphiql: false,
  fetchAPI: { Response, Request },
});

async function gql<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<{ data: T | null; errors?: readonly { message: string }[] }> {
  const req = new Request("http://localhost/api/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const res = await yoga.fetch(req);
  const json = (await res.json()) as {
    data?: T | null;
    errors?: readonly { message: string }[];
  };
  return { data: json.data ?? null, errors: json.errors };
}

describe("GraphQL: recentSyncRuns", () => {
  beforeEach(async () => {
    // Insert a fresh row so the test does not depend on whatever the
    // backfill or cron has produced. Cleaned up in afterAll.
    await db.insert(syncRuns).values({
      startedAt: new Date(),
      finishedAt: new Date(),
      modifiedAfter: null,
      postsUpserted: 7,
      errors: 0,
      status: "ok",
      notes: TEST_RUN_NOTE,
    });
  });

  afterAll(async () => {
    await db.execute(sql`delete from sync_runs where notes = ${TEST_RUN_NOTE}`);
  });

  it("returns rows with the SDL-expected shape", async () => {
    const { data, errors } = await gql<{
      recentSyncRuns: Array<{
        id: string;
        startedAt: string;
        finishedAt: string | null;
        modifiedAfter: string | null;
        postsUpserted: number;
        errors: number;
        status: string;
        notes: string | null;
      }>;
    }>(/* GraphQL */ `
      query {
        recentSyncRuns(limit: 20) {
          id
          startedAt
          finishedAt
          modifiedAfter
          postsUpserted
          errors
          status
          notes
        }
      }
    `);

    expect(errors).toBeUndefined();
    expect(data?.recentSyncRuns).toBeTruthy();
    expect(Array.isArray(data?.recentSyncRuns)).toBe(true);
    expect(data!.recentSyncRuns.length).toBeGreaterThan(0);

    const row = data!.recentSyncRuns[0]!;
    expect(typeof row.id).toBe("string");
    expect(typeof row.startedAt).toBe("string");
    expect(typeof row.postsUpserted).toBe("number");
    expect(typeof row.errors).toBe("number");
    expect(typeof row.status).toBe("string");
  }, 30_000);

  it("respects the limit argument", async () => {
    const { data, errors } = await gql<{
      recentSyncRuns: Array<{ id: string }>;
    }>(/* GraphQL */ `
      query {
        recentSyncRuns(limit: 1) {
          id
        }
      }
    `);
    expect(errors).toBeUndefined();
    expect(data?.recentSyncRuns).toHaveLength(1);
  }, 30_000);
});
