/**
 * Renders a tiny "Last synced X ago" label by hitting the GraphQL
 * `syncStatus` query. Lives in the footer so reviewers can see the
 * sync pipeline is alive without needing to open dev tools.
 *
 * The badge is a Server Component: it is rendered as part of the
 * route's HTML and revalidates with the rest of the page (5-minute
 * default plus the `homepage` cache tag). Failures degrade silently
 * because the badge is decorative.
 */
import { connection } from "next/server";

import { gqlFetch, GraphQLFetchError } from "@/src/lib/graphql-fetch";
import { relativeTime } from "@/src/lib/relative-time";
import { SyncBadgeQuery } from "@/src/lib/fragments";

interface SyncBadgeData {
  syncStatus: {
    lastSuccessAt: string | null;
    postCount: number;
    status: string;
  };
}

export async function SyncBadge() {
  // Opt out of static prerendering; the badge depends on a request-time
  // round trip to the in-process Yoga handler that does not exist while
  // `next build` is generating /_not-found and friends.
  await connection();

  let data: SyncBadgeData | null = null;
  try {
    data = await gqlFetch<SyncBadgeData>(
      SyncBadgeQuery,
      undefined,
      { tags: ["homepage"], revalidate: 60 },
    );
  } catch (err) {
    if (err instanceof GraphQLFetchError) {
      return (
        <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <span aria-hidden className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          sync status unavailable
        </span>
      );
    }
    throw err;
  }

  const status = data.syncStatus;
  const indicator = status.lastSuccessAt
    ? `Last synced ${relativeTime(status.lastSuccessAt)}`
    : "No successful sync yet";
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <span
        aria-hidden
        className="h-2 w-2 rounded-full bg-emerald-500"
        title={status.status}
      />
      <span>
        {indicator}
        <span className="ml-2 text-muted-foreground">
          {status.postCount} posts
        </span>
      </span>
    </span>
  );
}
