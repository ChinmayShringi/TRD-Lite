/**
 * Server action invoked by the `/admin/sync` "Force sync" form.
 *
 * The action runs server-side, re-reads `SYNC_TOKEN` from the process
 * environment, and POSTs to `/api/sync` with a `Bearer` header. The
 * token NEVER reaches the browser: it is read inside a server action
 * and only attached to a server-to-server fetch. Verified by a
 * Playwright test that asserts `page.content()` does not include the
 * token value.
 *
 * The page is already gated by Basic Auth in `middleware.ts`, so the
 * action only runs for authenticated operators. Tag invalidation is
 * triggered for both visibility pages so the new sync_runs row is
 * visible immediately after the action returns.
 */
"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export async function forceSync(): Promise<void> {
  const token = process.env.SYNC_TOKEN ?? "";
  if (!token) {
    throw new Error("SYNC_TOKEN is not configured on this deployment");
  }

  const h = await headers();
  // Forwarded headers cover Vercel and similar proxies. Local dev falls
  // back to the bare `host` and HTTP scheme.
  const host =
    h.get("x-forwarded-host") ??
    h.get("host") ??
    "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const url = `${proto}://${host}/api/sync`;

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Force sync failed: ${res.status} ${text}`);
  }

  // Both visibility pages should pick up the new sync_runs row on the
  // next render. revalidatePath is the right tool here because the
  // pages are dynamic but cached at the request level.
  revalidatePath("/admin/sync");
  revalidatePath("/sync-status");
}
