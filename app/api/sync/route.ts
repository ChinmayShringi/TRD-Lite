/**
 * Bearer-protected sync endpoint. Two callers:
 *  1. Vercel Cron at `*\/5 * * * *` (sets `Authorization` automatically).
 *  2. The `/admin/sync` force-sync server action (re-reads the token
 *     server-side; the token never reaches the browser).
 *
 * Behaviour:
 *  - Without/with wrong `Authorization: Bearer ${SYNC_TOKEN}` header,
 *    returns 401.
 *  - With the correct header, runs `syncIncremental({ maxPages: 10 })`
 *    and returns `{ ok, runId, postsUpserted, durationMs }`.
 *  - Always Node runtime (the WebSocket Neon driver requires Node).
 */
import { NextResponse } from "next/server";

// Imported as a namespace so tests can `vi.spyOn(sync, "syncIncremental")`
// to short-circuit the live DB call when exercising the auth flow.
import * as sync from "@/src/lib/sync";
import { logger } from "@/src/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function unauthorized(): NextResponse {
  return NextResponse.json(
    { ok: false, error: "unauthorized" },
    { status: 401 },
  );
}

function checkAuth(request: Request): boolean {
  const expected = process.env.SYNC_TOKEN;
  if (!expected || expected.length === 0) {
    // Refuse to run if the env var is missing; this is fail-closed by
    // design so a misconfigured deployment never accepts unsigned
    // requests.
    return false;
  }
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length).trim();
  // Constant-time-ish compare via length match + char-by-char xor.
  if (token.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < token.length; i += 1) {
    mismatch |= token.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

async function handle(request: Request): Promise<NextResponse> {
  if (!checkAuth(request)) {
    return unauthorized();
  }

  try {
    const result = await sync.syncIncremental({ maxPages: 10 });
    logger.info(
      {
        runId: result.runId,
        postsUpserted: result.postsUpserted,
        status: result.status,
        durationMs: result.durationMs,
      },
      "/api/sync run complete",
    );
    return NextResponse.json({
      ok: result.status === "ok",
      runId: result.runId,
      postsUpserted: result.postsUpserted,
      durationMs: result.durationMs,
      status: result.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message }, "/api/sync crashed");
    return NextResponse.json(
      { ok: false, error: "sync_failed", detail: message },
      { status: 500 },
    );
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  return handle(request);
}

export async function POST(request: Request): Promise<NextResponse> {
  return handle(request);
}
