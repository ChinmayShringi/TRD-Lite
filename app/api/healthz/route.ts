/**
 * Health-check endpoint. Used by Vercel/uptime probes to confirm the
 * deployment is alive AND its DB connection is warm. Returns the post
 * count and the most-recent successful sync timestamp so the response
 * doubles as a tiny operational summary.
 *
 * Allowed exception to the "frontend cannot import from src/db" rule
 * (plan.md section 13): healthz is a backend endpoint (Vercel
 * function), not a React component or page. The boundary applies to
 * UI code; API handlers under `app/api/*` may talk to the DB.
 */
import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/src/db";
import { posts, syncRuns } from "@/src/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HealthzOk {
  ok: true;
  postCount: number;
  lastSync: string | null;
}

interface HealthzErr {
  ok: false;
  error: string;
}

export async function GET(): Promise<Response> {
  try {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(posts);
    const [lastOk] = await db
      .select({ at: syncRuns.startedAt })
      .from(syncRuns)
      .where(eq(syncRuns.status, "ok"))
      .orderBy(desc(syncRuns.id))
      .limit(1);

    const lastSync = lastOk?.at instanceof Date
      ? lastOk.at.toISOString()
      : (lastOk?.at ?? null);

    const body: HealthzOk = {
      ok: true,
      postCount: countRow?.count ?? 0,
      lastSync,
    };
    return Response.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const body: HealthzErr = { ok: false, error: message };
    return Response.json(body, { status: 500 });
  }
}
