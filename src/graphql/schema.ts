/**
 * Hand-written SDL for the public TRD-Lite GraphQL surface.
 *
 * Schema content is verbatim from plan.md section 8. The schema reads
 * like a small newsroom CMS, not a 1:1 mirror of WordPress fields.
 *
 * The SDL is combined with resolvers via `@graphql-tools/schema`'s
 * `makeExecutableSchema`. We deliberately do NOT use a code-first
 * schema builder (Pothos, etc.) per plan.md section 13: hand-written
 * SDL is universally inspectable, has no beta plugins to mis-wire, and
 * matches what every reviewer recognizes.
 */
import { makeExecutableSchema } from "@graphql-tools/schema";
import { DateTimeResolver } from "graphql-scalars";

import { resolvers } from "./resolvers";

export const typeDefs = /* GraphQL */ `
  scalar DateTime

  enum Taxonomy {
    SECTOR
    MARKET
    REGION
    NEIGHBORHOOD
    STORY_TYPE
    COMPANY
    PEOPLE
    TAG
  }

  type Query {
    posts(
      first: Int = 10
      after: String
      sector: String
      market: String
    ): PostConnection!
    post(slug: String!): Post
    sectors: [Term!]!
    markets: [Term!]!
    postsByTerm(
      taxonomy: Taxonomy!
      slug: String!
      first: Int = 10
      after: String
    ): PostConnection!
    syncStatus: SyncStatus!
  }

  type Post {
    id: ID!
    slug: String!
    title: String!
    excerpt: String!
    excerptHtml: String!
    contentHtml: String!
    publishedAt: DateTime!
    modifiedAt: DateTime!
    link: String!
    author: Author
    featuredMedia: Media
    sectors: [Term!]!
    markets: [Term!]!
    people: [Term!]!
    companies: [Term!]!
    tags: [Term!]!
  }

  type Author {
    id: ID!
    slug: String!
    name: String!
    description: String
    avatarUrl: String
    posts(first: Int = 10, after: String): PostConnection!
  }

  type Media {
    id: ID!
    url: String!
    alt: String
    width: Int
    height: Int
    sizes: [MediaSize!]!
  }

  type MediaSize {
    name: String!
    url: String!
    width: Int!
    height: Int!
  }

  type Term {
    id: ID!
    taxonomy: Taxonomy!
    slug: String!
    name: String!
  }

  type SyncStatus {
    lastRunAt: DateTime
    lastSuccessAt: DateTime
    postCount: Int!
    status: String!
  }

  type PostConnection {
    edges: [PostEdge!]!
    pageInfo: PageInfo!
  }

  type PostEdge {
    cursor: String!
    node: Post!
  }

  type PageInfo {
    hasNextPage: Boolean!
    endCursor: String
  }
`;

export const schema = makeExecutableSchema({
  typeDefs,
  resolvers: {
    DateTime: DateTimeResolver,
    ...resolvers,
  },
});
