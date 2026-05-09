/**
 * Placeholder card with the same layout footprint as `<ArticleCard>`.
 * Rendered while the homepage's infinite-scroll list is fetching the
 * next page so the grid never collapses or jumps as new rows arrive.
 *
 * Pure server component: no JS, no state. The `animate-pulse` Tailwind
 * utility provides the shimmer, so the skeleton stays accessible even
 * when JS fails to hydrate.
 */
export function ArticleCardSkeleton() {
  return (
    <div
      role="presentation"
      aria-hidden
      className="flex animate-pulse flex-col gap-4"
    >
      <div className="aspect-[16/10] w-full rounded-lg bg-muted/50" />
      <div className="flex flex-col gap-2">
        <div className="h-3 w-24 rounded bg-muted/50" />
        <div className="h-5 w-full rounded bg-muted/60" />
        <div className="h-5 w-4/5 rounded bg-muted/60" />
        <div className="mt-1 h-4 w-3/4 rounded bg-muted/40" />
        <div className="h-4 w-2/3 rounded bg-muted/40" />
        <div className="mt-2 flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-muted/50" />
          <div className="h-3 w-32 rounded bg-muted/40" />
        </div>
      </div>
    </div>
  );
}
