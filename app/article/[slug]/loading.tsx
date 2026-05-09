/**
 * Article-detail loading state. Next renders this while the server
 * resolves `post(slug)` so the user always sees a structured shell
 * during navigation. Mirrors the real article shape: sector chip,
 * headline block, byline, hero image, body paragraphs.
 */
export default function ArticleLoading() {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 lg:py-14">
      <header
        aria-busy
        aria-label="Loading article"
        className="flex animate-pulse flex-col gap-5"
      >
        <div className="h-6 w-24 rounded-full bg-muted/40" />
        <div className="flex flex-col gap-3">
          <div className="h-10 w-full rounded bg-muted/60" />
          <div className="h-10 w-5/6 rounded bg-muted/60" />
          <div className="h-10 w-2/3 rounded bg-muted/60" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted/50" />
          <div className="flex flex-col gap-1">
            <div className="h-3 w-32 rounded bg-muted/40" />
            <div className="h-3 w-24 rounded bg-muted/40" />
          </div>
        </div>
      </header>

      <div className="aspect-[16/9] w-full animate-pulse rounded-lg bg-muted/50" />

      <div className="flex animate-pulse flex-col gap-3">
        {Array.from({ length: 8 }).map((_, idx) => (
          <div
            key={idx}
            className={`h-4 rounded bg-muted/40 ${
              idx % 4 === 3 ? "w-2/3" : "w-full"
            }`}
          />
        ))}
      </div>
    </article>
  );
}
