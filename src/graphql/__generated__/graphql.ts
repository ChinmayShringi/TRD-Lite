/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type Taxonomy =
  | 'COMPANY'
  | 'MARKET'
  | 'NEIGHBORHOOD'
  | 'PEOPLE'
  | 'REGION'
  | 'SECTOR'
  | 'STORY_TYPE'
  | 'TAG';

export type SitemapQueryVariables = Exact<{
  first: number;
}>;


export type SitemapQuery = { posts: { edges: Array<{ node: { slug: string, modifiedAt: string } }> } };

export type SectorsForHeaderQueryVariables = Exact<{ [key: string]: never; }>;


export type SectorsForHeaderQuery = { sectors: Array<{ slug: string, name: string }> };

export type TermFieldsFragment = { id: string, slug: string, name: string, taxonomy: Taxonomy };

export type AuthorFieldsFragment = { id: string, slug: string, name: string, avatarUrl: string | null };

export type MediaFieldsFragment = { id: string, url: string, alt: string | null, width: number | null, height: number | null, sizes: Array<{ name: string, url: string, width: number, height: number }> };

export type PostCardFragment = { id: string, slug: string, title: string, excerpt: string, publishedAt: string, link: string, author: { id: string, slug: string, name: string, avatarUrl: string | null } | null, featuredMedia: { id: string, url: string, alt: string | null, width: number | null, height: number | null, sizes: Array<{ name: string, url: string, width: number, height: number }> } | null, sectors: Array<{ id: string, slug: string, name: string, taxonomy: Taxonomy }> };

export type PostDetailFragment = { id: string, slug: string, title: string, excerpt: string, contentHtml: string, publishedAt: string, modifiedAt: string, link: string, author: { description: string | null, id: string, slug: string, name: string, avatarUrl: string | null } | null, featuredMedia: { id: string, url: string, alt: string | null, width: number | null, height: number | null, sizes: Array<{ name: string, url: string, width: number, height: number }> } | null, sectors: Array<{ id: string, slug: string, name: string, taxonomy: Taxonomy }>, markets: Array<{ id: string, slug: string, name: string, taxonomy: Taxonomy }>, people: Array<{ id: string, slug: string, name: string, taxonomy: Taxonomy }>, companies: Array<{ id: string, slug: string, name: string, taxonomy: Taxonomy }>, tags: Array<{ id: string, slug: string, name: string, taxonomy: Taxonomy }> };

export type HomePageQueryVariables = Exact<{
  first: number;
}>;


export type HomePageQuery = { posts: { edges: Array<{ cursor: string, node: { id: string, slug: string, title: string, excerpt: string, publishedAt: string, link: string, author: { id: string, slug: string, name: string, avatarUrl: string | null } | null, featuredMedia: { id: string, url: string, alt: string | null, width: number | null, height: number | null, sizes: Array<{ name: string, url: string, width: number, height: number }> } | null, sectors: Array<{ id: string, slug: string, name: string, taxonomy: Taxonomy }> } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } }, sectors: Array<{ id: string, slug: string, name: string, taxonomy: Taxonomy }> };

export type HomePostsPageQueryVariables = Exact<{
  first: number;
  after: string | null | undefined;
}>;


export type HomePostsPageQuery = { posts: { edges: Array<{ cursor: string, node: { id: string, slug: string, title: string, excerpt: string, publishedAt: string, link: string, author: { id: string, slug: string, name: string, avatarUrl: string | null } | null, featuredMedia: { id: string, url: string, alt: string | null, width: number | null, height: number | null, sizes: Array<{ name: string, url: string, width: number, height: number }> } | null, sectors: Array<{ id: string, slug: string, name: string, taxonomy: Taxonomy }> } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type ArticlePageQueryVariables = Exact<{
  slug: string;
}>;


export type ArticlePageQuery = { post: { id: string, slug: string, title: string, excerpt: string, contentHtml: string, publishedAt: string, modifiedAt: string, link: string, author: { description: string | null, id: string, slug: string, name: string, avatarUrl: string | null } | null, featuredMedia: { id: string, url: string, alt: string | null, width: number | null, height: number | null, sizes: Array<{ name: string, url: string, width: number, height: number }> } | null, sectors: Array<{ id: string, slug: string, name: string, taxonomy: Taxonomy }>, markets: Array<{ id: string, slug: string, name: string, taxonomy: Taxonomy }>, people: Array<{ id: string, slug: string, name: string, taxonomy: Taxonomy }>, companies: Array<{ id: string, slug: string, name: string, taxonomy: Taxonomy }>, tags: Array<{ id: string, slug: string, name: string, taxonomy: Taxonomy }> } | null };

export type RelatedPostsQueryVariables = Exact<{
  taxonomy: Taxonomy;
  slug: string;
  first: number;
}>;


export type RelatedPostsQuery = { postsByTerm: { edges: Array<{ node: { id: string, slug: string, title: string, excerpt: string, publishedAt: string, link: string, author: { id: string, slug: string, name: string, avatarUrl: string | null } | null, featuredMedia: { id: string, url: string, alt: string | null, width: number | null, height: number | null, sizes: Array<{ name: string, url: string, width: number, height: number }> } | null, sectors: Array<{ id: string, slug: string, name: string, taxonomy: Taxonomy }> } }> } };

export type SectorPageQueryVariables = Exact<{
  slug: string;
  first: number;
}>;


export type SectorPageQuery = { postsByTerm: { edges: Array<{ cursor: string, node: { id: string, slug: string, title: string, excerpt: string, publishedAt: string, link: string, author: { id: string, slug: string, name: string, avatarUrl: string | null } | null, featuredMedia: { id: string, url: string, alt: string | null, width: number | null, height: number | null, sizes: Array<{ name: string, url: string, width: number, height: number }> } | null, sectors: Array<{ id: string, slug: string, name: string, taxonomy: Taxonomy }> } }> } };

export type SearchPostsQueryVariables = Exact<{
  query: string;
  first: number;
  after: string | null | undefined;
}>;


export type SearchPostsQuery = { searchPosts: { edges: Array<{ cursor: string, headline: string, node: { id: string, slug: string, title: string, excerpt: string, publishedAt: string, link: string, author: { id: string, slug: string, name: string, avatarUrl: string | null } | null, featuredMedia: { id: string, url: string, alt: string | null, width: number | null, height: number | null, sizes: Array<{ name: string, url: string, width: number, height: number }> } | null, sectors: Array<{ id: string, slug: string, name: string, taxonomy: Taxonomy }> } }>, pageInfo: { hasNextPage: boolean, endCursor: string | null } } };

export type SyncBadgeQueryVariables = Exact<{ [key: string]: never; }>;


export type SyncBadgeQuery = { syncStatus: { lastSuccessAt: string | null, postCount: number, status: string } };

export type SyncVisibilityQueryVariables = Exact<{
  limit: number;
  offset: number;
}>;


export type SyncVisibilityQuery = { syncRunCount: number, syncStatus: { lastRunAt: string | null, lastSuccessAt: string | null, postCount: number, status: string }, recentSyncRuns: Array<{ id: string, startedAt: string, finishedAt: string | null, modifiedAfter: string | null, postsUpserted: number, errors: number, status: string, notes: string | null }> };
