import { describe, expect, it } from "vitest";

import { parseOgImageFromHtml } from "@/src/lib/og-image";

describe("parseOgImageFromHtml", () => {
  it("extracts og:image URL when present in standard order", () => {
    const html = `
      <html><head>
        <meta property="og:image" content="https://example.com/hero.jpg" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="Editorial hero" />
      </head></html>
    `;
    expect(parseOgImageFromHtml(html)).toEqual({
      url: "https://example.com/hero.jpg",
      width: 1200,
      height: 630,
      alt: "Editorial hero",
    });
  });

  it("tolerates flipped attribute order (content first)", () => {
    const html = `<meta content="https://cdn.example.com/x.png" property="og:image">`;
    expect(parseOgImageFromHtml(html)?.url).toBe(
      "https://cdn.example.com/x.png",
    );
  });

  it("tolerates single-quoted attributes", () => {
    const html = `<meta property='og:image' content='https://cdn.example.com/y.jpg'>`;
    expect(parseOgImageFromHtml(html)?.url).toBe(
      "https://cdn.example.com/y.jpg",
    );
  });

  it("returns null when og:image is missing", () => {
    expect(parseOgImageFromHtml("<html></html>")).toBeNull();
    expect(
      parseOgImageFromHtml('<meta property="og:title" content="x">'),
    ).toBeNull();
  });

  it("nulls width/height when invalid or missing", () => {
    const html = `
      <meta property="og:image" content="https://example.com/p.jpg">
      <meta property="og:image:width" content="not-a-number">
    `;
    const result = parseOgImageFromHtml(html);
    expect(result?.url).toBe("https://example.com/p.jpg");
    expect(result?.width).toBeNull();
    expect(result?.height).toBeNull();
  });

  it("matches a real-world TRD-shaped meta cluster", () => {
    const html = `
      <meta property="og:locale" content="en_US">
      <meta property="og:type" content="article">
      <meta property="og:title" content="More Oakland apartments up for sale after lender foreclosure">
      <meta property="og:image" content="https://static.therealdeal.com/wp-content/uploads/2026/05/SFO-Oakland-Apts-For-Sale-MAIN.jpg">
      <meta property="og:image:width" content="1200">
      <meta property="og:image:height" content="800">
    `;
    const result = parseOgImageFromHtml(html);
    expect(result).toEqual({
      url: "https://static.therealdeal.com/wp-content/uploads/2026/05/SFO-Oakland-Apts-For-Sale-MAIN.jpg",
      width: 1200,
      height: 800,
      alt: null,
    });
  });
});
