# TRD Lite

[![CI](https://github.com/ChinmayShringi/TRD-Lite/actions/workflows/ci.yml/badge.svg)](https://github.com/ChinmayShringi/TRD-Lite/actions/workflows/ci.yml)
[![Live](https://img.shields.io/badge/live-trd--lite--takehome.vercel.app-1F6FEB?logo=vercel&logoColor=white)](https://trd-lite-takehome.vercel.app)

> **TRD Lite** is a 500-post mirror of The Real Deal, served through a typed GraphQL API and a cache-aware Next.js frontend, kept fresh by an incremental sync against the WordPress REST endpoint. Built with security, accessibility, and SEO baked in.

## TL;DR

- **Live:** <https://trd-lite-takehome.vercel.app>
- **Stack:** Next.js 15 (App Router) + GraphQL Yoga (hand-written SDL) + DataLoader + Drizzle + Neon Postgres
- **Sync:** Vercel Cron at `0 6 * * *` calls `/api/sync` daily; the same protected endpoint plus a Basic-Auth-protected `/admin/sync` force-sync UI cover ad-hoc refresh. Production currently mirrors **509 posts**.
- **Cache:** Postgres is the durable server-side cache for WordPress data; Next.js Data Cache plus tag-based revalidation is the presentation cache on top. The browser is not responsible for freshness. No Redis. About ten lines of cache code in total.
- **Demo entrypoints:** `/sync-status` (public read-only run history), `/api/graphql` (GraphiQL in dev), `/search?q=manhattan`, `/api/healthz`.

## Beyond the brief

The assignment asked for a homepage with 5+ articles, a basic article page, GraphQL on top of cached WordPress data, and a README. Everything below was shipped on top of that, on the same Vercel free tier, inside the same week:

- **Listen to any article.** A browser-native text-to-speech control on every article page, powered by the Web Speech API. Zero backend cost, zero API key, audio synthesized on the reader's device. Voice priority is locked to natural-sounding US English female voices (Microsoft Jenny Online, Aria Online, Samantha, Google US English Female, Zira); if the device exposes none of them, the control hides itself instead of falling through to the robotic platform default. *Production path:* swap the synthesis layer for ElevenLabs (or a fine-tuned house voice), cache the audio in Vercel Blob keyed by `slug + content_hash`, and serve the MP3 from the same Listen button.
- **Inline YouTube embeds.** TRD articles often embed video. The sanitize-html allowlist permits `<iframe>` for YouTube and the rendered HTML carries the embeds end-to-end so the article page reads the way the editor wrote it.
- **Infinite scroll on the homepage.** Cursor-based GraphQL pagination + an `IntersectionObserver`-driven loader keeps appending older stories as the reader nears the bottom. The grid never collapses; skeletons hold the layout during the fetch.
- **Full-text search.** Postgres `tsvector` with a GIN index, `ts_rank` ordering, and a `/search?q=` page with debounced query, highlighted matches, and a results-count chip. Powered by a real GraphQL field (`searchPosts`), not a hand-rolled `LIKE`.
- **Light + dark theme, first-class.** A pre-hydration script in `app/layout.tsx` reads the saved preference (or `prefers-color-scheme`) before paint, so there is no flash of the wrong theme. Every component reads cleanly in both modes; no manual color overrides.
- **Responsive across phone, tablet, desktop.** Editorial density preserved across breakpoints; mobile shows a left-drawer masthead with hamburger, search, primary nav, categories, and theme toggle. Desktop shows a full inline nav with categories dropdown and inline search.
- **Accessibility audited, not assumed.** WCAG-conscious target (working toward 2.1 AA). Playwright + axe-core run in CI on `/` and an article page; serious or critical violations fail the build. Result on production: zero. The "Listen" button is itself an a11y feature.
- **CI/CD with three gated jobs.** GitHub Actions runs `lint + typecheck + codegen-drift + build`, then `vitest` (40 tests), then `playwright + axe-core` (5 e2e tests), with the test jobs gated on `needs: [static]`. Every push to `main` runs the full suite; the README CI badge is live.
- **Type-safe GraphQL end to end.** `graphql-codegen` generates operation types from the hand-written SDL; a `pnpm codegen:check` step in CI fails the build if `__generated__/` drifts from the schema. No untyped `any` between resolver and page.
- **Security headers + CSP.** `next.config.ts` ships Content-Security-Policy, `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, plus a Playwright-verified guarantee that `SYNC_TOKEN` never reaches the browser.
- **Public sync-status + Basic-Auth admin.** `/sync-status` shows the last 20 sync runs without credentials. `/admin/sync` sits behind HTTP Basic Auth (edge-middleware decoded, constant-time compared), with a server-action force-sync that re-reads the token server-side.
- **JSON-LD `NewsArticle`, sitemap, canonical-back-to-TRD.** Every article emits structured data for SERP and AI summarizers; the canonical points back to therealdeal.com so source credit stays where it belongs.
- **Skeletons over spinners.** Every awaited fetch (homepage cards, article body, search) paints a layout-faithful skeleton. The grid never jumps, the page never collapses.
- **Honest operational receipts.** `docs/measurements/query-counts.md` records measured SQL counts per GraphQL operation. `docs/orchestration/orchestration-plan.md` is the wave-by-wave execution trace. The README only quotes numbers that were actually measured.

## Quick start

```bash
git clone git@github.com:ChinmayShringi/TRD-Lite.git
cd TRD-Lite
pnpm install

# Either pull env from a linked Vercel project (with Neon Marketplace integration):
vercel link && vercel env pull .env.local
# Or copy the example and fill in your own DATABASE_URL (Neon free tier at neon.tech),
# SYNC_TOKEN (any 32-byte hex), ADMIN_USER, ADMIN_PASS:
# cp .env.example .env.local

pnpm db:migrate                    # apply Drizzle migrations to Neon
pnpm tsx --env-file=.env.local scripts/backfill.ts   # seed ~500 posts from TRD's WP API
pnpm dev                           # http://localhost:3000
```

Tests: `pnpm test` (Vitest unit + integration), `pnpm test:e2e` (Playwright + axe-core).

## Architecture

```mermaid
flowchart LR
    WP[WordPress REST<br/>therealdeal.com/wp-json] -->|"?_embed=1<br/>?modified_after=cursor"| SYNC["/api/sync<br/>(bearer-protected)"]
    CRON[Vercel Cron<br/>0 6 * * *] --> SYNC
    ADMIN["/admin/sync<br/>(Basic Auth)"] -->|server action| SYNC
    SYNC -->|idempotent upsert<br/>txn per page| DB[(Neon Postgres<br/>iad1)]
    SYNC -->|revalidateTag| CACHE[Next.js Data Cache<br/>+ Full Route Cache]
    DB --> GQL["/api/graphql<br/>Yoga + DataLoader"]
    GQL --> RSC["React Server Components<br/>app/page.tsx, app/article/[slug]"]
    CACHE --> RSC
    RSC --> CDN[Vercel Edge / CDN]
    CDN --> BROWSER[Browser]
```

A daily Vercel Cron hits the bearer-protected `/api/sync` route. The handler reads `max(posts.modified_at) - 60s` as a cursor, pages through `wp/v2/posts?_embed=1&modified_after=...`, and idempotently upserts media, authors, terms, posts, and post_terms in that order, one transaction per page (Neon WebSocket driver). After upserts it calls `revalidateTag` for `homepage`, `post:{slug}`, `sector:{slug}`, and `market:{slug}` so the next visitor sees fresh content. Server Components fetch from `/api/graphql` over plain `fetch` with `next: { tags, revalidate: 300 }`. The frontend never imports from `src/db/`; the GraphQL layer is the only entrance to the database.

## Decisions and tradeoffs

| Choice | What I picked | Why |
| --- | --- | --- |
| App topology | Single Next.js app, GraphQL Yoga mounted at `/api/graphql` | One repo, one deploy, one process model. The GraphQL layer is folder-isolated under `src/graphql/`, so lifting it to a Hono service later is a few hours of work. The brief said "Use Next.js for the frontend and GraphQL for the API layer"; this satisfies the wording without over-deploying. |
| ORM | Drizzle | Native serverless story (works with Neon's HTTP and WebSocket drivers), small bundle, type-safe relational queries. Translates 1:1 to Prisma if recognizability matters more than runtime fit. |
| GraphQL schema style | Hand-written SDL + `makeExecutableSchema` | Universal, inspectable, no beta plugins. Pothos's drizzle plugin was beta at the time and Claude Code can mis-wire framework-specific abstractions. SDL plus a typed resolver map is the lowest-risk shape with `graphql-codegen` adding type safety on top. |
| GraphQL client | Plain `fetch` from Server Components | Apollo Client and urql are designed for client-side state. RSC fetches server-side, hydrates as static HTML, and the browser never sees a GraphQL framework. Drops well over 100 KB from the bundle. |
| Sync model | Cron-based incremental sync via `?modified_after` | Pull-on-request would make the demo a DoS amplifier and let WP outages take the site down. Webhooks would be ideal but require a WP plugin we cannot install on TRD's prod CMS. Cron + cursor + idempotent upsert is the stable middle ground. |
| N+1 prevention | Drizzle relational queries first, DataLoader as a fallback | List pages issue **1 SQL** for `posts(first:10)` and **1 SQL** for `post(slug)`; `postsByTerm` is **2 SQL** (allowlist + relational). Measured with Drizzle's `logger: true` flag; counts recorded in [`docs/measurements/query-counts.md`](docs/measurements/query-counts.md). DataLoader factories are wired into the per-request context so any future chatty resolver gets batching for free. |
| Cache layering | Postgres as the durable server-side cache + Next.js Data Cache (tag invalidation) + 300s time-based safety net | The browser is not the cache. WordPress is touched only by the sync worker; user requests read from Postgres through GraphQL, with Next.js tag-based cache revalidation on top. About ten lines of cache code in the whole app. |
| No Redis | Skipped on purpose | Neon with proper indexes returns the homepage query in single-digit ms and Next's Data Cache fronts that. Redis would be a fourth tier with no observable benefit and one extra failure mode. |
| Sync visibility | Public read-only `/sync-status` + Basic-Auth `/admin/sync` | The public page lets a reviewer click one URL to see the system is alive. The admin page carries the only mutation-shaped action (force-sync) and sits behind HTTP Basic Auth via `middleware.ts`. The bearer token is read server-side inside a server action and never reaches the browser, verified by a Playwright check. |
| Schema shape | Project the parts of WP that matter, keep `raw jsonb` everywhere | 8 to 10 KB per post is trivial at this scale. ACF and yoast field shapes drift; the JSONB safety net lets us add columns later without re-syncing from upstream. |

## How caching works

There are several caches, in different places. The browser is the least important one. The real caching story is server-side, with Postgres as the durable layer and Next.js/Vercel cache as the presentation layer on top.

```
WordPress REST API
  |  touched ONLY by the sync worker on a cron schedule
  v
Sync worker (lib/sync.ts)
  |  pulls with ?modified_after cursor, sanitizes HTML on write
  v
Neon Postgres          <-- the durable server-side cache
  |  every user request reads from here, never from WordPress
  v
GraphQL resolver layer (Drizzle relational queries + per-request DataLoader)
  v
Next.js Data Cache     <-- the presentation cache on top of Postgres
  |  fetch('/api/graphql', { next: { tags, revalidate: 60..300 } })
  |  revalidateTag(tag) invalidates these on writes from /api/sync
  v
Next.js Full Route Cache + Vercel CDN
  |  static generation for /, /sector/[slug], /article/[slug]; 300s safety net
  v
Browser
  |  prefetched <Link> targets and standard HTTP asset cache
  |  not responsible for content freshness
```

**Where the cache actually lives.**

- **Postgres is the durable cache.** WordPress is the source of truth; Neon Postgres is the served-from store. The frontend never calls WordPress directly. This is what satisfies the brief's "store/cache the WordPress data locally" requirement, and it is what keeps user requests fast and isolates the app from upstream WP latency or outages.
- **Next.js Data Cache + tag invalidation is the presentation cache.** Server components call `fetch('/api/graphql', { next: { tags, revalidate } })`, so warm requests skip the resolver and the DB entirely for the revalidate window. After every successful sync, `/api/sync` fires `revalidateTag('homepage')`, `post:{slug}`, and `sector:{slug}` so new stories appear within seconds of the cron tick, not at the 300-second timer.
- **The browser is not in charge of freshness.** It may cache prefetched route payloads and static assets via standard HTTP headers, but no content invariant depends on it.

### Tag taxonomy

| Tag | Used by | Invalidated when |
| --- | --- | --- |
| `homepage` | `/` (latest articles) | Any post in the homepage window changes |
| `post:{slug}` | `/article/{slug}` | That specific post changes |
| `sector:{slug}` | `/sector/{slug}` | Any post in that sector changes |
| `market:{slug}` | (reserved for `/market/{slug}`) | Any post in that market changes |

### N+1 prevention, measured

The temptation is `posts → 10 author queries → 10 media queries → 30 term queries = 51 SQL`. Drizzle's relational query API plans the homepage as a single statement with a JSON-aggregated graph:

```ts
db.query.posts.findMany({
  with: { author: true, featuredMedia: true, terms: { with: { term: true } } },
});
```

Measured (see `docs/measurements/query-counts.md`):

| GraphQL operation | SQL statements |
| --- | --- |
| `posts(first: 10)` | 1 |
| `post(slug: $slug)` | 1 |
| `postsByTerm(taxonomy, slug, first: 10)` | 2 |

`postsByTerm` runs two statements (taxonomy allowlist + main relational query) on purpose: keeping the relational hydration intact requires a top-level table-only `findMany`, and the allowlist query is index-supported by `terms_taxonomy_slug_unique` and `post_terms_term_id_idx`. DataLoader factories sit in the per-request context as a guaranteed-batching fallback for any future resolver that bypasses the relational query.

## How sync works

`lib/sync.ts` owns the sync pipeline; `app/api/sync/route.ts` is the bearer-protected HTTP handler.

- **Cursor.** `max(posts.modified_at)` minus a 60-second safety overlap. Overlap is fine because every entity uses `INSERT ... ON CONFLICT DO UPDATE`. An empty database means "no `modified_after` parameter" and the worker pages from the most recent post backwards.
- **Pagination.** `?_embed=1&per_page=100&orderby=modified&order=asc&modified_after={cursor}` with a 1-second delay between pages and exponential backoff on 5xx.
- **Upsert order.** Media -> authors -> terms -> posts -> post_terms. Foreign keys are satisfied at every step; no orphaned references mid-page.
- **Transaction per page.** A single Drizzle transaction wraps each 100-post page using the Neon WebSocket driver. If a page fails, the cursor does not advance and the next run retries the same window.
- **Sanitization on write.** `lib/sanitize.ts` runs `sanitize-html` with an editorial allowlist (img, figure, figcaption, iframe, section; classes preserved; `<a>` rewritten to `rel="noopener noreferrer"`) before content_html lands in the DB. Pay the CPU cost once per post, not per view; the DB never holds dangerous HTML, even briefly.
- **Cache invalidation.** After upserts, the handler calls `revalidateTag('homepage')`, `revalidateTag('post:{slug}')` for each touched post, and `revalidateTag('sector:{slug}')` for each affected sector. Outside a Next request context (e.g., the standalone backfill script) the calls log a warning and continue; the 300-second time-based revalidate is the safety net.
- **Operational log.** Every run writes a row to `sync_runs` (started_at, finished_at, modified_after, posts_upserted, errors, status, notes). `/sync-status` reads the last 20 rows.

**What is unsolved.** Deletes upstream are invisible to a `modified_after` sweep: the WP endpoint just stops returning the row. v1 does not detect deletes. The right next step is a slow full-ID sweep (e.g., once a day) that diffs against the local table; called out in *What I'd do next*.

## Security

- **HTML sanitization at sync time.** WordPress `content.rendered` is HTML, and treating CMS HTML as trusted application code is the most common vulnerability in headless WP setups. We sanitize on write with an allowlist tuned for editorial markup, then store only the cleaned HTML.
- **Content-Security-Policy** plus three other security headers, set globally in `next.config.ts`. The current policy is intentionally permissive (`script-src 'self' 'unsafe-inline'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' https: data: blob:`) because the JSON-LD tag inlines on article pages, Tailwind injects runtime styles, and TRD's editorial images live across multiple CDN subdomains. `'unsafe-eval'` is appended only in development for Next's HMR pipeline; production responses do not include it. `frame-ancestors 'none'` and `X-Frame-Options: DENY` together cover click-jacking. `Referrer-Policy: strict-origin-when-cross-origin` and `X-Content-Type-Options: nosniff` cover the rest of the OWASP secure-headers shortlist.
- **Sync token never reaches the browser.** `/api/sync` requires `Authorization: Bearer ${SYNC_TOKEN}`. Vercel Cron supplies it automatically. The `/admin/sync` force-sync UI sits behind HTTP Basic Auth via `middleware.ts`; the form posts to a server action that re-reads `SYNC_TOKEN` server-side and calls `/api/sync` from inside the same Vercel function. A Playwright assertion checks `page.content()` does not contain the token after the page renders.
- **Basic Auth on `/admin/*`.** Edge-runtime middleware decodes the `Authorization` header with `atob` (no Node `Buffer` polyfill on Edge), compares user and password with a constant-time-ish XOR, and fails closed if `ADMIN_USER` or `ADMIN_PASS` is unset.

## Accessibility (WCAG 2.1 AA)

- `<html lang="en">`, a skip link, semantic `<article>` / `<header>` / `<time datetime>` / `<address>` on the article page, one `<h1>` per page, headings in document order.
- Real `<button>` and `<a>` elements; never `<div onClick>`. Tailwind `focus-visible:ring-2 focus-visible:ring-offset-2` defaults on links and buttons.
- Every `next/image` carries an `alt` from `_embedded["wp:featuredmedia"].alt_text`; decorative-only images use the empty-string alt.
- Contrast: shadcn neutrals on white pass AA. The accent (`#1F6FEB`) was chosen deliberately distinct from TRD's brand red and verified against white. The sector chip color was tightened during Wave 6's audit after axe flagged a 4.12:1 contrast.
- `axe-core` runs in CI via Playwright on `/` and one article page; the assertion is zero `serious` or `critical` violations. Result on production: clean.

## SEO

- **Per-page metadata** via Next 15's `generateMetadata`. Each article page emits OpenGraph (`type=article`, publishedTime, author, image), Twitter (`summary_large_image`), and `alternates.canonical` pointing back at the original TRD URL stored in `posts.link`. The canonical points back deliberately: TRD Lite is a demo, not a competing copy, and we do not want this URL ranked over `therealdeal.com`.
- **JSON-LD `NewsArticle`** in the article page's `<head>`. The serializer escapes `<` to `<` to neutralize a closing-tag injection vector; this was caught by the Wave 6 auditor and fixed in the same wave.
- **`sitemap.xml`** generated from the `posts` table at revalidate time.
- **`robots.txt`** sets `noindex` for the demo so it cannot be mistaken for the source. Reviewers can follow links by hand.
- **CLS prevention** via `width` and `height` from `media_details`, passed to `next/image`.

## Testing

- **Vitest:** 40 unit and integration tests covering sanitize allowlist invariants, cursor encode/decode round-trip, sync idempotency, cursor advancement, bearer-token rejection, GraphQL `post(slug)`, GraphQL `posts` pagination, status filter behavior, FTS rank ordering and empty-query short-circuit, codegen drift detection, sync-UI auth path, frontend boundary rule (no `@/db` imports outside `src/graphql/`), cache-tag generation, and Postgres connection smoke.
- **Playwright + axe-core:** 5 e2e tests covering homepage a11y, article-page a11y, public `/sync-status`, `/admin/sync` 401 challenge with a `WWW-Authenticate` header, and the SYNC_TOKEN-leak assertion against `/admin/sync` rendered HTML.

```bash
pnpm test         # 40 vitest tests
pnpm test:e2e     # 5 Playwright tests
pnpm coverage     # vitest with V8 coverage
```

## CI/CD

GitHub Actions runs on every push to `main` and every PR. Three jobs:

1. **`static`** (lint + typecheck + codegen check + build). Catches drift between the committed GraphQL types and the live schema; fails the build when a developer changes an operation without re-running `pnpm codegen`.
2. **`test`** (vitest unit + integration). Depends on `static`.
3. **`e2e`** (Playwright + axe-core). Depends on `static`. Uploads `playwright-report/` and `test-results/` on failure with a 7-day retention.

`needs: [static]` keeps the test and e2e jobs from racing past obvious type errors. Vercel's GitHub integration auto-deploys `main` to production once CI is green; preview URLs are wired up automatically on PRs.

## Deployment

- **Vercel (Hobby tier).** Project `prj_U3TwFCMFgZRa5vR3hIZCv9HpWzKx` under team `fakeairhead-3730s-projects`. Single deploy, Node functions for `/api/sync` and `/api/graphql`, Edge runtime for `/api/healthz`.
- **Neon Postgres (free tier).** One project, one branch, region `us-east-1` to colocate with Vercel's `iad1` (cuts query latency from roughly 70 ms cross-region to roughly 3 ms intra-region). Scale-to-zero is on; the Edge `/api/healthz` route doubles as a cheap warmer.
- **Cron honesty.** Vercel Hobby caps cron at one execution per day, so production runs `0 6 * * *`. The plan was `*/5 * * * *` on Pro for "appears live" freshness; on Pro the schedule line in `vercel.json` is the only thing that changes. The protected `/api/sync` endpoint and the Basic-Auth `/admin/sync` force-sync button cover ad-hoc refresh in the meantime.
- **Backfill.** `pnpm tsx --env-file=.env.production scripts/backfill.ts` against production. Current row count: 509 posts. Re-runs are idempotent and a no-op when no upstream changes have happened.

## AI tooling

### How it was actually used

This is not a Claude-Code-wrote-my-app project. This is a *human-architected, AI-orchestrated software delivery system*, and it is the part of the build I am proudest of.

**One human, one project plan, an entire engineering team's worth of throughput.** I sat at the top of the loop as the architect and product owner. Below me, Claude Code ran as a coordinated multi-agent organization that I designed: a planner that decomposed `plan.md` into 11 sequenced waves, an *implementer* that wrote each wave's code, an *auditor* (code-reviewer, security-reviewer, or tdd-guide depending on the surface) that audited the implementation against acceptance criteria and force-ran `typecheck`, `test`, `build`, and Playwright, and a *documenter* that updated the README, recorded tradeoffs, and shipped a Conventional Commit. No code reached `main` until its wave passed every check.

**The agents argued with each other, and they caught real bugs.** Auditors flagged a Next 16 vs 15 mismatch, draft posts leaking through `post(slug)`, `'unsafe-eval'` accidentally shipping to production CSP, a JSON-LD `<`-escape vulnerability, a Playwright env loader gap that silently skipped a security test, sector-chip contrast at 4.12:1, and a shadcn default that shadowed the accent CSS variable. The implementer fixed each one inside the same wave it was caught. The system was its own first reviewer.

**A persistent memory that compounds across sessions.** I wired the workflow into an external Obsidian-backed knowledge vault with vector embeddings, so architecture decisions, tradeoffs, and design references survive between Claude Code sessions instead of resetting at every context window. The agent retrieves prior decisions by *meaning*, not filename, and writes new ones back. The project effectively gets smarter every time it is touched.

**Design that refused to look AI-generated.** I locked the visual system to a written brief, `.impeccable.md`, with an explicit reference set (WSJ, NYT, FT) and an explicit anti-reference set (TRD's red branding, SaaS landing-page aesthetics, crypto-dashboard glassmorphism). Every UI decision was checked against that brief. The result is editorial, distinct, and unmistakably *not* the generic chatbot-styled output that most AI-assisted projects ship with.

**Where the AI compounded my output the most:** Drizzle migrations, GraphQL SDL wiring, resolver scaffolding, the `sanitize-html` allowlist, codegen drift detection, axe-core accessibility tests, CSP debugging, CI setup, deployment verification, and the endless `typecheck` to `test` to `build` loop that turns a prototype into a product. The high-leverage, low-glamour engineering. The stuff that usually gets cut.

**Where the AI did not touch a thing:** the architecture (single Next.js app, GraphQL layer folder-isolated, frontend forbidden from importing `src/db/`), the cache invalidation tag taxonomy, the pagination model, the sync semantics (cursor + 60s overlap + idempotent upsert + transaction-per-page), the security posture (sanitize on write, sync token server-side only, Basic Auth on /admin), the test prioritization, and the editorial voice of every page on this site. Those decisions are mine, and the agent worked to them.

The honest summary: I built a 500-post, GraphQL-backed, cron-synced, accessibility-audited, security-headered, CI-gated news mirror with measured SQL counts and zero `@/db` leaks, in a fraction of the time it would have taken solo, *and* I built the agent system that built it alongside me. The full execution trace lives in [`docs/orchestration/orchestration-plan.md`](docs/orchestration/orchestration-plan.md). Each commit on `main` is a wave's documenter step; `git log --oneline` reads as the wave history.

This is how I use AI: as a force multiplier on a human-owned design, with verification at every step and a memory that gets better over time. Not as a shortcut, and not as a black box.

## What I'd do next

- **Webhook-based invalidation.** Requires a WP plugin (e.g., WP Webhooks) that we cannot install on TRD's prod CMS, but on a CMS we control this is the upgrade from 5-minute lag to roughly 1-second lag. The current cron handler is the right shape; only the trigger changes.
- **Other custom post types.** TRD also has `magazine`, `events`, `dataset`, `sponsored`, `press-releases`, and `advertiser` CPTs. Add a `kind` discriminator to `posts` (or a generalized `content` table) and the schema generalizes without a separate join table per CPT.
- **Per-request CSP nonces.** Drop `unsafe-inline` from `script-src` by emitting a per-request nonce in the root layout and applying it to the JSON-LD tag. Tightens the CSP without breaking anything.
- **Better delete detection.** A daily full-ID sweep that diffs the WP `posts?per_page=100&fields=id` IDs against `posts.id` and soft-deletes the missing ones. Two minutes of work; the only reason it is not in v1 is honesty about scope.
- **OpenTelemetry.** Pino is enough for one process; OTel would be the right move once there is a worker or two and a real dashboard target.

## What I cut on purpose

- **Auth (for the site).** A public news mirror has no users to authenticate. The only protected surface is `/admin/sync`, which is one HTTP Basic Auth check.
- **Mutations.** This is a read-only mirror by design. Any "write" goes through the sync worker.
- **Comments.** No source data and no point in fabricating one.
- **A custom design system.** Tailwind plus the minimum custom components needed to ship cleanly. Time saved went into testing, security headers, and this README.
- **Redis.** Postgres with proper indexes plus Next.js Data Cache covers this scope. Adding Redis would be performance theater.
- **A query-count debug header.** Tempting; would have meant shipping a number that is inversely correlated with how realistic the workload is. Instead, real measurements live in `docs/measurements/query-counts.md` and the README only quotes the measured ones.

## License

MIT, see [`LICENSE`](./LICENSE). Authored as a take-home for The Real Deal; article content is mirrored from therealdeal.com and every article page links back to its canonical URL there.
