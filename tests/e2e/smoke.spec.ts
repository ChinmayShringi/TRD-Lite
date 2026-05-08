/**
 * Accessibility smoke test for TRD-Lite.
 *
 * Per plan.md section 9.5 (Accessibility) and section 12 Phase 7's
 * done criterion, the e2e suite must demonstrate that the homepage
 * and a real article page render without any `serious` or `critical`
 * axe-core violations. Less-severe violations (notably `moderate` and
 * `minor`) are tolerated because they often surface against editorial
 * HTML coming straight from the WordPress source we cannot fix in this
 * codebase.
 *
 * The article test is dynamic: we navigate to the homepage, grab the
 * first `/article/<slug>` link present in the rendered DOM, and run
 * the same axe checks against that detail page. The dynamic approach
 * keeps the test robust against the take-home's rolling 500-post
 * window without hard-coding a slug that may rotate out.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const SEVERE_IMPACTS = new Set(["serious", "critical"]);

test.describe("a11y smoke", () => {
  test("homepage has zero serious/critical axe violations", async ({
    page,
  }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .options({ resultTypes: ["violations"] })
      .analyze();
    const severe = results.violations.filter((v) =>
      SEVERE_IMPACTS.has(v.impact ?? ""),
    );
    expect(severe, JSON.stringify(severe, null, 2)).toEqual([]);
  });

  test("article page has zero serious/critical axe violations", async ({
    page,
  }) => {
    await page.goto("/");
    const articleHref = await page
      .locator('a[href^="/article/"]')
      .first()
      .getAttribute("href");
    test.skip(!articleHref, "no article link rendered on the homepage");
    if (!articleHref) return;
    await page.goto(articleHref);
    const results = await new AxeBuilder({ page })
      .options({ resultTypes: ["violations"] })
      .analyze();
    const severe = results.violations.filter((v) =>
      SEVERE_IMPACTS.has(v.impact ?? ""),
    );
    expect(severe, JSON.stringify(severe, null, 2)).toEqual([]);
  });
});
