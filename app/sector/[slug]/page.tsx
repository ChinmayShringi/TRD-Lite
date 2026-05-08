/**
 * Sector landing page. Lists posts for a single sector taxonomy term.
 * The page title resolves from the first returned post's matching
 * sector entry so we do not need a separate `term(slug)` query.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleCard } from "@/src/components/ArticleCard";
import {
  SectorPageQuery,
  type PostCard,
  type PostConnection,
} from "@/src/lib/fragments";
import { gqlFetch } from "@/src/lib/graphql-fetch";
import {
  getSectorNameForMetadata,
  humanizeSlug,
} from "@/src/lib/seo";

interface SectorPageData {
  postsByTerm: PostConnection<PostCard>;
}

// See comment in app/page.tsx; we cannot build-time-prerender pages
// that depend on the in-process GraphQL handler.
export const dynamic = "force-dynamic";
export const revalidate = 60;

interface SectorPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: SectorPageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolvedName = await getSectorNameForMetadata(slug);
  const name = resolvedName ?? humanizeSlug(slug);
  const description = `Posts in the ${name} sector (demo).`;
  return {
    title: `Sector: ${name}`,
    description,
    openGraph: {
      title: `${name} | TRD News (demo)`,
      description,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${name} | TRD News (demo)`,
      description,
    },
    robots: { index: false, follow: false },
  };
}

export default async function SectorPage({ params }: SectorPageProps) {
  const { slug } = await params;
  const data = await gqlFetch<SectorPageData>(
    SectorPageQuery,
    { slug, first: 20 },
    { tags: [`sector:${slug}`], revalidate: 60 },
  );
  const edges = data.postsByTerm.edges;
  if (edges.length === 0) {
    notFound();
  }

  // Look up the canonical sector name from any returned post that has
  // the matching slug. Falls back to a slug-based label when the
  // taxonomy data is missing for some reason.
  const sectorName =
    edges
      .flatMap((e) => e.node.sectors)
      .find((s) => s.slug === slug)?.name ??
    slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6 lg:py-14">
      <header className="flex flex-col gap-2 border-b border-border pb-6">
        <span className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Sector
        </span>
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          {sectorName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Stories tagged{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            sector:{slug}
          </code>
          .
        </p>
      </header>
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
        {edges.map((e) => (
          <ArticleCard key={e.node.id} post={e.node} />
        ))}
      </div>
    </div>
  );
}
