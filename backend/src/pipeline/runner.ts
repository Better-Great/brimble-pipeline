import { promisify } from "node:util";
import { execFile } from "node:child_process";

import { getAvailablePort, releasePort } from "./portManager.js";

const execFileAsync = promisify(execFile);
const primaryInternalPort = Number(process.env.CONTAINER_INTERNAL_PORT_PRIMARY || 3000);
const fallbackInternalPort = Number(process.env.CONTAINER_INTERNAL_PORT_FALLBACK || 8080);

function containerNameFromDeploymentId(deploymentId: string): string {
  return `deploy-${deploymentId.toLowerCase().replace(/[^a-z0-9-]/g, "")}`;
}

async function runDocker(imageTag: string, deploymentId: string, internalPort: number) {
  const port = await getFreePort();
  const containerName = containerNameFromDeploymentId(deploymentId);
  const dockerNetwork = await resolveDockerNetwork();
  try {
    const { stdout } = await execFileAsync("docker", [
      "run",
      "-d",
      "--name",
      containerName,
      "--network",
      dockerNetwork,
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

async function resolveDockerNetwork(): Promise<string> {
  const explicit = process.env.DOCKER_NETWORK;
  if (explicit && explicit.trim().length > 0) {
    return explicit.trim();
  }

  const { stdout } = await execFileAsync("docker", ["network", "ls", "--format", "{{.Name}}"]);
  const names = stdout
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (names.includes("brimble-net")) {
    return "brimble-net";
  }

  const suffixed = names.find((name) => name.endsWith("_brimble-net"));
  if (suffixed) {
    return suffixed;
  }

  throw new Error(
    "Could not determine docker network for deployments. Set DOCKER_NETWORK explicitly.",
  );
}

export async function runContainer(
  deploymentId: string,
  imageTag: string,
): Promise<{ containerId: string; port: number }> {
  const containerName = containerNameFromDeploymentId(deploymentId);
  await stopContainer(containerName);
  try {
    return await runDocker(imageTag, deploymentId, primaryInternalPort);
  } catch {
    await stopContainer(containerName);
    return runDocker(imageTag, deploymentId, fallbackInternalPort);
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
