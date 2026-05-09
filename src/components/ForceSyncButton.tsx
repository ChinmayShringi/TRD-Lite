/**
 * Client-side button that calls the public force-sync server action
 * and surfaces its three possible outcomes (`ok`, `cooldown`, `error`)
 * inline. The button stays disabled while a request is in flight so
 * impatient double-clicks cannot fan out into multiple network calls.
 */
"use client";

import { useState, useTransition } from "react";

import {
  forceSyncPublic,
  type ForceSyncResult,
} from "@/app/sync-status/actions";

export function ForceSyncButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ForceSyncResult | null>(null);

  function handleClick(): void {
    setResult(null);
    startTransition(async () => {
      const next = await forceSyncPublic();
      setResult(next);
    });
  }

  const tone =
    result?.status === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : result?.status === "cooldown"
        ? "text-amber-600 dark:text-amber-400"
        : result?.status === "error"
          ? "text-red-600 dark:text-red-400"
          : "text-muted-foreground";

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-busy={pending}
        className="inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Syncing..." : "Force sync now"}
      </button>
      <span className={`text-xs ${tone}`}>
        {pending
          ? "Posting to /api/sync..."
          : result
            ? result.message
            : "Triggers a sync run server-side. Token never reaches the browser. Rate-limited to one run per 30 seconds."}
      </span>
    </div>
  );
}
