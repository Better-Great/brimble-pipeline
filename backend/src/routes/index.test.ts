import { describe, expect, it, vi } from "vitest";

vi.mock("./deployments.js", () => ({
  default: vi.fn(),
}));

vi.mock("./logs.js", () => ({
  default: vi.fn(),
}));

describe("api route registration", () => {
  it("registers deployments and logs routes", async () => {
    const register = vi.fn();
    const fastify = { register } as any;

    const mod = await import("./index.js");
    await mod.default(fastify, {} as never);

    expect(register).toHaveBeenCalledTimes(2);
  });
});
