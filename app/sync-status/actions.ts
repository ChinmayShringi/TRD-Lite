/**
 * Server action invoked by the public "Force sync" button on
 * `/sync-status`.
 *
 * Like the admin equivalent, this re-reads `SYNC_TOKEN` server-side
 * and POSTs it to `/api/sync` with a `Bearer` header so the secret
 * never travels to the browser. The action is exposed on a public
 * page, so we add a soft rate limit: if the most recent run started
 * less than RATE_LIMIT_SECONDS ago, we short-circuit and return a
 * `cooldown` status instead of triggering another sync. Sync passes
 * are idempotent (and currently do nothing for ~99% of the corpus),
 * but the limit prevents the button from being a free hammer for
 * curious passersby.
 */
"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { gqlFetch } from "@/src/lib/graphql-fetch";

const RATE_LIMIT_SECONDS = 30;

// Tiny query just for the rate-limit check. Kept inline rather than in
// fragments.ts so callers do not have to import a new export for a
// one-shot read.
const LATEST_RUN_QUERY = /* GraphQL */ `
  query ForceSyncRateGate {
    syncStatus {
      lastRunAt
    }
  }
`;

export interface ForceSyncResult {
  status: "ok" | "cooldown" | "error";
  message: string;
  cooldownSeconds?: number;
}

export async function forceSyncPublic(): Promise<ForceSyncResult> {
  const token = process.env.SYNC_TOKEN ?? "";
  if (!token) {
    return {
      status: "error",
      message: "SYNC_TOKEN is not configured on this deployment.",
    };
  }

  // Soft rate limit. We trust the server clock for sync_runs because
  // every run is recorded server-side; client clocks are irrelevant.
  try {
    const gate = await gqlFetch<{ syncStatus: { lastRunAt: string | null } }>(
      LATEST_RUN_QUERY,
      undefined,
      { revalidate: 0 },
    );
    const lastRunAt = gate.syncStatus.lastRunAt;
    if (lastRunAt) {
      const ageSeconds = (Date.now() - new Date(lastRunAt).getTime()) / 1000;
      if (ageSeconds < RATE_LIMIT_SECONDS) {
        return {
          status: "cooldown",
          message: `A sync ran ${Math.round(ageSeconds)}s ago. Try again shortly.`,
          cooldownSeconds: Math.ceil(RATE_LIMIT_SECONDS - ageSeconds),
        };
      }
    }
  } catch {
    // If we cannot read the last run, proceed to /api/sync; the route
    // will reject if SYNC_TOKEN is wrong, and a missing rate-limit gate
    // is preferable to refusing the user's explicit click.
  }

  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = `${proto}://${host}/api/sync`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        status: "error",
        message: `Sync failed: ${res.status} ${text}`.slice(0, 200),
      };
    }
  } catch (err) {
    return {
      status: "error",
      message:
        err instanceof Error ? err.message : "Network error reaching /api/sync",
    };
  }

  revalidatePath("/sync-status");
  revalidatePath("/admin/sync");
  return { status: "ok", message: "Sync triggered." };
}
