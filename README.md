# TRD Lite

[![CI](https://github.com/ChinmayShringi/TRD-Lite/actions/workflows/ci.yml/badge.svg)](https://github.com/ChinmayShringi/TRD-Lite/actions/workflows/ci.yml)

> A small news site built on top of The Real Deal's WordPress REST API. Next.js 15 frontend, GraphQL Yoga API layer, Postgres mirror, cron-based sync.

**Status:** in active scaffolding (Wave 1 complete, Wave 2 in progress). Foundation is in place; feature waves pending.

## TL;DR

- **Live:** TBD after Wave 9 (deploy)
- **Stack:** Next.js 15 (App Router) + GraphQL Yoga (SDL) + DataLoader + Drizzle + Neon Postgres
- **Sync:** Vercel Cron (`*/5 * * * *`), incremental via `?modified_after`. Plus a protected `/api/sync` endpoint and a manual `pnpm sync` script.
- **Cache:** Postgres as durable cache, Next.js tag-based revalidation as presentation cache.
- **Demo:** visit `/sync-status` for a live read-only view of recent sync runs (after deploy).

## Quick start

```bash
pnpm install
vercel env pull .env.local
pnpm db:migrate            # (after Wave 2 lands the schema)
pnpm tsx scripts/backfill.ts  # (after Wave 3 lands sync)
pnpm dev
```

## Architecture

(Mermaid diagram and per-section detail to be added in Wave 11.)

## Decisions and tradeoffs

(Filled in Wave 11. Sneak peek: Drizzle over Prisma; hand-written SDL over Pothos; single Next.js app over a split GraphQL service; Postgres + Next.js Data Cache over Redis.)

## How AI tools were used

(Detailed in Wave 11. The orchestration plan that drove this build is at [`docs/orchestration/orchestration-plan.md`](docs/orchestration/orchestration-plan.md).)

## License

For the take-home assignment from The Real Deal. Not for distribution.
