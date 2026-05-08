import type { NextConfig } from "next";

// Content-Security-Policy for the demo deployment.
//
// Per plan.md section 9.5 (Security) and section 12 Phase 7's explicit
// "ADD CSP LAST" warning, this policy is intentionally permissive: the
// goal is to set a clear deny-by-default baseline and tighten only when
// the policy can be proven non-breaking. A CSP that breaks the demo
// defeats the purpose, so we lean toward `https:` allowlists rather
// than per-host pinning.
//
// Notable choices:
//  - `script-src 'unsafe-inline'`: required by the JSON-LD `<script>`
//    tag we emit on article pages. A production hardening pass would
//    generate per-request nonces; out of scope for this take-home.
//    `'unsafe-eval'` is appended ONLY in development (Next's HMR
//    pipeline relies on it). Per Next's official CSP guidance neither
//    React nor Next use `eval` in production, so production responses
//    must not include it.
//  - `style-src 'unsafe-inline'`: Tailwind/shadcn inject runtime
//    classes via inline styles, and editorial markup pulled from
//    WordPress carries inline `style="..."` attributes that the
//    sanitize-html allowlist preserves.
//  - `img-src 'self' https: data: blob:`: TRD's editorial images live
//    across multiple CDN subdomains; allowing all https sources is the
//    simplest way to keep article hero images rendering.
//  - `frame-ancestors 'none'`: prevents click-jacking via iframe
//    embeds even though the X-Frame-Options header below is what most
//    real browsers honor.
const isDev = process.env.NODE_ENV === "development";
const cspHeader = [
  "default-src 'self'",
  "img-src 'self' https: data: blob:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "font-src 'self' https: data:",
  "connect-src 'self' https:",
  "frame-src 'self' https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // The sync handler imports `ws` (Neon's WebSocket polyfill) and
  // `pino` for structured logging. Both ship native bindings or
  // worker_threads loaders that Next's default Webpack/Turbopack
  // bundling cannot handle. Marking them external tells Next to keep
  // them as plain Node `require()` calls at runtime, which is exactly
  // what the Vercel Node functions runtime expects.
  serverExternalPackages: [
    "ws",
    "bufferutil",
    "utf-8-validate",
    "pino",
    "pino-pretty",
    "@neondatabase/serverless",
  ],
  // Allowlist of remote image origins for next/image. TRD's editorial
  // images live on therealdeal.com (and a few CDN variants); Gravatar
  // hosts most author avatars.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "therealdeal.com" },
      { protocol: "https", hostname: "*.therealdeal.com" },
      { protocol: "https", hostname: "static.therealdeal.com" },
      { protocol: "https", hostname: "secureservercdn.net" },
      { protocol: "https", hostname: "gravatar.com" },
      { protocol: "https", hostname: "*.gravatar.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
