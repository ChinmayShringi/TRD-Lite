import { describe, expect, it } from "vitest";

import { sanitizeArticleHtml } from "@/src/lib/sanitize";

describe("sanitizeArticleHtml", () => {
  it("strips <script> tags entirely (no executable JS reaches the DOM)", () => {
    const dirty = `<p>hello</p><script>alert(1)</script><p>world</p>`;
    const clean = sanitizeArticleHtml(dirty);
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("alert(1)");
    expect(clean).toContain("<p>hello</p>");
    expect(clean).toContain("<p>world</p>");
  });

  it("strips inline event handlers like onclick from anchors", () => {
    const dirty = `<a href="https://example.com" onclick="evil()">click</a>`;
    const clean = sanitizeArticleHtml(dirty);
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("evil()");
    expect(clean).toContain('href="https://example.com"');
    // The transformTag adds rel="noopener noreferrer".
    expect(clean).toContain('rel="noopener noreferrer"');
  });

  it("keeps <img> with src/alt/width/height attributes", () => {
    const dirty = `<img src="https://x.com/img.jpg" alt="x" width="100" height="100">`;
    const clean = sanitizeArticleHtml(dirty);
    expect(clean).toContain('src="https://x.com/img.jpg"');
    expect(clean).toContain('alt="x"');
    expect(clean).toContain('width="100"');
    expect(clean).toContain('height="100"');
  });

  it("keeps <figure><img><figcaption> editorial markup intact", () => {
    const dirty = `<figure><img src="https://x.com/img.jpg" alt="x"><figcaption>caption</figcaption></figure>`;
    const clean = sanitizeArticleHtml(dirty);
    expect(clean).toContain("<figure>");
    expect(clean).toContain("</figure>");
    expect(clean).toContain('src="https://x.com/img.jpg"');
    expect(clean).toContain("<figcaption>caption</figcaption>");
  });

  it("strips javascript: href and onerror attribute (XSS vectors)", () => {
    const dirty = `<a href="javascript:alert(1)">click</a><img src=x onerror=alert(1)>`;
    const clean = sanitizeArticleHtml(dirty);
    expect(clean).not.toContain("javascript:");
    expect(clean).not.toContain("onerror");
    expect(clean).toContain("<a");
    expect(clean).toContain("<img");
  });
});
