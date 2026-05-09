/**
 * Basic-Auth-protected admin view of the sync pipeline. The auth gate
 * is enforced by `middleware.ts` at the project root; this page assumes
 * an authenticated request.
 *
 * Renders the same data as `/sync-status` plus a "Force sync now"
 * button. The button submits a server action (`forceSync`) that
 * re-reads `SYNC_TOKEN` server-side and POSTs to `/api/sync`. The
 * token never crosses the network to the browser.
 */
import type { Metadata } from "next";

import { SyncRunsTable } from "@/src/components/SyncRunsTable";
import {
  SyncVisibilityQuery,
  type SyncVisibilityData,
} from "@/src/lib/fragments";
import { gqlFetch, GraphQLFetchError } from "@/src/lib/graphql-fetch";
import { relativeTime } from "@/src/lib/relative-time";

import { forceSync } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Admin: sync",
  description: "Operator view of the TRD-Lite sync pipeline.",
  robots: { index: false, follow: false },
};

const RECENT_LIMIT = 20;

export default async function AdminSyncPage() {
  let data: SyncVisibilityData | null = null;
  let fetchError: string | null = null;
  try {
    data = await gqlFetch<SyncVisibilityData>(
      SyncVisibilityQuery,
      { limit: RECENT_LIMIT, offset: 0 },
      { revalidate: 0 },
    );
  } catch (err) {
    fetchError =
      err instanceof GraphQLFetchError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
  }

  const status = data?.syncStatus;
  const rows = data?.recentSyncRuns ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:py-14">
      <header className="flex flex-col gap-2 border-b border-border pb-4">
        <span className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Admin
        </span>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Sync admin
        </h1>
        <p className="text-sm text-muted-foreground">
          Authenticated operator view. Use the Force sync button to trigger
          an out-of-cron run; the public read-only view lives at{" "}
          <a
            href="/sync-status"
            className="underline transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            /sync-status
          </a>
          .
        </p>
      </header>

      <section
        aria-labelledby="actions-heading"
        className="flex flex-col gap-3 rounded-md border border-border bg-muted/20 p-4"
      >
        <h2
          id="actions-heading"
          className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground"
        >
          Actions
        </h2>
        <form action={forceSync} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Force sync now
          </button>
          <span className="text-xs text-muted-foreground">
            Posts to /api/sync server-side. Token never reaches the browser.
          </span>
        </form>
      </section>

      {fetchError ? (
        <section
          aria-label="Sync status unavailable"
          className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-900"
        >
          Could not load sync status: {fetchError}
        </section>
      ) : null}

      {status ? (
        <section
          aria-labelledby="summary-heading"
          className="grid grid-cols-2 gap-4 rounded-md border border-border bg-muted/20 p-4 sm:grid-cols-4"
        >
          <h2 id="summary-heading" className="sr-only">
            Sync summary
          </h2>
          <SummaryCell label="Posts in mirror" value={String(status.postCount)} />
          <SummaryCell
            label="Last run"
            value={
              status.lastRunAt
                ? relativeTime(status.lastRunAt)
                : "Never"
            }
            title={status.lastRunAt ?? undefined}
          />
          <SummaryCell
            label="Last success"
            value={
              status.lastSuccessAt
                ? relativeTime(status.lastSuccessAt)
                : "Never"
            }
            title={status.lastSuccessAt ?? undefined}
          />
          <SummaryCell label="Latest status" value={status.status} />
        </section>
      ) : null}

      <section
        aria-labelledby="runs-heading"
        className="flex flex-col gap-3"
      >
        <h2
          id="runs-heading"
          className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground"
        >
          Recent runs (last {RECENT_LIMIT})
        </h2>
        <SyncRunsTable rows={rows} />
      </section>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  title,
}: {
  label: string;
  value: string;
  title?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className="font-heading text-base font-medium text-foreground"
        title={title}
      >
        {value}
      </span>
    </div>
  );
}
