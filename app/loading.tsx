/**
 * Homepage loading state. Next renders this automatically while the
 * server-side `HomePage` data fetch is in flight, so a hard reload or
 * a soft navigation to `/` always paints a structured skeleton
 * instead of a blank screen.
 *
 * Layout mirrors the real homepage: hero block, sector chip row,
 * grid of cards. Pure server component; no JS shipped.
 */
import { ArticleCardSkeleton } from "@/src/components/ArticleCardSkeleton";

export default function HomeLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6 lg:py-14">
      <section aria-busy aria-label="Loading homepage" className="flex flex-col gap-4">
        <div className="border-b border-border pb-3">
          <div className="h-3 w-24 rounded bg-muted/40" />
        </div>
        <div className="grid animate-pulse gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div className="aspect-[16/10] w-full rounded-xl bg-muted/50" />
          <div className="flex flex-col gap-4">
            <div className="h-3 w-20 rounded bg-muted/40" />
            <div className="h-9 w-full rounded bg-muted/60" />
            <div className="h-9 w-3/4 rounded bg-muted/60" />
            <div className="h-4 w-full rounded bg-muted/40" />
            <div className="h-4 w-5/6 rounded bg-muted/40" />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="h-3 w-32 rounded bg-muted/40" />
        <div className="flex animate-pulse flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-7 w-24 rounded-full bg-muted/40" />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <div className="border-b border-border pb-3">
          <div className="h-3 w-16 rounded bg-muted/40" />
        </div>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, idx) => (
            <ArticleCardSkeleton key={idx} />
          ))}
        </div>
      </section>
    </div>
  );
}
