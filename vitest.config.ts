import { defineConfig } from "vitest/config";
import path from "node:path";
import fs from "node:fs";

// Load `.env.local` so DB-touching tests can pick up Neon credentials
// without the developer having to remember to source the file. Skip
// silently if the file is absent; tests that require it will fail loudly
// with a helpful message instead of mysteriously hanging.
function loadDotEnvLocal(): void {
  const envPath = path.resolve(__dirname, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const valueRaw = line.slice(eq + 1).trim();
    const unquoted = valueRaw.replace(/^"|"$/g, "");
    if (process.env[key] === undefined) {
      process.env[key] = unquoted;
    }
  }
}

loadDotEnvLocal();

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/.next/**",
        "tests/**",
        "**/*.config.{ts,js,mjs}",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
