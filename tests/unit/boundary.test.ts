/**
 * Frontend boundary rule (plan.md section 13).
 *
 * "the frontend talks to GraphQL only ... do not let the frontend
 *  import from `src/db/`."
 *
 * The boundary applies to React components and pages. Backend route
 * handlers under `app/api/*` are exempt because they are server
 * functions, not UI; healthz in particular needs to read post counts
 * from Postgres directly.
 *
 * This test walks every consumer location that the rule covers and
 * fails the suite if it finds a forbidden import. Anyone breaking the
 * boundary will see this red before the change ever lands.
 *
 * Implementation note: we walk the filesystem with `node:fs` rather
 * than shelling out to `grep` so the test runs on every platform and
 * does not concatenate any external input into a shell string.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SCAN_PATHS = ["app", "src/components"];
// Locations whose files are exempt from the boundary rule. Currently
// only API route handlers (server functions, not UI).
const EXEMPT_PREFIXES = [path.join("app", "api") + path.sep];

const FORBIDDEN_IMPORT = /from\s+["']@\/(?:src\/)?db(?:\/[\w-]+)?["']/;

function isCodeFile(filename: string): boolean {
  return /\.(?:ts|tsx|js|jsx|mts|mjs|cts|cjs)$/.test(filename);
}

function walk(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else if (entry.isFile() && isCodeFile(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function isExempt(relativePath: string): boolean {
  return EXEMPT_PREFIXES.some((p) => relativePath.startsWith(p));
}

describe("Frontend boundary rule (plan.md section 13)", () => {
  it("no React component or page imports from src/db/", () => {
    const offenders: string[] = [];
    for (const rel of SCAN_PATHS) {
      const root = path.join(REPO_ROOT, rel);
      for (const file of walk(root)) {
        const repoRel = path.relative(REPO_ROOT, file);
        if (isExempt(repoRel)) continue;
        const text = fs.readFileSync(file, "utf-8");
        if (FORBIDDEN_IMPORT.test(text)) {
          offenders.push(repoRel);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
