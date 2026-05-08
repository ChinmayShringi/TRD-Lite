/**
 * Article detail page. Renders semantic HTML per plan.md section 9.5:
 *   <article>
 *     <header> with <h1>, byline (author + <time>), and primary sector
 *     <FeaturedImage> hero crop
 *     <div className="article-prose"> with sanitized contentHtml
 *     <RelatedPosts /> by primary sector
 *
 * The contentHtml string was already sanitized at sync time via
 * `sanitizeArticleHtml` (plan.md section 9.5 strategy: sanitize on
 * write so the DB never holds dangerous markup). We trust the column
 * and inject via dangerouslySetInnerHTML; without that the editorial
 * markup (img/figure/blockquote) cannot render.
 */
import { notFound } from "next/navigation";

import { ArticleCard } from "@/src/components/ArticleCard";
import { AuthorByline } from "@/src/components/AuthorByline";
import { FeaturedImage } from "@/src/components/FeaturedImage";
import { SectorChip } from "@/src/components/SectorChip";
import {
  ArticlePageQuery,
  RelatedPostsQuery,
  type PostCard,
  type PostConnection,
  type PostDetail,
} from "@/src/lib/fragments";
import { gqlFetch } from "@/src/lib/graphql-fetch";

interface ArticlePageData {
  post: PostDetail | null;
}

interface RelatedPostsData {
  postsByTerm: PostConnection<PostCard>;
}

// See comment in app/page.tsx; we cannot build-time-prerender pages
// that depend on the in-process GraphQL handler.
export const dynamic = "force-dynamic";
export const revalidate = 60;

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const data = await gqlFetch<ArticlePageData>(
    ArticlePageQuery,
    { slug },
    { tags: [`post:${slug}`], revalidate: 60 },
  );
  const post = data.post;
  if (!post) {
    notFound();
  }

  const primarySector = post.sectors[0];

  // Pull related posts via postsByTerm. The current article will be in
  // that result set and is filtered out below. Failures are tolerated
  // because the related rail is decorative.
  let related: PostCard[] = [];
  if (primarySector) {
    try {
      const relatedData = await gqlFetch<RelatedPostsData>(
        RelatedPostsQuery,
        { taxonomy: "SECTOR", slug: primarySector.slug, first: 6 },
        { tags: [`sector:${primarySector.slug}`], revalidate: 300 },
      );
      related = relatedData.postsByTerm.edges
        .map((e) => e.node)
        .filter((p) => p.slug !== post.slug)
        .slice(0, 3);
    } catch {
      related = [];
    }
  }

  // Pre-sanitized at sync time. See src/lib/sanitize.ts and plan.md 9.5.
  const safeHtml = post.contentHtml;

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 lg:py-14">
      <header className="flex flex-col gap-5">
        {primarySector ? (
          <div>
            <SectorChip slug={primarySector.slug} name={primarySector.name} />
          </div>
        ) : null}
        <h1 className="font-heading text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          {post.title}
        </h1>
        <AuthorByline
          author={post.author}
          publishedAt={post.publishedAt}
          variant="detailed"
        />
      </header>

      <FeaturedImage media={post.featuredMedia} variant="detail" priority />

      <div
        className="article-prose"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />

      {related.length > 0 ? (
        <aside
          aria-labelledby="related-heading"
          className="mt-8 flex flex-col gap-6 border-t border-border pt-10"
        >
          <h2
            id="related-heading"
            className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Related stories
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <ArticleCard key={p.id} post={p} />
            ))}
          </div>
        </aside>
      ) : null}
    </article>
  );
}
