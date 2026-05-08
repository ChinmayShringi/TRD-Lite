// Singleton Drizzle client backed by Neon's HTTP serverless driver.
// HTTP fits Vercel's request-scoped function lifecycle: there are no
// long-lived TCP sockets, so cold starts and concurrent invocations
// behave well. We prefer the unpooled URL with the neon-http driver:
// PgBouncer adds latency for short-lived HTTP queries, so the direct
// connection is faster here. The pooled URL is the fallback when the
// unpooled value is not provided.
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";

import * as schema from "./schema";
import * as relations from "./relations";

const connectionString =
  process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL_UNPOOLED or DATABASE_URL must be set. Run `vercel env pull .env.local` first.",
  );
}

const client = neon(connectionString);

export const db = drizzle({
  client,
  schema: { ...schema, ...relations },
});

export { schema, relations };
