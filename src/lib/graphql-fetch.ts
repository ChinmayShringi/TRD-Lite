/**
 * Typed GraphQL fetch wrapper used by Server Components to talk to the
 * in-process Yoga handler at `/api/graphql`.
 *
 * Why this and not Apollo/urql: per plan.md section 4, "plain `fetch`
 * from Server Components, with `graphql-tag` for queries". Server
 * Components fetch from `/api/graphql` server-side and emit static
 * HTML; no client GraphQL framework is required and the bundle stays
 * small.
 *
 * The wrapper integrates with Next's Data Cache via `next: { tags,
 * revalidate }`. The sync handler calls `revalidateTag(tag)` after
 * every upsert so cached responses update on schedule, and a 5-minute
 * `revalidate` is the safety net that catches a missed sync.
 */
const DEFAULT_REVALIDATE = 300;

function resolveEndpoint(): string {
  // 1. Explicit override wins (used by integration tests, ad-hoc local
  //    pointers, etc.).
  const override = process.env.GRAPHQL_ENDPOINT;
  if (override && override.length > 0) return override;

  // 2. On Vercel, `VERCEL_URL` is the bare hostname of the current
  //    deployment. Use it so the same code can fetch its own GraphQL
  //    endpoint in preview/production without hard-coding domains.
  const vercelHost = process.env.VERCEL_URL;
  if (vercelHost && vercelHost.length > 0) {
    return `https://${vercelHost}/api/graphql`;
  }

  // 3. Local fallback. Matches `next dev`'s default port.
  return "http://localhost:3000/api/graphql";
}

export interface GraphQLFetchOptions {
  /** Next.js Data Cache tags. The sync handler invalidates these. */
  tags?: string[];
  /** Time-based fallback revalidation in seconds (defaults to 300). */
  revalidate?: number;
}

export class GraphQLFetchError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "GraphQLFetchError";
  }
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

/**
 * Issues a single GraphQL operation against the in-process Yoga route.
 * Throws `GraphQLFetchError` on transport, status, schema, or empty
 * data conditions so callers do not have to thread error envelopes.
 */
export async function gqlFetch<T>(
  query: string,
  variables?: Record<string, unknown>,
  options: GraphQLFetchOptions = {},
): Promise<T> {
  const endpoint = resolveEndpoint();
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      next: {
        tags: options.tags,
        revalidate: options.revalidate ?? DEFAULT_REVALIDATE,
      },
    });
  } catch (err) {
    throw new GraphQLFetchError("network error fetching GraphQL", err);
  }

  if (!res.ok) {
    throw new GraphQLFetchError(`GraphQL HTTP ${res.status}`);
  }

  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors && json.errors.length > 0) {
    throw new GraphQLFetchError(
      `GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`,
    );
  }
  if (!json.data) {
    throw new GraphQLFetchError("GraphQL: empty data");
  }
  return json.data;
}
