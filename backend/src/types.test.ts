import { describe, expect, it } from "vitest";

import { DeploymentStatus } from "./types.js";

describe("DeploymentStatus", () => {
  it("contains the expected lifecycle values", () => {
    expect(DeploymentStatus.Pending).toBe("pending");
    expect(DeploymentStatus.Building).toBe("building");
    expect(DeploymentStatus.Deploying).toBe("deploying");
    expect(DeploymentStatus.Running).toBe("running");
    expect(DeploymentStatus.Failed).toBe("failed");
  });
});
