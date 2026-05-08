/**
 * GraphQL route handler. GraphQL Yoga is mounted at `/api/graphql` with
 * GraphiQL enabled outside production.
 *
 * The Yoga handler returned by `createYoga` is a Fetch API handler.
 * Next.js App Router Route Handlers also pass `Request` in (and a
 * second positional argument with `params`, which we ignore here).
 * Re-exporting Yoga directly works in the latest versions but we wrap
 * with thin handlers to make the intent explicit and avoid any future
 * signature drift.
 */
import { createYoga } from "graphql-yoga";

import { schema } from "@/src/graphql/schema";
import { buildContext } from "@/src/graphql/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const yoga = createYoga<{ req: Request }>({
  schema,
  // Per-request context: every operation gets its own DataLoader cache.
  context: () => buildContext(),
  graphqlEndpoint: "/api/graphql",
  graphiql: process.env.NODE_ENV !== "production",
  fetchAPI: { Response, Request },
});

export async function GET(request: Request): Promise<Response> {
  return yoga.handle(request, { req: request });
}

export async function POST(request: Request): Promise<Response> {
  return yoga.handle(request, { req: request });
}

export async function OPTIONS(request: Request): Promise<Response> {
  return yoga.handle(request, { req: request });
}
