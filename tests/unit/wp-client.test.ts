import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPosts } from "@/src/lib/wp-client";

function jsonResponse(
  body: unknown,
  init: { status?: number; total?: number; totalPages?: number } = {},
): Response {
  const headers = new Headers({ "content-type": "application/json" });
  if (init.total !== undefined) headers.set("x-wp-total", String(init.total));
  if (init.totalPages !== undefined) headers.set("x-wp-totalpages", String(init.totalPages));
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers,
  });
}

describe("getPosts retries", () => {
  beforeEach(() => {
    // Stub the backoff sleep so the test runs in milliseconds.
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries on 5xx then succeeds on 200, calling fetch 3 times", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("server error", { status: 500 }))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(
        jsonResponse([{ id: 1, slug: "hello" }], { total: 1, totalPages: 1 }),
      );

    vi.spyOn(globalThis, "fetch").mockImplementation(fetchMock);

    const result = await getPosts({ perPage: 1 });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.posts).toHaveLength(1);
    expect(result.posts[0]?.slug).toBe("hello");
  });
});
