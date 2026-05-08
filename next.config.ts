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
};

export default nextConfig;
