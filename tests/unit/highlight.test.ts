import { describe, expect, it } from "vitest";

import {
  buildHighlightRegex,
  splitHighlightedSnippet,
  splitPlainText,
} from "@/src/lib/highlight";

describe("splitHighlightedSnippet", () => {
  it("splits a Postgres ts_headline snippet into alternating segments", () => {
    const snippet =
      "The walls are closing in on Jiazhao <mark>Frank</mark> Chen.";
    expect(splitHighlightedSnippet(snippet)).toEqual([
      { text: "The walls are closing in on Jiazhao ", matched: false },
      { text: "Frank", matched: true },
      { text: " Chen.", matched: false },
    ]);
  });

  it("handles multiple matches", () => {
    const snippet = "<mark>foo</mark> bar <mark>baz</mark>";
    expect(splitHighlightedSnippet(snippet)).toEqual([
      { text: "foo", matched: true },
      { text: " bar ", matched: false },
      { text: "baz", matched: true },
    ]);
  });

  it("falls back gracefully on unbalanced markers", () => {
    expect(splitHighlightedSnippet("plain <mark>oops")).toEqual([
      { text: "plain ", matched: false },
      { text: "oops", matched: false },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(splitHighlightedSnippet("")).toEqual([]);
  });
});

describe("buildHighlightRegex", () => {
  it("ignores stopwords and short tokens", () => {
    expect(buildHighlightRegex("the of and a")).toBeNull();
    expect(buildHighlightRegex("of foreclosure")?.source).toContain(
      "foreclosure",
    );
    expect(buildHighlightRegex("of foreclosure")?.source).not.toContain(
      "of",
    );
  });

  it("dedupes tokens", () => {
    const re = buildHighlightRegex("Oakland oakland OAKLAND");
    expect(re?.source.match(/oakland/g)?.length).toBe(1);
  });

  it("matches case-insensitively with trailing-word expansion", () => {
    const re = buildHighlightRegex("foreclosure");
    const text = "Two FORECLOSURES were filed.";
    expect(splitPlainText(text, re)).toEqual([
      { text: "Two ", matched: false },
      { text: "FORECLOSURES", matched: true },
      { text: " were filed.", matched: false },
    ]);
  });
});

describe("splitPlainText", () => {
  it("returns the whole input when regex is null", () => {
    expect(splitPlainText("hello", null)).toEqual([
      { text: "hello", matched: false },
    ]);
  });

  it("highlights multiple separate matches", () => {
    const re = buildHighlightRegex("Oakland Manhattan");
    expect(splitPlainText("Oakland to Manhattan", re)).toEqual([
      { text: "Oakland", matched: true },
      { text: " to ", matched: false },
      { text: "Manhattan", matched: true },
    ]);
  });
});
