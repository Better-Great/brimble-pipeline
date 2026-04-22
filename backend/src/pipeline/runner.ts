import { promisify } from "node:util";
import { execFile } from "node:child_process";

import { getAvailablePort, releasePort } from "./portManager.js";

const execFileAsync = promisify(execFile);

function containerNameFromDeploymentId(deploymentId: string): string {
  return `deploy-${deploymentId.toLowerCase().replace(/[^a-z0-9-]/g, "")}`;
}

async function runDocker(imageTag: string, deploymentId: string, internalPort: number) {
  const port = await getFreePort();
  const containerName = containerNameFromDeploymentId(deploymentId);
  try {
    const { stdout } = await execFileAsync("docker", [
      "run",
      "-d",
      "--name",
      containerName,
      "--network",
      "brimble-net",
      "-p",
      `${port}:${internalPort}`,
      imageTag,
    ]);
    const containerId = stdout.trim();
    if (!containerId) {
      releasePort(port);
      throw new Error("docker run did not return a container id.");
    }
    return { containerId, port };
  } catch (error) {
    releasePort(port);
    throw error;
  }
}

export async function runContainer(
  deploymentId: string,
  imageTag: string,
): Promise<{ containerId: string; port: number }> {
  try {
    return await runDocker(imageTag, deploymentId, 3000);
  } catch {
    return runDocker(imageTag, deploymentId, 8080);
  }
}

export async function getFreePort(): Promise<number> {
  return getAvailablePort();
}

export async function stopContainer(containerName: string): Promise<void> {
  try {
    await execFileAsync("docker", ["stop", containerName]);
  } catch {
    // Ignore stop failures (already stopped/not found).
  }
  try {
    await execFileAsync("docker", ["rm", containerName]);
  } catch {
    // Ignore rm failures (already removed/not found).
  }
}

export async function getContainerStatus(
  containerName: string,
): Promise<"running" | "stopped" | "notfound"> {
  try {
    const { stdout } = await execFileAsync("docker", [
      "inspect",
      "--format={{.State.Status}}",
      containerName,
    ]);
    const status = stdout.trim();
    if (status === "running") {
      return "running";
    }
    return "stopped";
  } catch {
    return "notfound";
  }
}

export function releaseContainerPort(port: number): void {
  releasePort(port);
}
