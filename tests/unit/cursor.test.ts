/**
 * Unit tests for the GraphQL cursor encode/decode pair.
 *
 * Two contracts:
 * 1. Round-trip: decode(encode(x)) === x for any well-formed input.
 * 2. Decode rejects malformed input (throws GraphQLError) instead of
 *    silently returning a default. This protects callers from
 *    accidentally treating a bad cursor as "no cursor" and re-paging
 *    the entire result set.
 */
import { describe, expect, it } from "vitest";
import { GraphQLError } from "graphql";

import { decodeCursor, encodeCursor } from "@/src/graphql/cursor";

describe("cursor encode/decode", () => {
  it("round-trips a (publishedAt, id) tuple unchanged", () => {
    const value = { publishedAt: new Date("2026-05-08T17:00:00.000Z"), id: 1030401 };
    const encoded = encodeCursor(value);
    const decoded = decodeCursor(encoded);
    expect(decoded.id).toBe(value.id);
    expect(decoded.publishedAt.toISOString()).toBe(value.publishedAt.toISOString());
  });

  it("rejects a malformed cursor (non-base64 garbage)", () => {
    // A string that decodes to something without the `|` delimiter.
    // `aGVsbG8=` is base64("hello"), no separator.
    expect(() => decodeCursor("aGVsbG8=")).toThrow(GraphQLError);
  });

  it("rejects an empty cursor", () => {
    expect(() => decodeCursor("")).toThrow(GraphQLError);
  });

  it("rejects a cursor with an invalid date half", () => {
    const bad = Buffer.from("not-a-date|123", "utf-8").toString("base64");
    expect(() => decodeCursor(bad)).toThrow(GraphQLError);
  });

  it("rejects a cursor with a non-integer id half", () => {
    const bad = Buffer.from("2026-05-08T17:00:00.000Z|abc", "utf-8").toString("base64");
    expect(() => decodeCursor(bad)).toThrow(GraphQLError);
  });
});
