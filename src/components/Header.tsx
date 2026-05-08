/**
 * Site header. Editorial layout: brand wordmark on the left, primary
 * sector navigation on the right. The brand name uses the headline
 * serif so the masthead reads distinct from TRD's red sans treatment.
 */
import Link from "next/link";

const PRIMARY_SECTORS: { slug: string; label: string }[] = [
  { slug: "residential", label: "Residential" },
  { slug: "commercial", label: "Commercial" },
  { slug: "politics", label: "Politics" },
  { slug: "technology", label: "Technology" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="font-heading text-2xl font-semibold tracking-tight text-foreground transition-colors hover:text-accent focus-visible:outline-none focus-visible:underline"
        >
          TRD Lite
        </Link>
        <nav aria-label="Primary" className="hidden gap-6 text-sm font-medium text-muted-foreground sm:flex">
          {PRIMARY_SECTORS.map((s) => (
            <Link
              key={s.slug}
              href={`/sector/${s.slug}`}
              className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:underline"
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
