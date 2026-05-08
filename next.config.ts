import type { NextConfig } from "next";

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
};

export default nextConfig;
