/**
 * Homepage. Server Component. Fetches the latest 10 published posts
 * and the full sectors list in one round trip to the in-process Yoga
 * handler. Renders <ArticleHero> for the first post and a 2/3-column
 * grid of <ArticleCard> for the remainder.
 */
import type { Metadata } from "next";

import { ArticleCard } from "@/src/components/ArticleCard";
import { ArticleHero } from "@/src/components/ArticleHero";
import { InfiniteArticleList } from "@/src/components/InfiniteArticleList";
import { SectorChip } from "@/src/components/SectorChip";
import type { HomePageQuery as HomePageQueryResult } from "@/src/graphql/__generated__/graphql";
import {
  HomePageQuery,
  HomePostsPageQuery,
  type PostCard,
  type PostConnection,
  type TermFields,
} from "@/src/lib/fragments";
import { gqlFetch } from "@/src/lib/graphql-fetch";

// Cross-check: the generated `HomePageQuery` shape from
// graphql-codegen must remain assignable to the locally hand-typed
// `HomePageData` shape we read from the GraphQL response. If the
// schema or the operation drifts, this assignment fails to compile,
// which is exactly the early signal we wired codegen up for. See
// plan.md section 15 #4.
type HomePageData = HomePageQueryResult & {
  posts: PostConnection<PostCard> & {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
  };
  sectors: TermFields[];
};

// The homepage fetches from the in-process Yoga handler at
// `/api/graphql`. During `next build` the route is not running, so we
// cannot statically prerender; mark it dynamic and let the Data Cache
// (5-minute revalidate + tag invalidation) shoulder the caching role
// at request time. Still cacheable, just at the request-cache layer.
export const dynamic = "force-dynamic";
export const revalidate = 60;

const HOMEPAGE_TAGS = ["homepage"];

const HOMEPAGE_TITLE = "Latest real estate news";
const HOMEPAGE_DESCRIPTION =
  "Latest real-estate news from TRD Lite: commercial, residential, development, retail, and policy stories from across the United States, mirrored from The Real Deal.";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: HOMEPAGE_TITLE,
    description: HOMEPAGE_DESCRIPTION,
    alternates: { canonical: "/" },
    openGraph: {
      title: HOMEPAGE_TITLE,
      description: HOMEPAGE_DESCRIPTION,
      type: "website",
      url: "/",
    },
    twitter: {
      card: "summary_large_image",
      title: HOMEPAGE_TITLE,
      description: HOMEPAGE_DESCRIPTION,
    },
  };
}

const FEATURED_SECTOR_SLUGS = [
  "residential",
  "commercial",
  "politics",
  "technology",
  "retail",
  "investment",
];

export default async function HomePage() {
  // First page is large enough to fill 1 hero + 12 grid cards above
  // the fold so the user lands on a real grid, not a skeleton.
  const data = await gqlFetch<HomePageData>(
    HomePageQuery,
    { first: 13 },
    { tags: HOMEPAGE_TAGS, revalidate: 60 },
  );

  const edges = data.posts.edges;
  if (edges.length === 0) {
    return (
      <section className="mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="font-heading text-3xl font-semibold">
          No articles yet
        </h1>
        <p className="mt-3 text-muted-foreground">
          The sync pipeline has not produced any posts. Try running{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-sm">
            pnpm tsx scripts/backfill.ts
          </code>
          .
        </p>
      </section>
    );
  }

  const heroPost = edges[0]?.node;
  // Front-page tiers: hero anchors the page, two "lead" cards sit
  // below it as the second-tier stories, and the rest fall into the
  // dense "More stories" brief list. The split lives here (rather
  // than in InfiniteArticleList) so the server-rendered first paint
  // already shows the editorial hierarchy without a flicker.
  const leadEdges = edges.slice(1, 3);
  const briefEdges = edges.slice(3);
  const initialEndCursor = data.posts.pageInfo?.endCursor ?? null;
  const initialHasNextPage = data.posts.pageInfo?.hasNextPage ?? false;

  // Pick a stable subset of sectors for the chip row. Prefer the
  // featured slugs in our hardcoded ordering when they exist; fall
  // through to whatever the schema returned so the chip row never
  // appears empty even if the canonical sectors are renamed upstream.
  const sectorBySlug = new Map(data.sectors.map((s) => [s.slug, s] as const));
  const featuredSectors: TermFields[] = [];
  for (const slug of FEATURED_SECTOR_SLUGS) {
    const s = sectorBySlug.get(slug);
    if (s) featuredSectors.push(s);
  }
  if (featuredSectors.length === 0) {
    featuredSectors.push(...data.sectors.slice(0, 6));
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-10 sm:px-6 lg:py-14">
      <section aria-labelledby="hero-heading" className="flex flex-col gap-4">
        <header className="flex items-end justify-between gap-4 border-b border-border pb-3">
          <h1
            id="hero-heading"
            className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Top story
          </h1>
        </header>
        {heroPost ? <ArticleHero post={heroPost} /> : null}
      </section>

      {leadEdges.length > 0 ? (
        <section
          aria-labelledby="leads-heading"
          className="flex flex-col gap-6"
        >
          <header className="flex items-end justify-between gap-4 border-b border-border pb-3">
            <h2
              id="leads-heading"
              className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground"
            >
              Lead stories
            </h2>
          </header>
          <div className="grid gap-10 sm:grid-cols-2">
            {leadEdges.map((edge) => (
              <ArticleCard key={edge.node.id} post={edge.node} />
            ))}
          </div>
        </section>
      ) : null}

      {featuredSectors.length > 0 ? (
        <section
          aria-labelledby="sectors-heading"
          className="flex flex-col gap-3 border-y border-border py-4"
        >
          <h2
            id="sectors-heading"
            className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Browse by sector
          </h2>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {featuredSectors.map((s) => (
              <li key={s.slug}>
                <SectorChip slug={s.slug} name={s.name} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="latest-heading" className="flex flex-col gap-4">
        <header className="flex items-end justify-between gap-4 border-b border-border pb-3">
          <h2
            id="latest-heading"
            className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            More stories
          </h2>
        </header>
        <InfiniteArticleList
          initialEdges={briefEdges}
          initialHasNextPage={initialHasNextPage}
          initialEndCursor={initialEndCursor}
          query={HomePostsPageQuery}
          variant="brief"
        />
      </section>
    </div>
  );
}
