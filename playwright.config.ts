import fs from "node:fs";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

// Load `.env.local` so e2e tests can read ADMIN_USER, ADMIN_PASS, and
// SYNC_TOKEN without the developer having to source the file or set CI
// env vars by hand. Mirrors the loader in `vitest.config.ts` so both
// runners populate `process.env` identically. Without this, the
// `/admin/sync` SYNC_TOKEN-leak test silently `test.skip()`s, which
// would let a real leak ship undetected.
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

const PORT = Number(process.env.PORT ?? 3000);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm start",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
