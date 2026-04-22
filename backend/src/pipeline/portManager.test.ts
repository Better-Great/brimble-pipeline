import { afterEach, describe, expect, it } from "vitest";

import { getAvailablePort, releasePort } from "./portManager.js";

describe("portManager", () => {
  const reserved: number[] = [];

  afterEach(() => {
    for (const port of reserved) {
      releasePort(port);
    }
    reserved.length = 0;
  });

  it("returns a port in the expected range", async () => {
    const port = await getAvailablePort();
    reserved.push(port);
    expect(port).toBeGreaterThanOrEqual(4000);
    expect(port).toBeLessThanOrEqual(5000);
  });

  it("does not return a released port as permanently reserved", async () => {
    const port = await getAvailablePort();
    releasePort(port);

    const second = await getAvailablePort();
    reserved.push(second);
    expect(second).toBeGreaterThanOrEqual(4000);
  });
});
