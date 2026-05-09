import { describe, expect, it } from "vitest";

import { decodeText, stripAndDecode } from "@/src/lib/text";

describe("decodeText", () => {
  it("decodes numeric HTML entities (curly quotes, ampersand)", () => {
    expect(decodeText("Jiazhao &#8220;Frank&#8221; Chen")).toBe(
      "Jiazhao “Frank” Chen",
    );
    expect(decodeText("AT&amp;T")).toBe("AT&T");
  });

  it("decodes named HTML entities (nbsp, hellip)", () => {
    expect(decodeText("Foo&nbsp;bar")).toBe("Foo bar");
    expect(decodeText("Read more&hellip;")).toBe("Read more…");
  });

  it("returns empty string for null/undefined/empty", () => {
    expect(decodeText(null)).toBe("");
    expect(decodeText(undefined)).toBe("");
    expect(decodeText("")).toBe("");
  });

  it("leaves already-decoded text unchanged", () => {
    expect(decodeText("Plain title")).toBe("Plain title");
    expect(decodeText("“Frank”")).toBe("“Frank”");
  });
});

describe("stripAndDecode", () => {
  it("strips HTML tags then decodes entities", () => {
    expect(
      stripAndDecode(
        "<p>The walls are closing in on Jiazhao &#8220;Frank&#8221; Chen.</p>",
      ),
    ).toBe("The walls are closing in on Jiazhao “Frank” Chen.");
  });

  it("collapses leading/trailing whitespace from stripped output", () => {
    expect(stripAndDecode("  <p>hello</p>  ")).toBe("hello");
  });

  it("handles WordPress excerpt shape with nested tags", () => {
    const wpExcerpt =
      "<p>Months after purchasing the ground lease&#8230; <a href=\"x\">read on</a></p>\n";
    expect(stripAndDecode(wpExcerpt)).toBe(
      "Months after purchasing the ground lease… read on",
    );
  });

  it("returns empty string for null/undefined/empty", () => {
    expect(stripAndDecode(null)).toBe("");
    expect(stripAndDecode(undefined)).toBe("");
    expect(stripAndDecode("")).toBe("");
  });
});
