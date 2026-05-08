/**
 * Measure actual SQL statement counts for the GraphQL operations called
 * out in plan.md section 7. Run with:
 *
 *   pnpm tsx --env-file=.env.local scripts/measure-queries.ts
 *
 * The script wraps the Drizzle relational client used by the GraphQL
 * resolvers in a counting proxy so we observe every query the resolver
 * layer issues. Authoritative output goes to stderr (so the count is
 * easy to capture from a CI pipeline) and a brief summary to stdout.
 *
 * Numbers reported here are the source of truth for
 * `docs/measurements/query-counts.md`. Do NOT hand-edit that file with
 * different numbers; re-run this script.
 */
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { createYoga } from "graphql-yoga";

import * as schema from "../src/db/schema";
import * as relations from "../src/db/relations";
import { schema as gqlSchema } from "../src/graphql/schema";
import { makeAuthorLoader, makeMediaLoader, makeTermLoader } from "../src/graphql/loaders";
import type { GraphQLContext } from "../src/graphql/context";
import { posts as postsTable } from "../src/db/schema";
import { desc, eq } from "drizzle-orm";

interface CountingLogger {
  count: number;
  reset(): void;
  logQuery(query: string): void;
}

function makeCountingLogger(): CountingLogger {
  return {
    count: 0,
    reset() {
      this.count = 0;
    },
    logQuery() {
      this.count += 1;
    },
  };
}

function buildCountingDb(logger: CountingLogger) {
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL must be set");
  }
  const client = neon(connectionString);
  return drizzle({
    client,
    schema: { ...schema, ...relations },
    logger,
  });
}

async function runOperation(
  // Yoga's instance signature is heavily generic; the script only ever
  // pokes the fetch entrypoint, so loosen to `any` here on purpose.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  yoga: any,
  query: string,
  variables: Record<string, unknown>,
): Promise<unknown> {
  const req = new Request("http://localhost/api/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const res = await yoga.fetch(req, {});
  return res.json();
}

async function main(): Promise<void> {
  const logger = makeCountingLogger();
  const countingDb = buildCountingDb(logger);

  // Pull a real slug to use in the post(slug) measurement and a real
  // sector slug for the postsByTerm measurement.
  const [latest] = await countingDb
    .select({ slug: postsTable.slug })
    .from(postsTable)
    .where(eq(postsTable.status, "publish"))
    .orderBy(desc(postsTable.publishedAt))
    .limit(1);
  if (!latest) {
    throw new Error("no posts in DB; run scripts/backfill.ts first");
  }
  const realSlug = latest.slug;

  // Get a sector slug that has at least one post linked.
  const sectorRows = (await countingDb.execute(
    sql`
      select t.slug as slug
      from terms t
      join post_terms pt on pt.term_id = t.id
      where t.taxonomy = 'sector'
      group by t.slug
      having count(*) > 0
      order by t.slug
      limit 1
    `,
  )) as unknown as { slug: string }[] | { rows: { slug: string }[] };
  const sectorList = Array.isArray(sectorRows)
    ? sectorRows
    : sectorRows.rows;
  const realSectorSlug = sectorList[0]?.slug;
  if (!realSectorSlug) {
    throw new Error("no sectors linked in DB; run scripts/backfill.ts first");
  }

  // Reset counter to start fresh for measurement.
  logger.reset();

  // Build a minimal GraphQL context that uses our counting db so every
  // resolver-issued query is observed. We can't reuse buildContext()
  // because that imports the production `db` singleton.
  function buildCountingContext(): GraphQLContext {
    return {
      db: countingDb as GraphQLContext["db"],
      loaders: {
        author: makeAuthorLoader(),
        media: makeMediaLoader(),
        term: makeTermLoader(),
      },
    };
  }

  const yoga = createYoga({
    schema: gqlSchema,
    context: () => buildCountingContext(),
    graphqlEndpoint: "/api/graphql",
    graphiql: false,
    fetchAPI: { Response, Request },
  });

  // Operation 1: homepage query.
  logger.reset();
  const homepageQuery = /* GraphQL */ `
    query Homepage {
      posts(first: 10) {
        edges {
          cursor
          node {
            id
            slug
            title
            publishedAt
            author {
              id
              name
              avatarUrl
            }
            featuredMedia {
              id
              url
              alt
            }
            sectors {
              id
              slug
              name
            }
            markets {
              id
              slug
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;
  await runOperation(yoga, homepageQuery, {});
  const homepageCount = logger.count;
  process.stderr.write(`homepage: ${homepageCount} SQL statements\n`);

  // Operation 2: article-detail query.
  logger.reset();
  const detailQuery = /* GraphQL */ `
    query Detail($slug: String!) {
      post(slug: $slug) {
        id
        slug
        title
        contentHtml
        publishedAt
        author {
          id
          name
        }
        featuredMedia {
          id
          url
          sizes {
            name
            url
            width
            height
          }
        }
        sectors {
          id
          slug
        }
        markets {
          id
          slug
        }
        tags {
          id
          slug
        }
      }
    }
  `;
  await runOperation(yoga, detailQuery, { slug: realSlug });
  const detailCount = logger.count;
  process.stderr.write(`post(slug): ${detailCount} SQL statements\n`);

  // Operation 3: postsByTerm query.
  logger.reset();
  const postsByTermQuery = /* GraphQL */ `
    query PostsByTerm($taxonomy: Taxonomy!, $slug: String!) {
      postsByTerm(taxonomy: $taxonomy, slug: $slug, first: 10) {
        edges {
          cursor
          node {
            id
            slug
            title
            author {
              id
              name
            }
            featuredMedia {
              id
              url
            }
            sectors {
              id
              slug
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;
  await runOperation(yoga, postsByTermQuery, {
    taxonomy: "SECTOR",
    slug: realSectorSlug,
  });
  const postsByTermCount = logger.count;
  process.stderr.write(`postsByTerm: ${postsByTermCount} SQL statements\n`);

  // Final summary on stdout.
  console.log(
    JSON.stringify(
      {
        homepage: homepageCount,
        post: detailCount,
        postsByTerm: postsByTermCount,
        homepageProbeSlug: realSlug,
        sectorProbeSlug: realSectorSlug,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
