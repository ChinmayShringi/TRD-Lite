/**
 * Shared GraphQL query fragments and queries used across the Server
 * Component pages. Hand-written strings (no codegen) per plan.md
 * section 4: with Server Components fetching from the in-process Yoga
 * handler we never benefit from a client-side GraphQL framework.
 *
 * Convention: every fragment ends with the trailing `\n` so consumers
 * can concatenate them next to a query template literal without
 * worrying about whitespace. Each query string interpolates the
 * fragments it depends on at the bottom.
 */

/** Smallest projection of a Term used inside Post cards. */
export const TermFieldsFragment = /* GraphQL */ `
  fragment TermFields on Term {
    id
    slug
    name
    taxonomy
  }
`;

/** Author byline projection for a card or article header. */
export const AuthorFieldsFragment = /* GraphQL */ `
  fragment AuthorFields on Author {
    id
    slug
    name
    avatarUrl
  }
`;

/** Featured image with the size set the FeaturedImage component picks from. */
export const MediaFieldsFragment = /* GraphQL */ `
  fragment MediaFields on Media {
    id
    url
    alt
    width
    height
    sizes {
      name
      url
      width
      height
    }
  }
`;

/** Card-level Post fields. Sufficient to render <ArticleCard>/<ArticleHero>. */
export const PostCardFragment = /* GraphQL */ `
  fragment PostCard on Post {
    id
    slug
    title
    excerpt
    publishedAt
    link
    author {
      ...AuthorFields
    }
    featuredMedia {
      ...MediaFields
    }
    sectors {
      ...TermFields
    }
  }
`;

/** Article-detail projection. Includes contentHtml + extra term groups. */
export const PostDetailFragment = /* GraphQL */ `
  fragment PostDetail on Post {
    id
    slug
    title
    excerpt
    contentHtml
    publishedAt
    modifiedAt
    link
    author {
      ...AuthorFields
      description
    }
    featuredMedia {
      ...MediaFields
    }
    sectors {
      ...TermFields
    }
    markets {
      ...TermFields
    }
    people {
      ...TermFields
    }
    companies {
      ...TermFields
    }
    tags {
      ...TermFields
    }
  }
`;

/** Homepage query: hero + grid posts + sector chips. */
export const HomePageQuery = /* GraphQL */ `
  query HomePage($first: Int!) {
    posts(first: $first) {
      edges {
        cursor
        node {
          ...PostCard
        }
      }
    }
    sectors {
      ...TermFields
    }
  }
  ${PostCardFragment}
  ${AuthorFieldsFragment}
  ${MediaFieldsFragment}
  ${TermFieldsFragment}
`;

/** Article-detail query (one slug at a time). */
export const ArticlePageQuery = /* GraphQL */ `
  query ArticlePage($slug: String!) {
    post(slug: $slug) {
      ...PostDetail
    }
  }
  ${PostDetailFragment}
  ${AuthorFieldsFragment}
  ${MediaFieldsFragment}
  ${TermFieldsFragment}
`;

/**
 * Related posts pulled by the article page. We re-use the existing
 * `postsByTerm` query which already supports cursor pagination; the
 * caller filters out the current post by slug.
 */
export const RelatedPostsQuery = /* GraphQL */ `
  query RelatedPosts($taxonomy: Taxonomy!, $slug: String!, $first: Int!) {
    postsByTerm(taxonomy: $taxonomy, slug: $slug, first: $first) {
      edges {
        node {
          ...PostCard
        }
      }
    }
  }
  ${PostCardFragment}
  ${AuthorFieldsFragment}
  ${MediaFieldsFragment}
  ${TermFieldsFragment}
`;

/** Sector landing page query. */
export const SectorPageQuery = /* GraphQL */ `
  query SectorPage($slug: String!, $first: Int!) {
    postsByTerm(taxonomy: SECTOR, slug: $slug, first: $first) {
      edges {
        cursor
        node {
          ...PostCard
        }
      }
    }
  }
  ${PostCardFragment}
  ${AuthorFieldsFragment}
  ${MediaFieldsFragment}
  ${TermFieldsFragment}
`;

/** Footer SyncBadge query: returns the last successful sync timestamp. */
export const SyncBadgeQuery = /* GraphQL */ `
  query SyncBadge {
    syncStatus {
      lastSuccessAt
      postCount
      status
    }
  }
`;

/**
 * Sync-visibility query used by both `/sync-status` (public) and
 * `/admin/sync` (Basic-Auth-protected). Combines the operational
 * summary with the last N sync_runs rows so each page only needs one
 * GraphQL round trip.
 */
export const SyncVisibilityQuery = /* GraphQL */ `
  query SyncVisibility($limit: Int!) {
    syncStatus {
      lastRunAt
      lastSuccessAt
      postCount
      status
    }
    recentSyncRuns(limit: $limit) {
      id
      startedAt
      finishedAt
      modifiedAfter
      postsUpserted
      errors
      status
      notes
    }
  }
`;

// ---------- TypeScript shapes returned by the queries above. We hand
// type these in lieu of graphql-codegen for now; codegen is on the
// Wave-10 polish list per plan.md section 15.

export interface TermFields {
  id: string;
  slug: string;
  name: string;
  taxonomy: string;
}

export interface AuthorFields {
  id: string;
  slug: string;
  name: string;
  avatarUrl: string | null;
  description?: string | null;
}

export interface MediaSizeFields {
  name: string;
  url: string;
  width: number;
  height: number;
}

export interface MediaFields {
  id: string;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  sizes: MediaSizeFields[];
}

export interface PostCard {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  link: string;
  author: AuthorFields | null;
  featuredMedia: MediaFields | null;
  sectors: TermFields[];
}

export interface PostDetail extends PostCard {
  contentHtml: string;
  modifiedAt: string;
  markets: TermFields[];
  people: TermFields[];
  companies: TermFields[];
  tags: TermFields[];
}

export interface PostEdge<T> {
  cursor: string;
  node: T;
}

export interface PostConnection<T> {
  edges: PostEdge<T>[];
}

export interface SyncStatusFields {
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  postCount: number;
  status: string;
}

export interface SyncRunFields {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  modifiedAfter: string | null;
  postsUpserted: number;
  errors: number;
  status: string;
  notes: string | null;
}

export interface SyncVisibilityData {
  syncStatus: SyncStatusFields;
  recentSyncRuns: SyncRunFields[];
}
