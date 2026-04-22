import { describe, expect, it } from "vitest";

import { createQueryClient } from "./queries";

describe("createQueryClient", () => {
  it("sets sensible default query staleTime", () => {
    const client = createQueryClient();
    const defaults = client.getDefaultOptions();
    expect(defaults.queries?.staleTime).toBe(10_000);
  });
});
