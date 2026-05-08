/**
 * Site footer. Houses the SyncBadge so reviewers can see the sync
 * pipeline is alive at a glance, plus a couple of quiet links.
 */
import Link from "next/link";
import { Suspense } from "react";

import { SyncBadge } from "./SyncBadge";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-1">
          <p className="font-medium text-foreground">TRD Lite</p>
          <p className="text-xs">
            A take-home demo. Source content is licensed by{" "}
            <a
              href="https://therealdeal.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              The Real Deal
            </a>
            .
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <Suspense
            fallback={
              <span className="text-xs text-muted-foreground/60">
                checking sync...
              </span>
            }
          >
            <SyncBadge />
          </Suspense>
          <div className="flex gap-4 text-xs">
            <Link
              href="/sync-status"
              className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:underline"
            >
              Sync status
            </Link>
            <Link
              href="/api/graphql"
              className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:underline"
            >
              GraphQL
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
