# TRD Lite: Orchestration Plan

## Context

**What this plan is:** the orchestration overlay for executing `/Users/chinmay_shringi/Desktop/therealdeal/plan.md`, a 962-line, fully-specified take-home for The Real Deal (TRD). The technical plan is already complete and opinionated; this document describes *how* to drive Claude Code through it using the user's requested 3-agent-per-task pattern, parallel waves, and proper CI/CD/docs hygiene.

**Why this plan exists:** the user wants a senior IC submission for a Full Stack Developer role at TRD ($110k–$120k). The JD names Claude Code by name. The README's "AI usage" section is real signal, not a footnote. The submission needs to be defensible, well-tested, deployed, and documented.

**Intended outcome:** a green-CI, deployed-to-Vercel, GraphQL-fronted, cron-synced Next.js 15 app at `github.com/ChinmayShringi/TRD-Lite` and `vercel.com/fakeairhead-3730s-projects/therealdeal`, with a README that a Head of Product can grasp in 10 minutes.

---

## Source artifacts (do not duplicate, reference)

- **Master technical plan**: `/Users/chinmay_shringi/Desktop/therealdeal/plan.md` (sections 1–17). All schema, SDL, file layout, security, a11y, SEO content lives there. This orchestration plan never re-specifies it; it only references sections.
- **WordPress source**: `https://therealdeal.com/wp-json/wp/v2/posts?_embed=1`
- **GitHub repo**: `git@github.com:ChinmayShringi/TRD-Lite.git` (already cloned, empty, on `main`).
- **Vercel project**: `prj_U3TwFCMFgZRa5vR3hIZCv9HpWzKx` at `https://vercel.com/fakeairhead-3730s-projects/therealdeal`. Use `vercel link --project <id>` strictly; do not create a new project.
- **CLI auth state (verified)**: gh as `ChinmayShringi` (ssh), vercel as `fakeairhead-3730`, Node 24.2.0, pnpm 10.33.0.

---

## User-confirmed decisions

| Decision | Value | Note |
|---|---|---|
| ORM | **Drizzle** | plan.md §4 default, native serverless |
| Hosting tier | **Vercel Pro ($20/mo)** | enables `*/5 * * * *` cron, longer fn timeouts |
| Branding | **Distinct from TRD** | different palette + serif; canonicals point back to TRD |
| Bonus polish | **Postgres FTS + graphql-codegen** | skip query-count debug header (only ship measured numbers) |

These four answers fully resolve plan.md §16's open questions and §15's optional polish.

---

## The 3-agent-per-task pattern

For every task within a phase, dispatch three sequential agents:

1. **Implementer** (`general-purpose`): executes the work per the referenced plan.md section. Writes code only. Forbidden from declaring success without running the local verification command.
2. **Auditor** (`feature-dev:code-reviewer` for code, `everything-claude-code:tdd-guide` for test gaps, `everything-claude-code:security-reviewer` for sanitize/CSP work): audits requirement vs. delivery against plan.md acceptance criteria, writes/runs tests to fill gaps, surfaces high/critical issues. Has read-only on the implementation; it can write tests.
3. **Documenter** (`general-purpose`): commits with a Conventional Commit message (`feat:`/`fix:`/`docs:`/`test:`/`ci:`/`chore:`), updates the relevant README/docs section, updates auto-memory if a non-obvious decision was made.

**Rules:**

- Auditor cannot start until Implementer reports done with verification output.
- Documenter cannot start until Auditor reports zero critical findings (high findings noted in commit body if accepted; critical findings bounce back to Implementer).
- Each agent receives the full plan.md path plus the specific section number(s) to anchor on.
- Each agent receives this plan file path so it understands the wave context.
- A failure loop is bounded: Implementer ↔ Auditor maximum 2 round trips per task; on the third, the orchestrator (me) intervenes manually.

**Across phases** the orchestrator runs the wave plan below; **within phases** the 3 agents are sequential.

---

## Wave plan

Waves with no shared file boundary run **in parallel** (single message, multiple Agent tool calls). Waves with dependencies run sequentially.

```
Wave 0  Preflight                                        sequential
Wave 1  Phase 1 Foundation                               sequential
Wave 2  Phase 2 Schema  ||  Phase 3 WP client+sanitize   PARALLEL
Wave 3  Phase 4 Sync                                     sequential
Wave 4  Phase 5 GraphQL                                  sequential
Wave 5  Phase 6 Frontend                                 sequential
Wave 6  Phase 7 a11y/SEO/security polish                 sequential
Wave 7  Phase 8 Sync visibility (public + admin)         sequential
Wave 8  Phase 9 Tests + CI                               sequential
Wave 9  Phase 10 Deploy + backfill                       sequential
Wave 10 Phase 12 FTS  ||  Phase 12 graphql-codegen       PARALLEL
Wave 11 Phase 11 README + final polish                   sequential
```

Each wave's "done" criterion is the corresponding plan.md §12 phase done criterion. **Do not advance to the next wave until the current wave's documenter has pushed a green commit.**

---

### Wave 0: Preflight (orchestrator, no agents)

Sequential, single thread. Run before dispatching any agent.

1. `cd /Users/chinmay_shringi/Desktop/therealdeal`
2. `vercel link --yes --project prj_U3TwFCMFgZRa5vR3hIZCv9HpWzKx`
3. Provision Neon Postgres via Vercel Marketplace integration (us-east-1, scale-to-zero). Confirm `DATABASE_URL` is injected into the Vercel project env.
4. `vercel env pull .env.local` to seed local env from Vercel.
5. Generate and add to Vercel env: `SYNC_TOKEN` (32-byte hex), `ADMIN_USER`, `ADMIN_PASS`, `WP_BASE_URL=https://therealdeal.com/wp-json/wp/v2`.
6. Confirm `gh repo view ChinmayShringi/TRD-Lite --json visibility` is public; `git remote -v` points at the right repo.
7. Create `docs/orchestration/` and copy this plan there (so the repo carries its own execution trace).

**Done when:** `vercel env ls` shows all required vars, `gh auth status` is clean, `.env.local` exists, `docs/orchestration/orchestration-plan.md` is committed.

---

### Wave 1. Phase 1: Foundation (3 agents, sequential)

References: plan.md §12 Phase 1, §4 stack table, §9 file layout.

- **Implementer**: scaffold Next.js 15 App Router (TS, Tailwind v4, App Router, no `src/`, eslint), shadcn/ui init, Drizzle config pointed at Neon, GraphQL Yoga + DataLoader installed, Vitest + Playwright + axe-core wired, `pino` logger, `sanitize-html`. Create folders and placeholder routes/components. **No features yet.** Add `.env.example` per §10. Commit: `chore: scaffold next.js 15 + tooling`.
- **Auditor**: run `pnpm dev` smoke (kills after 5s), `pnpm lint`, `pnpm typecheck`. Verify `pnpm db:studio` connects. Confirm Tailwind classes render. Audit for missing `eslint-config-next`, missing `tsconfig` strictness flags, missing `vercel.json` placeholder.
- **Documenter**: README skeleton with TL;DR and architecture-diagram placeholder per plan.md §11. Commit any audit fixes. Push `main`.

**Done when:** plan.md §12 Phase 1 done criterion green; CI baseline passes locally; first push lands.

---

### Wave 2. Phases 2 + 3: Schema + WP client (PARALLEL, 6 agents total)

These two tracks touch entirely different files: schema/migrations vs. `lib/wp-client.ts`/`lib/sanitize.ts`. Dispatch both in a single message.

**Track A. Phase 2: Schema and migrations**
References: plan.md §5 (full schema), §12 Phase 2.

- Implementer: `src/db/schema.ts` (posts, authors, media, terms, post_terms, sync_runs with bigint IDs and JSONB raw), `src/db/relations.ts` for relational queries (plan.md §7 N+1 strategy), `src/db/index.ts` (Neon client). Generate migration `drizzle/0000_initial.sql`. Apply to Neon. Insert one test row.
- Auditor: verify all indexes from §5 exist; verify foreign keys with `ON DELETE CASCADE`; verify unique constraints; smoke test that `db.query.posts.findMany({ with: { author: true, featuredMedia: true, terms: { with: { term: true } } } })` compiles. Run `pnpm typecheck`.
- Documenter: README "Architecture > Data model" section. Commit: `feat(db): drizzle schema + initial migration`.

**Track B. Phase 3: WP client + sanitization**
References: plan.md §2 (real WP shape), §9.5 security, §12 Phase 3.

- Implementer: `lib/wp-client.ts` (typed wrapper, `?_embed=1` always, `modified_after` cursor, retries with exponential backoff, 1s pagination delay, configurable `WP_BASE_URL`). `lib/sanitize.ts` per §9.5 verbatim (allowlist for `img`/`figure`/`figcaption`/`iframe`/`section`, transform `a` to `rel="noopener noreferrer"`).
- Auditor: write 4 Vitest unit tests for sanitize (strips `<script>`, strips `onclick=`, keeps `<img>`, keeps `<figure>` with `<figcaption>`). Write 1 test for wp-client retry-on-5xx. Run tests. Run `pnpm tsx -e "import('./lib/wp-client').then(m => m.getPosts({perPage: 5}).then(console.log))"` against the real endpoint as a live sanity check.
- Documenter: README "Security > HTML sanitization" snippet from §9.5. Commit: `feat(lib): wordpress client and html sanitizer with tests`.

**Done when:** both tracks' done criteria green; no merge conflicts (different files by design); main has both commits.

---

### Wave 3. Phase 4: Sync (3 agents, sequential)

References: plan.md §6 (sync strategy), §12 Phase 4. **This is the heart of the project per the plan; spend extra rigor here.**

- Implementer: `lib/sync.ts` (orchestrator with idempotent upsert order media → authors → terms → posts → post_terms, transaction-per-page, 60s overlap on cursor), `scripts/backfill.ts` (500 most recent, configurable via `BACKFILL_LIMIT`), `app/api/sync/route.ts` (bearer-protected by `SYNC_TOKEN`, calls `revalidateTag('homepage')` and per-slug `revalidateTag('post:'+slug)`), `vercel.json` with cron `*/5 * * * *` → `/api/sync`.
- Auditor: 3 Vitest tests: (1) idempotency (running sync twice produces identical row count and updated_at), (2) cursor advancement (cursor moves forward on success, holds on failure), (3) bearer-token rejection (401 without/wrong token). Live-test backfill against staging Neon (limit 50 to keep test fast).
- Documenter: README "How sync works" section per plan.md §11. Commit: `feat(sync): incremental sync with cron + idempotent upsert`.

**Done when:** `pnpm tsx scripts/backfill.ts` populates 500 articles, re-running is a no-op (zero new rows), `sync_runs` shows the runs.

---

### Wave 4. Phase 5: GraphQL layer (3 agents, sequential)

References: plan.md §8 (full SDL), §7 (N+1 strategy), §12 Phase 5. **Hand-written SDL only, no Pothos** per §13.

- Implementer: `src/graphql/schema.ts` (SDL string from §8 verbatim), `src/graphql/resolvers.ts` (Drizzle relational queries on list pages, DataLoader fallback for chatty resolvers), `src/graphql/loaders.ts` (per-request DataLoader for Author, Media, Term), `src/graphql/cursor.ts` (base64 `publishedAt|id`), `src/graphql/context.ts`, `app/api/graphql/route.ts` (Yoga handler, GraphiQL enabled in dev only).
- Auditor: 3 Vitest integration tests: (1) `post(slug)` returns full hydrated object, (2) `posts(first: 10)` paginates correctly with cursor round-trip, (3) `syncStatus` returns expected shape. Run with Drizzle `logger: true` and capture query counts; record actual numbers in `docs/measurements/query-counts.md` (do not claim numbers in README that aren't measured).
- Documenter: README "Architecture > GraphQL schema" section + measured query counts (only the measured ones). Commit: `feat(graphql): yoga handler with sdl schema and dataloader`.

**Done when:** GraphiQL at `/api/graphql` returns real data; integration tests pass; measured query counts recorded.

---

### Wave 5. Phase 6: Frontend (3 agents, sequential)

References: plan.md §9 (pages, components, file layout), §12 Phase 6. **Distinct branding** per user decision (different palette + serif than TRD).

- Implementer: `lib/graphql-fetch.ts` (typed fetch wrapper with `next: { tags, revalidate: 300 }`), root layout with `<html lang="en">` + skip link + Header/Footer, `app/page.tsx` (homepage hero + 5+ articles grid + sector chips), `app/article/[slug]/page.tsx` (semantic `<article>`, byline, `<time>`, sanitized content, related posts), `app/sector/[slug]/page.tsx`, `app/api/healthz/route.ts`. Components per §9. Distinct accent color (e.g., `#1F6FEB` blue) and a serif headline (Source Serif Pro). Frontend imports from `lib/graphql-fetch.ts` only, **never from `src/db/`** per §13.
- Auditor: enforce the boundary rule with a custom ESLint rule or a grep-based test (`grep -r "from '@/db" app/ components/ | grep -v "graphql/" && exit 1`). Lighthouse run against `pnpm build && pnpm start` on `/` and one article. Verify mobile score >90.
- Documenter: README "Frontend approach" + screenshot placeholders. Commit: `feat(ui): homepage + article + sector pages`.

**Done when:** clicking through the site feels real, no hydration warnings, no `@/db` imports outside `src/graphql/`, lighthouse mobile >90.

---

### Wave 6. Phase 7: a11y / SEO / security polish (3 agents, sequential)

References: plan.md §9.5 (full content), §12 Phase 7. **Add CSP last and permissively** per §12 Phase 7 explicit warning.

- Implementer: `generateMetadata` per page (title, description, OG, Twitter, canonical pointing at the original TRD `link`), JSON-LD `NewsArticle` script tag on article pages, `app/sitemap.ts` and `app/robots.ts`, focus rings via Tailwind utilities, semantic HTML audit (one h1 per page, headings in order). Add **permissive** CSP header in `next.config.ts` (allow `https:` for img-src, `'unsafe-inline'` for style-src), only after UI verified to render fully.
- Auditor: Playwright + axe-core script that loads `/`, navigates to one article, asserts zero `serious`/`critical` violations. Test that CSP doesn't break any image or embed by visiting 5 sample articles. Verify canonical tags. View-source check for JSON-LD presence.
- Documenter: README "Security", "Accessibility (WCAG 2.1 AA)", "SEO" sections per §11/§9.5. Commit: `feat(a11y,seo,sec): metadata, json-ld, sitemap, csp, axe-core check`.

**Done when:** axe reports zero serious/critical, lighthouse a11y >95, view-source on an article shows JSON-LD, CSP loads no errors in browser console.

---

### Wave 7. Phase 8: Sync visibility (3 agents, sequential)

References: plan.md §9 routes table, §12 Phase 8. **Two pages, very different security postures**: public read-only vs. Basic-Auth-protected.

- Implementer: `app/sync-status/page.tsx` (PUBLIC read-only, last 20 sync_runs + postCount + lastSuccessAt, no controls), `middleware.ts` enforcing HTTP Basic Auth on `/admin/*` via `ADMIN_USER`/`ADMIN_PASS`, `app/admin/sync/page.tsx` with same data + "Force sync" button calling a server action that re-reads `SYNC_TOKEN` server-side and POSTs to `/api/sync` (token never reaches the browser).
- Auditor: 3 tests: (1) `/sync-status` returns 200 unauthenticated and shows real data, (2) `/admin/sync` returns 401 unauthenticated, (3) `/admin/sync` works with correct creds and clicking "Force sync" creates a new `sync_runs` row. Verify `SYNC_TOKEN` is never in HTML source via Playwright `page.content()`.
- Documenter: README "Sync visibility" subsection mentioning both pages and the auth model. Commit: `feat(sync-ui): public read-only status + basic-auth admin force-sync`.

**Done when:** public page works without creds, admin page enforces 401, force-sync via button works end-to-end, token never leaks to client.

---

### Wave 8. Phase 9: Tests + CI (3 agents, sequential)

References: plan.md §12 Phase 9, §11 testing section.

- Implementer: ensure Vitest + Playwright suites cover the items listed in §11: sanitize allowlist invariants, cursor encode/decode round-trip, sync idempotency, GraphQL `post(slug)`, `posts` pagination, `syncStatus`, frontend boundary rule, axe-core smoke. Add `.github/workflows/ci.yml` with jobs `lint`, `typecheck`, `test`, `build` running on push and PR. Use `pnpm/action-setup@v4` and `actions/setup-node@v4` with Node 24. Cache pnpm store.
- Auditor: run the GH Actions workflow locally with `gh act` if available, otherwise validate by pushing a noop commit and watching the run. Confirm all 4 jobs green. Confirm test coverage report is sane (no critical files at 0%).
- Documenter: add CI badge to README. Commit: `ci: github actions for lint/typecheck/test/build` and `test: full vitest + playwright coverage`.

**Done when:** CI badge in README is green, `gh run list --limit 1` shows green status.

---

### Wave 9. Phase 10: Deploy + backfill (3 agents, sequential)

References: plan.md §10, §12 Phase 10.

- Implementer: confirm Vercel project linked (`vercel link --project prj_U3TwFCMFgZRa5vR3hIZCv9HpWzKx`); confirm Neon integration injecting `DATABASE_URL`; set remaining envs (`WP_BASE_URL`, `SYNC_TOKEN`, `ADMIN_USER`, `ADMIN_PASS`); push `main` and watch auto-deploy; once deployed, run `vercel env pull .env.production && pnpm tsx scripts/backfill.ts` against the production DB; confirm cron is registered in Vercel dashboard (Cron tab); smoke-test live URL.
- Auditor: hit live `/api/healthz`, `/sync-status`, `/`, one article page, `/api/graphql` with `{ syncStatus { lastRunAt postCount } }`. Verify no 5xx on Vercel logs over a 5-min window. Confirm `*/5 * * * *` cron actually fires by waiting for one tick.
- Documenter: README "Live demo" link + final architecture diagram (Mermaid). Update auto-memory: project state = "deployed". Commit: `chore(deploy): production deploy + backfill`.

**Done when:** live URL responds, cron has fired once, post count >= 500.

---

### Wave 10. Phase 12 bonuses (PARALLEL, 6 agents total)

User opted in to FTS and graphql-codegen. Each is a clean track on independent files.

**Track A: Postgres FTS search**
References: plan.md §15 #2.

- Implementer: add `tsvector` column to `posts` (generated from title + excerpt + content_html), add `GIN` index, migration. New GraphQL field `searchPosts(query: String!, first: Int = 10, after: String): PostConnection!` with a Drizzle `sql` template using `to_tsquery` + `plainto_tsquery` fallback + `ts_rank`. New page `app/search/page.tsx` with `?q=` param.
- Auditor: 2 tests: (1) FTS returns expected ordering (`ts_rank` desc) for a known query, (2) empty query returns empty connection (no crash). Smoke `/search?q=manhattan` end-to-end.
- Documenter: README "Search" subsection. Commit: `feat(search): postgres fts + searchPosts query + /search page`.

**Track B: graphql-codegen**
References: plan.md §15 #4.

- Implementer: install `@graphql-codegen/cli` + relevant plugins, `codegen.ts` config pointing at `src/graphql/schema.ts`, generate types into `src/graphql/__generated__/`. Replace inline query strings with `gql` tagged ones and consume generated types in `app/page.tsx`, `app/article/[slug]/page.tsx`, `app/sector/[slug]/page.tsx`. Add `pnpm codegen` script + a CI step to verify codegen output is committed.
- Auditor: confirm `pnpm codegen --check` passes (generated files are up to date), `pnpm typecheck` is still green, no untyped `any` in resolver/page consumers of generated ops.
- Documenter: README "Type safety" subsection mentioning the codegen workflow. Commit: `feat(types): graphql-codegen for typed operations`.

**Done when:** both tracks' commits pushed; CI green with the new tests + codegen check.

---

### Wave 11. Phase 11: README + final polish (3 agents, sequential)

References: plan.md §11 (full template), §17 (one-sentence top of README).

- Implementer: complete README per §11 template: TL;DR, Quick start, Architecture (Mermaid diagram), Decisions and tradeoffs (every bullet from §11), How caching works (5-layer diagram + tag table from §7), How sync works (§6), Security (§9.5), Accessibility (§9.5), SEO (§9.5), Testing (§11), How AI tools were used (specific to this run), What I'd do next, What I cut on purpose. Top sentence from §17. Embed screenshots from `docs/screenshots/`.
- Auditor: README freshness pass: every link works, every command in Quick start runs cleanly on a clean clone, every claimed query count was actually measured (cross-reference `docs/measurements/query-counts.md`). Spell-check, scan for em-dashes (forbidden per user global instructions; replace with comma/period/parens).
- Documenter: final commit `docs: complete readme with architecture, tradeoffs, ai usage`. Push. Open PR if working on a branch (otherwise merged to main directly). Update auto-memory: project state = "shipped".

**Done when:** a stranger could clone and run in 10 minutes from README alone; no em-dashes; CI green; live URL works; final commit pushed.

---

## Critical files (paths, for reference)

```
/Users/chinmay_shringi/Desktop/therealdeal/
├── plan.md                                     # master technical plan (do not duplicate)
├── docs/
│   ├── orchestration/orchestration-plan.md     # this plan, copied in Wave 0
│   ├── measurements/query-counts.md            # actual measured SQL counts (Wave 4)
│   └── screenshots/                            # embedded in README (Wave 11)
├── src/
│   ├── db/{schema,relations,index}.ts          # Wave 2A
│   ├── graphql/{schema,resolvers,loaders,cursor,context}.ts  # Wave 4
│   ├── lib/{wp-client,sanitize,graphql-fetch,sync,cache-tags,seo}.ts  # Waves 2B/3/5/6
│   └── components/...                          # Wave 5
├── app/
│   ├── page.tsx                                # Wave 5 homepage
│   ├── article/[slug]/page.tsx                 # Wave 5
│   ├── sector/[slug]/page.tsx                  # Wave 5
│   ├── search/page.tsx                         # Wave 10A (FTS bonus)
│   ├── sync-status/page.tsx                    # Wave 7 (public)
│   ├── admin/sync/page.tsx                     # Wave 7 (basic-auth)
│   ├── api/{graphql,sync,healthz}/route.ts     # Waves 4/3/5
│   ├── sitemap.ts, robots.ts                   # Wave 6
├── middleware.ts                               # Wave 7 (basic-auth gate)
├── tests/{unit,integration,e2e}/               # Waves 2B/3/4/8
├── scripts/backfill.ts                         # Wave 3
├── drizzle/0000_initial.sql                    # Wave 2A
├── .github/workflows/ci.yml                    # Wave 8
├── vercel.json                                 # Wave 3 (cron)
├── next.config.ts                              # Wave 6 (CSP)
├── codegen.ts                                  # Wave 10B
└── README.md                                   # built incrementally, finalized Wave 11
```

---

## Verification (end-to-end check after Wave 11)

A reviewer should be able to do all of these without hitting a wall:

1. `git clone git@github.com:ChinmayShringi/TRD-Lite.git && cd TRD-Lite`.
2. Open `README.md`, follow Quick start (≤5 commands).
3. `pnpm dev`, hit `http://localhost:3000`, see homepage with ≥5 articles.
4. Click into an article. See sanitized content, byline, time, related posts.
5. Hit `http://localhost:3000/api/graphql`, run `{ syncStatus { lastRunAt postCount } }`. Get real numbers.
6. Hit `http://localhost:3000/sync-status`, see last 20 sync runs (no auth needed).
7. Hit `http://localhost:3000/admin/sync`, get 401. Add Basic Auth, force-sync works.
8. Visit live Vercel URL. Same flows work. Cron has fired ≥1 time in last 10 min.
9. Run `pnpm test` and `pnpm test:e2e` from clean clone. Both green.
10. Inspect Vercel dashboard: Cron tab shows `*/5 * * * *` schedule. Function logs show successful sync runs.

If any step fails, that's the loop-back point.

---

## Failure-mode contingencies

| Failure | Detection | Recovery |
|---|---|---|
| Auditor finds critical issue twice in a row | round-trip counter | orchestrator (me) takes over manually for that task |
| Vercel deploy fails | `vercel logs` 5xx or build error | fall back to local build verification, fix, redeploy |
| Neon cold-start kills demo | `/api/healthz` >2s | add a warmer `fetch` from root layout per plan.md §14 |
| WP rate-limits backfill | 429 in logs | reduce `per_page` to 50, add 2s pagination delay |
| CSP breaks images | browser console errors after Wave 6 | revert to permissive CSP, log the blocked source, re-tighten only what's safe |
| Sanitize-html strips legitimate markup | spot-check 5 sample articles render fine | adjust allowlist, re-backfill (sync is idempotent) |
| GitHub Actions hangs >10min | `gh run watch` timeout | kill, re-run, escalate to manual local verification + push |

---

## What this plan deliberately does not do

- Re-specify schema, SDL, or file layout (already in plan.md).
- Add features beyond plan.md §15's recommended list (FTS + codegen).
- Implement Loom video (manual deliverable for the user post-ship).
- Add OpenTelemetry, persisted operations, or a query-count debug header (skipped per §12 Phase 12 honest accounting and user choice).
- Rewrite the README; the README structure lives in plan.md §11 and is filled in incrementally across waves.

---

## One-sentence summary

Drive plan.md's 12 technical phases through 11 waves of orchestrated 3-agent (implementer/auditor/documenter) tasks, parallelizing the two file-disjoint pairs (Wave 2: schema+wp-client; Wave 10: FTS+codegen), gating each wave on plan.md's stated done criterion, and treating the README and the deployed Vercel URL as the only two things a reviewer will judge.
