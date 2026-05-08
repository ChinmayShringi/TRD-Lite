/**
 * Sync visibility e2e tests (plan.md section 12 Phase 8).
 *
 * Three contracts:
 *   1. `/sync-status` is publicly viewable (200, no auth) and shows
 *      the page heading.
 *   2. `/admin/sync` returns 401 + WWW-Authenticate without credentials.
 *   3. `/admin/sync` loads with correct credentials, renders the
 *      Force-sync button, and (critically) does NOT leak the
 *      `SYNC_TOKEN` value into the page HTML.
 *
 * The token-leak assertion is the security invariant of Wave 7. The
 * token is read inside a server action and only attached to a
 * server-side fetch; if it ever appeared in `page.content()` we would
 * have a regression.
 */
import { expect, test } from "@playwright/test";

test.describe("sync visibility", () => {
  test("public /sync-status loads without auth", async ({ page }) => {
    const response = await page.goto("/sync-status");
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: /sync status/i }),
    ).toBeVisible();
  });

  test("/admin/sync challenges with 401 + WWW-Authenticate", async ({
    request,
  }) => {
    const res = await request.get("/admin/sync", { maxRedirects: 0 });
    expect(res.status()).toBe(401);
    const headers = res.headers();
    const wwwAuth = headers["www-authenticate"] ?? "";
    expect(wwwAuth.toLowerCase()).toContain("basic");
  });

  test("/admin/sync loads with creds and SYNC_TOKEN never reaches the browser", async ({
    browser,
  }) => {
    const user = process.env.ADMIN_USER;
    const pass = process.env.ADMIN_PASS;
    const token = process.env.SYNC_TOKEN ?? "";
    test.skip(
      !user || !pass,
      "ADMIN_USER/ADMIN_PASS not in env, cannot exercise authenticated flow",
    );
    test.skip(
      token.length === 0,
      "SYNC_TOKEN not in env, token leak assertion needs a real value",
    );

    const ctx = await browser.newContext({
      httpCredentials: { username: user!, password: pass! },
    });
    try {
      const page = await ctx.newPage();
      const response = await page.goto("/admin/sync");
      expect(response?.status()).toBe(200);

      // The Force-sync button must be present on the authenticated page.
      await expect(
        page.getByRole("button", { name: /force sync/i }),
      ).toBeVisible();

      // The token must NEVER appear in the page HTML.
      const html = await page.content();
      expect(html).not.toContain(token);
    } finally {
      await ctx.close();
    }
  });
});
