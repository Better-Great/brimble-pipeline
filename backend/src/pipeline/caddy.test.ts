import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addRoute, removeRoute } from "./caddy.js";

describe("caddy pipeline adapter", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("adds route by posting to Caddy admin endpoint", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
    });

    const url = await addRoute("abc-123", 4123);

    expect(url).toBe("http://localhost/abc-123");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://caddy:2019/config/apps/http/servers/srv0/routes",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("removes matching route by deleting index", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { match: [{ path: ["/something/*"] }] },
          { match: [{ path: ["/dep-1/*"] }] },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

    await removeRoute("dep-1");

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://caddy:2019/config/apps/http/servers/srv0/routes/1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
