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
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArticleCard } from "@/src/components/ArticleCard";
import { AuthorByline } from "@/src/components/AuthorByline";
import { FeaturedImage } from "@/src/components/FeaturedImage";
import { ListenButton } from "@/src/components/ListenButton";
import { SectorChip } from "@/src/components/SectorChip";
import {
  ArticlePageQuery,
  RelatedPostsQuery,
  type PostCard,
  type PostConnection,
  type PostDetail,
} from "@/src/lib/fragments";
import { gqlFetch } from "@/src/lib/graphql-fetch";
import { getPostForMetadata, stripHtml } from "@/src/lib/seo";
import {
  decodeText,
  htmlToSpeechText,
  rewriteTrdArticleLinks,
} from "@/src/lib/text";

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

export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostForMetadata(slug);
  if (!post) {
    return {
      title: "Article not found",
      robots: { index: false, follow: false },
    };
  }
  const title = decodeText(post.title);
  const description = stripHtml(post.excerpt).slice(0, 200);
  const ogImages = post.featuredMedia
    ? [
        {
          url: post.featuredMedia.url,
          width: post.featuredMedia.width ?? undefined,
          height: post.featuredMedia.height ?? undefined,
        },
      ]
    : undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.modifiedAt,
      authors: post.author?.name ? [post.author.name] : undefined,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: post.featuredMedia ? [post.featuredMedia.url] : undefined,
    },
    // Canonical points back to the original TRD URL per plan.md 9.5
    // SEO #1: the source of truth is upstream. With the canonical in
    // place, Google credits TRD with the article and indexing our
    // mirror is safe (and helps the demo show up for direct queries).
    alternates: { canonical: post.link },
    robots: { index: true, follow: true },
  };
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

  const title = decodeText(post.title);
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
  // Render-time rewrite of TRD article hrefs into /article/<slug> so
  // the inline "Read more" embed and any other internal links route
  // through this app instead of bouncing the reader to therealdeal.com.
  const safeHtml = rewriteTrdArticleLinks(post.contentHtml);
  const spokenText = htmlToSpeechText(post.contentHtml);

  // JSON-LD NewsArticle for richer SERP entries. Per plan.md 9.5 SEO #2
  // we expose the structured data on the article page so search
  // engines, social previews, and AI summarizers see consistent
  // headline/date/author signals even though the page sets
  // `robots: noindex` for the demo deployment.
  const ldJson = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: title,
    image: post.featuredMedia ? [post.featuredMedia.url] : [],
    datePublished: post.publishedAt,
    dateModified: post.modifiedAt,
    author: post.author?.name
      ? [{ "@type": "Person", name: post.author.name }]
      : [],
    publisher: { "@type": "Organization", name: "TRD News (demo)" },
    mainEntityOfPage: post.link,
  };

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 lg:py-14">
      <script
        type="application/ld+json"
        // Per Next's official JSON-LD guidance, JSON.stringify alone
        // does not escape the `<` character, so a post title containing
        // `</script>` (or any `<...>` sequence) could break out of the
        // script element. Replacing `<` with its unicode escape
        // `<` neutralizes that XSS vector while keeping the JSON
        // semantically identical for parsers.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(ldJson).replace(/</g, "\\u003c"),
        }}
      />
      <header className="flex flex-col gap-5">
        {primarySector ? (
          <div>
            <SectorChip slug={primarySector.slug} name={primarySector.name} />
          </div>
        ) : null}
        <h1 className="font-heading text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        <AuthorByline
          author={post.author}
          publishedAt={post.publishedAt}
          variant="detailed"
        />
      </header>

      <FeaturedImage media={post.featuredMedia} variant="detail" priority />

      <ListenButton text={spokenText} title={title} />

      <div
        className="article-prose"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />

      {related.length > 0 ? (
        <aside
          aria-labelledby="related-heading"
          className="mt-12 flex flex-col gap-6"
        >
          <header className="flex items-end justify-between gap-4 border-b border-border pb-3">
            <h2
              id="related-heading"
              className="font-heading text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground"
            >
              Related stories
            </h2>
          </header>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <ArticleCard key={p.id} post={p} />
            ))}
          </div>
        </aside>
      ) : null}
    </article>
  );
}
