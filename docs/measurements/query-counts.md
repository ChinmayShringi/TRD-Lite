# Measured GraphQL to SQL query counts

Recorded against Neon Postgres in development with Drizzle's `logger`
flag enabled. The counts below come from running `scripts/measure-queries.ts`
against a DB populated with 48 backfilled posts.

Re-run via:

```bash
pnpm tsx --env-file=.env.local scripts/measure-queries.ts
```

The script wraps the same Drizzle relational client the GraphQL
resolvers use in a counting proxy and feeds it through Yoga's `fetch`
handler so every resolver-issued statement is observed.

## Results

| GraphQL operation                       | SQL statements |
| --- | --- |
| `posts(first: 10)` (homepage)           | 1 |
| `post(slug: $slug)` (article detail)    | 1 |
| `postsByTerm(taxonomy, slug, first: 10)` | 2 |

## Why these numbers

The list-page resolvers are built on Drizzle's relational query API
(`db.query.posts.findMany({ with: { author, featuredMedia, terms: { with: { term } } } })`),
which Drizzle plans as a single SQL statement that returns a
JSON-aggregated graph in one round trip. That is the N+1 prevention
described in plan.md section 7: query count is bounded by relation
depth, not by page size.

The detail resolver uses `findFirst` with the same `with` clause and
also runs in one statement.

`postsByTerm` runs two statements: a small `SELECT post_id FROM
post_terms JOIN terms WHERE taxonomy = ? AND slug = ?` allowlist query,
followed by the main relational query keyed on the resulting post ids.
We chose this two-step shape over a single inline subquery because it
keeps the relational hydration intact (Drizzle's relational helper
needs a top-level table-only `findMany` call) and the allowlist query
is index-supported (`terms_taxonomy_slug_unique` + `post_terms_term_id_idx`).

DataLoader factories (`makeAuthorLoader`, `makeMediaLoader`,
`makeTermLoader`) are wired into the per-request context as a fallback
for any future resolver that bypasses the relational query. With the
current resolvers they do not fire on the operations measured above
because the relational hydration has already populated the parent
fields by the time field resolvers run.
