import { describe, expect, it, vi } from "vitest";

const runPipelineMock = vi.fn();

vi.mock("./orchestrator.js", () => ({
  runPipeline: runPipelineMock,
}));

describe("triggerDeploymentPipeline", () => {
  it("forwards deployment ID to orchestrator", async () => {
    const { triggerDeploymentPipeline } = await import("./trigger.js");

    await triggerDeploymentPipeline("dep-42");

    expect(runPipelineMock).toHaveBeenCalledWith("dep-42");
  });
});
