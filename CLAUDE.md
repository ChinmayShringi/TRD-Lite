# TRD Lite - Project Context for Claude

This file loads automatically into every Claude session that runs in
this directory. Keep it short; deep technical context lives in
`plan.md` (gitignored) and design context lives in `.impeccable.md`.

## Pointers

- **Technical plan**: `plan.md` in repo root (gitignored). The 962-line
  source of truth for architecture decisions, schema, SDL, file
  layout, security, a11y, and SEO.
- **Design context**: `.impeccable.md` in repo root. The voice,
  audience, references, and design principles that all UI work must
  respect. Mirrored below in this file so it loads on every session.
- **Live URL**: https://trd-lite-takehome.vercel.app
- **Repo**: https://github.com/ChinmayShringi/TRD-Lite
- **Vercel project**: `prj_U3TwFCMFgZRa5vR3hIZCv9HpWzKx`
- **Branch**: `main` only.

## Conventions

- Package manager: `pnpm`. Never `npm` or `yarn`.
- Run scripts that need the DB with `pnpm tsx --env-file=.env.production scripts/<name>.ts`.
- Tests: `pnpm test --run` (vitest), `pnpm test:e2e` (playwright + axe-core).
- Before commit: `pnpm typecheck && pnpm lint && pnpm test --run && pnpm build` must all be green.
- Codegen: any GraphQL SDL change requires `pnpm codegen` and a re-commit of `src/graphql/__generated__/`.

## Design Context

### Users

- **Primary audience right now**: the TRD hiring panel (Shlomo Kutner, Head of Product; Talal Atassi, HR) reviewing this take-home. They will skim a homepage, click through to one or two articles, glance at /sync-status, and form a judgment in under 10 minutes.
- **Stand-in audience the UI must role-play for**: a New York real-estate operator (broker, developer, lender, attorney) reading dense market news during the workday. They scan headlines, click into stories that name properties or actors they care about, and bounce. They expect to recognize the *kind* of site even though the brand is new.
- **Job to be done**: surface the most recent, most relevant TRD-mirror stories so the reader can absorb the lede in one or two paragraphs and decide whether to read on. Operational pages (sync status, admin) exist so a reviewer can verify the system is alive.

### Brand Personality

- **Three words**: authoritative, calm, considered.
- **Voice and tone**: a serious newsroom. Headlines speak; chrome stays out of the way. Microcopy is plain and informative ("End of feed", "Last synced X ago"), never marketing-flavored ("Discover more!", "Trending now!").
- **Emotional goals**: confidence and trust on first paint. The reader should feel like a serious publication is talking to them, not a product trying to convert them.

### Aesthetic Direction

- **North-star references**: NYTimes, Bloomberg, FT. Editorial classic: serif headlines, narrow reading column, image-led heroes, sectioned masthead, density that respects the reader's intelligence.
- **Anti-references**: explicitly not generic SaaS marketing pages (no purple-gradient hero CTAs, no oversized emoji headers, no spaced-out marketing padding) and not crypto/Web3 dashboards (no neon gradients, no glassmorphism, no animated background blurs). Deliberate distance from TRD's own red sans-serif wordmark stays in effect.
- **Theme**: light and dark both first-class. The user opt-in is persisted in `localStorage` and applied pre-paint via the inline script in `app/layout.tsx`; honor `prefers-color-scheme` when no preference is saved.
- **Typography**: Source Serif 4 for headlines and editorial weight; Inter for body, UI labels, and microcopy. Headlines use tighter tracking and semibold weight; uppercase + 0.2em tracked labels mark section eyebrows.
- **Color**: OKLCH tokens already wired in `app/globals.css`. Accent is a calm blue (`oklch(0.55 0.20 245)`) used sparingly for interactive affordances (focus rings, hover, link underlines, mark highlights at low opacity). The page is mostly background/foreground/muted; accent earns its appearance.
- **Motion**: subtle and skippable. Hover scales (1.02–1.015), 150–300ms transitions, skeleton `animate-pulse`, dropdown chevron rotation. All of it must respect `prefers-reduced-motion` and degrade to instant.

### Design Principles

1. **Headlines do the emotional work.** Imagery and serif type carry the page; UI chrome should fade unless interactive. Avoid decorative borders, gradients, or shadows that compete with editorial content.
2. **Accent is a verb, not a noun.** Reserve the accent color for things the user can act on - links, focus rings, the hovered card title, highlighted matches. Static decoration should live in foreground/muted.
3. **Density is respect.** Trust the reader to handle a real-estate-trade level of information. Don't pad headlines, don't inflate cards, don't cap copy with marketing whitespace. Mobile breakpoints stay tight.
4. **One Tab stop per article.** Cards are wrapped in a single anchor; image links carry `aria-label` so screen readers see the headline. Keep the keyboard journey shorter than the mouse journey.
5. **Skeletons over spinners.** Any await that costs more than ~150ms paints a layout-faithful skeleton. The grid never collapses; the page never jumps.
6. **WCAG 2.1 AA, with `prefers-reduced-motion` honored.** Visible focus rings on every interactive surface, no information conveyed by color alone, axe-core serious/critical = 0 in CI. Motion has an off switch.
7. **Dark is not an afterthought.** Every new component must read both ways without manual color overrides; if a Tailwind utility produces low contrast in one mode, fix the token, not the component.
