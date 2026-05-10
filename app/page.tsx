/**
 * Homepage. Server Component. Fetches the latest 10 published posts
 * and the full sectors list in one round trip to the in-process Yoga
 * handler. Renders <ArticleHero> for the first post and a 2/3-column
 * grid of <ArticleCard> for the remainder.
 */
import type { Metadata } from "next";

import { ColumnStory } from "@/src/components/ColumnStory";
import { InfiniteArticleList } from "@/src/components/InfiniteArticleList";
import { LeadStory } from "@/src/components/LeadStory";
import { RightRailItem } from "@/src/components/RightRailItem";
import { SectionRule } from "@/src/components/SectionRule";
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
  // Newspaper tiers, top to bottom:
  //   slot 0     - lead story (left column above the fold)
  //   slots 1-3  - right-rail "Top stories" stack
  //   slots 4-6  - "Latest reporting" three-column band
  //   slots 7+   - dense "More stories" brief list
  // The split lives here so the server-rendered first paint already
  // shows the editorial hierarchy without a flicker.
  const railPosts = edges.slice(1, 4).map((e) => e.node);
  const columnPosts = edges.slice(4, 7).map((e) => e.node);
  const briefEdges = edges.slice(7);
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-4 py-8 sm:px-6 lg:py-12">
      {heroPost ? (
        <section aria-labelledby="front-page-heading" className="flex flex-col gap-8">
          <SectionRule label="Front Page" id="front-page-heading">
            Today&rsquo;s edition
          </SectionRule>
          <div className="grid gap-10 lg:grid-cols-[2fr_1fr] lg:gap-12 lg:divide-x lg:divide-border">
            <LeadStory post={heroPost} className="lg:pr-12" />
            {railPosts.length > 0 ? (
              <aside
                aria-label="Top stories"
                className="flex flex-col lg:pl-12"
              >
                <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[0.28em] text-foreground pb-3 border-b border-foreground/80">
                  Top stories
                </h2>
                <ul className="flex flex-col divide-y divide-border">
                  {railPosts.map((p) => (
                    <li key={p.id} className="py-5 first:pt-5">
                      <RightRailItem post={p} />
                    </li>
                  ))}
                </ul>
              </aside>
            ) : null}
          </div>
        </section>
      ) : null}

      {columnPosts.length > 0 ? (
        <section
          aria-labelledby="latest-reporting-heading"
          className="flex flex-col gap-6"
        >
          <SectionRule label="Latest reporting" id="latest-reporting-heading" />
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-border">
            {columnPosts.map((p, i) => (
              <div
                key={p.id}
                className={
                  i === 0
                    ? "lg:pr-8"
                    : i === columnPosts.length - 1
                      ? "lg:pl-8"
                      : "lg:px-8"
                }
              >
                <ColumnStory post={p} />
              </div>
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
            className="font-sans text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground"
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

      <section aria-labelledby="more-stories-heading" className="flex flex-col gap-6">
        <SectionRule label="More stories" id="more-stories-heading" />
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
