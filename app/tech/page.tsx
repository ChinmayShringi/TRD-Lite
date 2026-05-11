/**
 * "How this was built" colophon. A long-form read explaining the
 * stack, caching layers, sync strategy, and tradeoffs - written for
 * the same reviewers who set the take-home brief, so it answers the
 * questions they actually asked (architecture, caching, AI tooling)
 * with concrete code paths and decisions.
 *
 * No GraphQL fetch here: the content is hand-authored editorial copy.
 * Lives at /tech and is linked from the masthead drawer + footer.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { SectionRule } from "@/src/components/SectionRule";

export const metadata: Metadata = {
  title: "How this was built",
  description:
    "Stack, caching layers, sync strategy, GraphQL design, and tradeoffs behind TRD Lite - the take-home demo for The Real Deal.",
  alternates: { canonical: "/tech" },
};

const REPO_URL = "https://github.com/ChinmayShringi/TRD-Lite";
const LIVE_URL = "https://trd-lite-takehome.vercel.app";

interface SpecRow {
  label: string;
  value: React.ReactNode;
}

const STACK: SpecRow[] = [
  { label: "Framework", value: "Next.js 15 (App Router, React 19)" },
  { label: "Language", value: "TypeScript, strict mode" },
  { label: "Styling", value: "Tailwind v4, OKLCH tokens, Source Serif 4 + Inter" },
  { label: "API layer", value: "GraphQL Yoga at /api/graphql, hand-written SDL" },
  { label: "Database", value: "Neon Postgres (serverless), Drizzle ORM + relational queries" },
  { label: "Sync", value: "Cron-driven WordPress REST mirror (?_embed=1)" },
  { label: "Hosting", value: "Vercel Fluid Compute, cron-token-gated /api/sync (cron disabled on the free tier; manual or admin-triggered)" },
  { label: "Tests", value: "Vitest (unit + integration), Playwright + axe-core (e2e + a11y)" },
  { label: "CI", value: "GitHub Actions: lint, typecheck, codegen check, vitest, playwright" },
];

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-sans text-sm">
      {children}
    </code>
  );
}

export default function TechPage() {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-12 px-4 py-10 sm:px-6 lg:py-14">
      <header className="flex flex-col gap-6">
        <SectionRule label="Colophon">A take-home build log</SectionRule>
        <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
          How this was built
        </h1>
        <p className="max-w-prose font-heading text-lg italic leading-snug text-muted-foreground sm:text-xl">
          The brief asked for a small news site mirroring The Real Deal&rsquo;s
          WordPress feed through a custom GraphQL layer, with judgment calls
          around caching, performance, and architecture. This page walks the
          decisions that actually got shipped.
        </p>
        <p className="font-sans text-sm text-muted-foreground">
          <Link
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Source on GitHub
          </Link>
          <span className="px-2 text-border">/</span>
          <Link
            href={LIVE_URL}
            className="underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Live deployment
          </Link>
        </p>
      </header>

      <section aria-labelledby="stack-heading" className="flex flex-col gap-5">
        <SectionRule label="Stack" id="stack-heading" />
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-[max-content_1fr]">
          {STACK.map((row) => (
            <div
              key={row.label}
              className="contents border-b border-border pb-3 last:border-b-0"
            >
              <dt className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {row.label}
              </dt>
              <dd className="font-heading text-base leading-snug text-foreground">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="caching-heading" className="flex flex-col gap-5">
        <SectionRule label="Caching" id="caching-heading">
          The brief&rsquo;s headline question
        </SectionRule>
        <p className="font-heading text-lg leading-relaxed text-foreground">
          There are several caches, and they live in different places. The
          browser is the least important one. The real story is server-side:
          Postgres is the durable cache, and the Next.js Data Cache is the
          presentation cache on top.
        </p>
        <p className="font-heading text-base leading-relaxed text-muted-foreground">
          WordPress API &rarr; sync worker &rarr; Neon Postgres &rarr; GraphQL
          API &rarr; Next.js / Vercel cache &rarr; browser
        </p>
        <ol className="ml-6 flex list-decimal flex-col gap-3 font-heading text-base leading-relaxed text-foreground marker:text-muted-foreground">
          <li>
            <strong className="font-semibold">Postgres is the durable cache.</strong>{" "}
            WordPress is the source of truth; Neon Postgres is the
            served-from store. The sync worker is the only thing that ever
            touches WordPress; user page requests read from Postgres through
            GraphQL. That is what satisfies the brief&rsquo;s &ldquo;store /
            cache the WordPress data&rdquo; requirement, and it is what
            keeps requests fast and protects the app from upstream API
            latency or temporary WordPress failures.
          </li>
          <li>
            <strong className="font-semibold">Next.js Data Cache is the presentation cache.</strong>{" "}
            Every server-component GraphQL call uses{" "}
            <Code>fetch(&hellip;, &#123; next: &#123; tags, revalidate: 60-300 &#125; &#125;)</Code>.
            Warm requests are served from Vercel&rsquo;s server-side data
            cache without re-running the resolver or hitting Postgres. This
            is platform-side caching, not browser caching.
          </li>
          <li>
            <strong className="font-semibold">Tag invalidation on write.</strong>{" "}
            After every successful sync, /api/sync calls{" "}
            <Code>revalidateTag(&apos;homepage&apos;)</Code> plus a per-slug{" "}
            <Code>post:&lt;slug&gt;</Code> tag for each updated post. New
            stories land within seconds of the cron tick rather than waiting
            out the revalidate window.
          </li>
          <li>
            <strong className="font-semibold">Per-request DataLoader.</strong>{" "}
            For chatty resolvers (author, media, term) a DataLoader batches
            inside a single GraphQL request to dedupe round trips. Drizzle
            relational queries handle list pages, so DataLoader exists to
            cover the long tail rather than carry the load.
          </li>
          <li>
            <strong className="font-semibold">Browser layer (least important).</strong>{" "}
            The browser may cache prefetched <Code>&lt;Link&gt;</Code>{" "}
            payloads and static assets via standard HTTP headers, but it is
            not responsible for content freshness. Pull the plug on the
            browser cache and nothing about the architecture changes.
          </li>
        </ol>
      </section>

      <section aria-labelledby="sync-heading" className="flex flex-col gap-5">
        <SectionRule label="Sync" id="sync-heading">
          WordPress to Postgres
        </SectionRule>
        <p className="font-heading text-lg leading-relaxed text-foreground">
          The handler at <Code>/api/sync</Code> is bearer-token gated by{" "}
          <Code>SYNC_TOKEN</Code> so only an authenticated trigger
          (scheduler or admin) can run it. A Vercel Cron entry is wired
          for a <Code>*/5 * * * *</Code> tick, but is currently{" "}
          <strong className="font-semibold">disabled on this deployment</strong>{" "}
          to stay inside the free Hobby tier&rsquo;s budget envelope - cron
          minutes, function invocations, and Postgres compute all bill against
          the same allowance, and a 5-minute tick during idle review traffic
          is pure waste. Re-enabling is a one-line change in{" "}
          <Code>vercel.json</Code> when promoted to Pro; until then the same
          pipeline is reachable via the admin force-sync page (basic-auth
          gated) or a direct authenticated POST. The pipeline itself is
          deliberately boring:
        </p>
        <ul className="ml-6 flex list-disc flex-col gap-2 font-heading text-base leading-relaxed text-foreground marker:text-muted-foreground">
          <li>
            <strong className="font-semibold">Cursor.</strong> WordPress&rsquo;s{" "}
            <Code>modified_after</Code> query parameter, advanced only after a
            page commits. A 60-second overlap on each tick covers clock skew
            between the WP host and Vercel.
          </li>
          <li>
            <strong className="font-semibold">Order.</strong> Idempotent upserts
            in dependency order: media, authors, terms, posts, post_terms.
            Re-running a completed sync produces zero row changes.
          </li>
          <li>
            <strong className="font-semibold">Sanitization on write.</strong>{" "}
            Article HTML is run through a strict <Code>sanitize-html</Code>{" "}
            allowlist before it ever reaches the database. The frontend
            renders the stored HTML directly; trust is established once, at
            the boundary, not at every render.
          </li>
          <li>
            <strong className="font-semibold">Observability.</strong> Each run
            inserts a <Code>sync_runs</Code> row with status, counts, and
            notes. The public{" "}
            <Link
              href="/sync-status"
              className="underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              sync-status page
            </Link>{" "}
            reads the last 20 rows; the admin force-sync page (basic-auth
            gated) lets a reviewer trigger one without waiting on cron.
          </li>
        </ul>
      </section>

      <section aria-labelledby="graphql-heading" className="flex flex-col gap-5">
        <SectionRule label="GraphQL" id="graphql-heading">
          Hand-written, not generated
        </SectionRule>
        <p className="font-heading text-lg leading-relaxed text-foreground">
          The schema is one SDL file in the repo. Resolvers are thin wrappers
          over Drizzle relational queries; pagination is cursor-based on{" "}
          <Code>publishedAt|id</Code> base64-encoded so cursors are stable
          across sorts. Frontend code never imports from <Code>src/db/</Code>
          {" "}- it goes through <Code>lib/graphql-fetch.ts</Code> so the
          boundary stays clean and a future client (mobile app, another
          team&rsquo;s service) gets the same surface.
        </p>
        <p className="font-heading text-lg leading-relaxed text-foreground">
          Operation types are generated via <Code>graphql-codegen</Code> and a{" "}
          <Code>codegen:check</Code> step in CI fails the build if{" "}
          <Code>__generated__/</Code> drifts from the SDL.
        </p>
      </section>

      <section aria-labelledby="frontend-heading" className="flex flex-col gap-5">
        <SectionRule label="Frontend" id="frontend-heading" />
        <ul className="ml-6 flex list-disc flex-col gap-2 font-heading text-base leading-relaxed text-foreground marker:text-muted-foreground">
          <li>
            Server components everywhere a fetch is needed; client islands only
            for true interactivity (theme toggle, drawer, debounced search,
            infinite scroll).
          </li>
          <li>
            Editorial design system per <Code>.impeccable.md</Code>: Source
            Serif 4 carries headlines, Inter handles UI, accent is a verb
            (focus rings, search affordances) rather than decoration.
          </li>
          <li>
            Light + dark are first-class. The pre-hydration script in{" "}
            <Code>app/layout.tsx</Code> reads the saved preference (or{" "}
            <Code>prefers-color-scheme</Code>) before paint, so there is no
            flash of the wrong theme.
          </li>
          <li>
            WCAG-conscious accessibility target (working toward 2.1 AA).
            Playwright + axe-core run as part of the e2e job; a serious or
            critical violation fails CI. Articles also expose a Web Speech
            API &ldquo;Listen&rdquo; control so the body copy is consumable
            without reading.
          </li>
        </ul>
      </section>

      <section aria-labelledby="ui-extras-heading" className="flex flex-col gap-5">
        <SectionRule label="UI extras" id="ui-extras-heading">
          Things that were not asked for, and how they are built
        </SectionRule>
        <p className="font-heading text-lg leading-relaxed text-foreground">
          The brief asked for a homepage and an article page. Everything below
          ships on top of that on the same Vercel free tier.
        </p>
        <ul className="ml-6 flex list-disc flex-col gap-3 font-heading text-base leading-relaxed text-foreground marker:text-muted-foreground">
          <li>
            <strong className="font-semibold">Listen to any article.</strong>{" "}
            A browser-native &ldquo;Listen&rdquo; control on every article
            page, implemented with the Web Speech API
            (<Code>window.speechSynthesis</Code> +{" "}
            <Code>SpeechSynthesisUtterance</Code>). The sanitized article HTML
            is converted to speech-friendly text with paragraph breaks
            preserved, then chunked paragraph-by-paragraph (with a 600-char
            sentence-fallback split) so Chrome&rsquo;s per-utterance length
            cap never truncates the read. Voice selection is asynchronous
            (Chromium returns an empty list on the first{" "}
            <Code>getVoices()</Code> call), so a promise wraps{" "}
            <Code>onvoiceschanged</Code> and a three-state availability
            pattern (<Code>null</Code> = resolving, <Code>false</Code> =
            hide, <Code>true</Code> = show) prevents the button from
            flashing in and out. Voice priority is locked to natural-sounding
            US English female voices (Microsoft Jenny Online, Aria Online,
            Samantha, Google US English Female, Zira); if the device exposes
            none of them, the control hides itself instead of falling through
            to the robotic platform default. Zero backend cost, zero API key,
            zero per-character billing, audio synthesized on the
            reader&rsquo;s device.
          </li>
          <li>
            <strong className="font-semibold">In production we would not ship the browser voice.</strong>{" "}
            The Web Speech API is the right call for a take-home: free,
            instant, no vendor lock-in. For a real news product I would
            replace the synthesis layer with ElevenLabs (or a comparable
            neural-TTS provider) for editorial-grade narration, or fine-tune
            a voice on TRD&rsquo;s house style and cache the resulting audio
            in Vercel Blob keyed by{" "}
            <Code>post.slug + content_hash</Code>. The UI surface stays the
            same; only the audio source swaps from on-device synthesis to a
            CDN-delivered MP3. Per-article TTS cost on ElevenLabs at current
            pricing lands around the cost of a single editorial image, and
            the result is indistinguishable from a human reader.
          </li>
          <li>
            <strong className="font-semibold">Inline YouTube embeds.</strong>{" "}
            TRD articles routinely embed video. The{" "}
            <Code>sanitize-html</Code> allowlist permits <Code>&lt;iframe&gt;</Code>{" "}
            with a strict src-host check for YouTube, so the rendered article
            HTML carries the embed end-to-end and the page reads the way the
            editor wrote it.
          </li>
          <li>
            <strong className="font-semibold">Infinite scroll on the homepage.</strong>{" "}
            Cursor-based GraphQL pagination plus an{" "}
            <Code>IntersectionObserver</Code>-driven loader keeps appending
            older stories as the reader nears the bottom. Skeletons hold the
            grid layout during the fetch so the page never jumps.
          </li>
          <li>
            <strong className="font-semibold">Full-text search.</strong>{" "}
            Postgres <Code>tsvector</Code> with a GIN index, <Code>ts_rank</Code>{" "}
            ordering, debounced query, highlighted matches, and a results-count
            chip. Powered by a real GraphQL field (<Code>searchPosts</Code>),
            not a hand-rolled <Code>LIKE</Code>.
          </li>
          <li>
            <strong className="font-semibold">Light + dark, first-class.</strong>{" "}
            A pre-hydration script in <Code>app/layout.tsx</Code> applies the
            saved preference (or <Code>prefers-color-scheme</Code>) before
            paint, so there is no flash of the wrong theme. Every component
            reads cleanly in both modes; the toggle is a single icon in the
            masthead and in the mobile drawer.
          </li>
          <li>
            <strong className="font-semibold">Responsive across phone, tablet, desktop.</strong>{" "}
            Editorial density preserved across breakpoints. Mobile shows a
            left-drawer masthead with hamburger, search, primary nav,
            categories, and theme toggle. Desktop shows a full inline nav
            with a categories dropdown and inline search affordance.
          </li>
          <li>
            <strong className="font-semibold">Skeletons over spinners.</strong>{" "}
            Every awaited fetch (homepage cards, article body, search) paints
            a layout-faithful skeleton via{" "}
            <Code>animate-pulse</Code>. The grid never collapses, the page
            never jumps.
          </li>
        </ul>
      </section>

      <section aria-labelledby="tradeoffs-heading" className="flex flex-col gap-5">
        <SectionRule label="Tradeoffs" id="tradeoffs-heading">
          What got cut, and why
        </SectionRule>
        <ul className="ml-6 flex list-disc flex-col gap-3 font-heading text-base leading-relaxed text-foreground marker:text-muted-foreground">
          <li>
            <strong className="font-semibold">No code-gen for resolvers.</strong>{" "}
            Pothos would have given typed resolvers from a builder API; the
            hand-written SDL was simpler for a take-home and easier to read in
            review. At a larger surface area, the cost flips.
          </li>
          <li>
            <strong className="font-semibold">No static prerender on the homepage.</strong>{" "}
            The page reads through the in-process <Code>/api/graphql</Code>{" "}
            handler, which is not running at build time.{" "}
            <Code>force-dynamic</Code> plus the Data Cache shoulder the caching
            role at request time - same end result, simpler build.
          </li>
          <li>
            <strong className="font-semibold">Permissive CSP.</strong>{" "}
            <Code>img-src https:</Code> and <Code>frame-src https:</Code> so
            editorial markup (TRD CDN images, embedded YouTube) renders without
            an allowlist of every CDN. A production hardening pass would
            tighten host-by-host.
          </li>
          <li>
            <strong className="font-semibold">Brand distance from TRD.</strong>{" "}
            Layout is borrowed from WSJ/NYT/FT; the wordmark, palette, and type
            system are intentionally not the TRD red sans-serif so the demo
            never reads as a clone.
          </li>
          <li>
            <strong className="font-semibold">No persisted operations.</strong>{" "}
            Persisted-query infra is overkill for a single-client demo; a
            real-world rollout would persist for security and bandwidth.
          </li>
        </ul>
      </section>

      <section aria-labelledby="ai-heading" className="flex flex-col gap-5">
        <SectionRule label="AI tooling" id="ai-heading">
          How it was actually used
        </SectionRule>
        <p className="font-heading text-lg leading-relaxed text-foreground">
          Built collaboratively with Claude Code. Architecture, schema, and
          decisions are mine; the agent accelerated implementation, ran
          test-and-audit passes, and helped keep the code surface tidy.
        </p>
        <ul className="ml-6 flex list-disc flex-col gap-2 font-heading text-base leading-relaxed text-foreground marker:text-muted-foreground">
          <li>
            Three-agent pattern per phase: implementer, auditor (tests +
            requirement check), documenter (commit + readme).
          </li>
          <li>
            Used for the unglamorous wins: schema migrations, sanitize-html
            allowlist, codegen wiring, axe-core script, deploy verification,
            CSP debugging, repeated typecheck-build-test loops.
          </li>
          <li>
            Project documentation lives in an Obsidian vault outside the
            repo and is indexed for vector-embedding search, so prior
            decisions, brief excerpts, and design references can be
            retrieved by meaning instead of filename. The agent reads from
            that vault when context is needed and writes new decisions back
            into it, so the knowledge base compounds across sessions
            instead of resetting with each conversation.
          </li>
          <li>
            Not used to invent design direction. <Code>.impeccable.md</Code>{" "}
            captures the editorial reference set (WSJ, NYT, FT) and
            anti-references (TRD red sans-serif, generic SaaS marketing pages,
            crypto dashboards). Every design decision was checked against it.
          </li>
        </ul>
      </section>

      <section aria-labelledby="next-heading" className="flex flex-col gap-5">
        <SectionRule label="What I&rsquo;d do next" id="next-heading" />
        <ul className="ml-6 flex list-disc flex-col gap-2 font-heading text-base leading-relaxed text-foreground marker:text-muted-foreground">
          <li>
            Tighten CSP per-host (the current <Code>https:</Code> wildcard is a
            take-home concession).
          </li>
          <li>
            Promote the in-process GraphQL fetch to a real network boundary so
            list pages can statically prerender at build time and cache more
            aggressively at the edge.
          </li>
          <li>
            Persisted operations + per-operation rate limiting; today only the
            sync handler is rate-protected (token gate).
          </li>
          <li>
            Wire structured logging (pino) to Vercel&rsquo;s log drain instead
            of the default stdout.
          </li>
        </ul>
      </section>

      <section
        aria-labelledby="attribution-heading"
        className="flex flex-col gap-3 border-t border-border pt-8"
      >
        <SectionRule label="Attribution" id="attribution-heading" />
        <p className="font-heading text-base leading-relaxed text-muted-foreground">
          Source content belongs to{" "}
          <Link
            href="https://therealdeal.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4 transition-colors hover:text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            The Real Deal
          </Link>
          . This demo links each article back to its original canonical URL.
        </p>
      </section>
    </article>
  );
}
