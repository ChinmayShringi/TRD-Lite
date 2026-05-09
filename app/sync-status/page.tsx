/**
 * Public, read-only view of the sync pipeline. Mirrors the data on
 * `/admin/sync` and exposes a public Force-sync button (rate-limited
 * server-side) plus a paginated Recent runs table.
 *
 * Server Component. Always fresh: `revalidate: 0` and `dynamic =
 * 'force-dynamic'` keep status reads off the Data Cache so an operator
 * checking the pipeline never sees stale operational state.
 *
 * Robots noindex: the page is public but uninteresting to search.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { ForceSyncButton } from "@/src/components/ForceSyncButton";
import { SyncRunsTable } from "@/src/components/SyncRunsTable";
import {
  SyncVisibilityQuery,
  type SyncVisibilityData,
} from "@/src/lib/fragments";
import { gqlFetch, GraphQLFetchError } from "@/src/lib/graphql-fetch";
import { relativeTime } from "@/src/lib/relative-time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Sync status",
  description: "Read-only operational view of the TRD-Lite sync pipeline.",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 20;

interface SyncStatusPageProps {
  searchParams: Promise<{ page?: string }>;
}

function parsePage(raw: string | undefined): number {
  if (!raw) return 1;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export default async function SyncStatusPage({
  searchParams,
}: SyncStatusPageProps) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const offset = (page - 1) * PAGE_SIZE;

  let data: SyncVisibilityData | null = null;
  let fetchError: string | null = null;
  try {
    data = await gqlFetch<SyncVisibilityData>(
      SyncVisibilityQuery,
      { limit: PAGE_SIZE, offset },
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
  const total = data?.syncRunCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const rows = data?.recentSyncRuns ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6 lg:py-14">
      <header className="flex flex-col gap-2 border-b border-border pb-4">
        <span className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Operations
        </span>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Sync status
        </h1>
        <p className="text-sm text-muted-foreground">
          Read-only view of the WordPress to Postgres sync pipeline. Click
          the button below to trigger a sync run on demand; the rest of the
          page refreshes on every load.
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
        <ForceSyncButton />
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
              status.lastRunAt ? relativeTime(status.lastRunAt) : "Never"
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

      <section aria-labelledby="runs-heading" className="flex flex-col gap-3">
        <header className="flex items-end justify-between gap-2 border-b border-border pb-3">
          <h2
            id="runs-heading"
            className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Recent runs
          </h2>
          <span className="text-xs text-muted-foreground">
            {total} total{" "}
            {totalPages > 1 ? `· page ${safePage} of ${totalPages}` : null}
          </span>
        </header>
        <SyncRunsTable rows={rows} />
        {totalPages > 1 ? (
          <Pager page={safePage} totalPages={totalPages} />
        ) : null}
      </section>
    </div>
  );
}

function Pager({ page, totalPages }: { page: number; totalPages: number }) {
  const prevHref = page > 1 ? `/sync-status?page=${page - 1}` : null;
  const nextHref =
    page < totalPages ? `/sync-status?page=${page + 1}` : null;
  return (
    <nav
      aria-label="Recent runs pagination"
      className="flex items-center justify-between pt-2"
    >
      {prevHref ? (
        <Link
          href={prevHref}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          &larr; Newer
        </Link>
      ) : (
        <span aria-hidden className="invisible">
          placeholder
        </span>
      )}
      <span className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      {nextHref ? (
        <Link
          href={nextHref}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Older &rarr;
        </Link>
      ) : (
        <span aria-hidden className="invisible">
          placeholder
        </span>
      )}
    </nav>
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
