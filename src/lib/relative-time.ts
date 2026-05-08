/**
 * Tiny wrapper around `Intl.RelativeTimeFormat`. Used by the Footer
 * SyncBadge to render "Last synced 2 minutes ago" without pulling in
 * date-fns or dayjs.
 *
 * The function picks the largest unit that fits the diff so that "65
 * seconds ago" becomes "1 minute ago" and not "65 seconds ago".
 */
const UNITS: ReadonlyArray<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: "year", ms: 365 * 24 * 3600 * 1000 },
  { unit: "month", ms: 30 * 24 * 3600 * 1000 },
  { unit: "week", ms: 7 * 24 * 3600 * 1000 },
  { unit: "day", ms: 24 * 3600 * 1000 },
  { unit: "hour", ms: 3600 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
  { unit: "second", ms: 1000 },
];

/**
 * Returns a localized phrase like "5 minutes ago" or "in 3 hours".
 * Returns `"just now"` for diffs under one second.
 */
export function relativeTime(
  date: Date | string,
  now: Date = new Date(),
): string {
  const then = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(then.getTime())) return "unknown";

  const diffMs = then.getTime() - now.getTime();
  const absMs = Math.abs(diffMs);
  if (absMs < 1000) return "just now";

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const { unit, ms } of UNITS) {
    if (absMs >= ms) {
      const value = Math.round(diffMs / ms);
      return formatter.format(value, unit);
    }
  }
  return formatter.format(Math.round(diffMs / 1000), "second");
}
