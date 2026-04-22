import { runPipeline } from "./orchestrator.js";

export async function triggerDeploymentPipeline(deploymentId: string): Promise<void> {
  await runPipeline(deploymentId);
}
