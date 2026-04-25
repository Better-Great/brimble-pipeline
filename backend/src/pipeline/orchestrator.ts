import { createReadStream } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import unzipper from "unzipper";

import { query, updateDeployment } from "../db/client.js";
import { buildImage } from "./builder.js";
import { addRoute, removeRoute } from "./caddy.js";
import { cloneRepo } from "./gitClone.js";
import { appendLog, logEmitter } from "./logStore.js";
import { releaseContainerPort, runContainer, stopContainer } from "./runner.js";

type DeploymentRow = {
  id: string;
  source_type: "git" | "upload" | null;
  source_url: string | null;
};

async function extractUploadZip(deploymentId: string, workDir: string): Promise<void> {
  const zipPath = `/tmp/uploads/${deploymentId}/upload.zip`;
  await createReadStream(zipPath).pipe(unzipper.Extract({ path: workDir })).promise();
}

export async function runPipeline(deploymentId: string): Promise<void> {
  const workDir = path.join("/tmp/brimble", deploymentId);
  let url: string | undefined;
  let containerName: string | undefined;
  let containerPort: number | undefined;
  try {
    console.log(`Starting pipeline for ${deploymentId}`);
    const deploymentResult = await query<DeploymentRow>(
      "SELECT id, source_type, source_url FROM deployments WHERE id = $1",
      [deploymentId],
    );
    if (deploymentResult.rowCount === 0) {
      throw new Error("Deployment not found.");
    }
    const deployment = deploymentResult.rows[0];

    await mkdir(workDir, { recursive: true });

    await updateDeployment(deploymentId, { status: "building" });
    if (deployment.source_type === "git") {
      if (!deployment.source_url) {
        throw new Error("Missing source_url for git deployment.");
      }
      console.log("Cloning repo...");
      await cloneRepo(deployment.source_url, workDir);
    } else if (deployment.source_type === "upload") {
      console.log("Extracting zip...");
      await extractUploadZip(deploymentId, workDir);
    } else {
      throw new Error("Unsupported source type.");
    }

    console.log("Building image with Railpack...");
    const imageTag = await buildImage(deploymentId, workDir);
    console.log(`Image built: ${imageTag}`);

    await updateDeployment(deploymentId, { status: "deploying", image_tag: imageTag });

    console.log("Starting container...");
    const { containerId, port } = await runContainer(deploymentId, imageTag);
    containerName = `deploy-${deploymentId.toLowerCase().replace(/[^a-z0-9-]/g, "")}`;
    containerPort = port;
    console.log(`Container running on port ${port}`);
    await updateDeployment(deploymentId, { container_id: containerId, container_port: port });

    console.log("Configuring Caddy route...");
    url = await addRoute(deploymentId, port);
    await updateDeployment(deploymentId, { status: "running", url });
    console.log(`Deployment complete: ${url}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown pipeline error";
    if (url) {
      try {
        await removeRoute(deploymentId);
      } catch {
        // Best-effort route cleanup.
      }
    }
    if (containerName) {
      try {
        await stopContainer(containerName);
      } catch {
        // Best-effort container cleanup.
      }
    }
    if (containerPort) {
      releaseContainerPort(containerPort);
    }
    await updateDeployment(deploymentId, { status: "failed", error_message: message });
    await appendLog(deploymentId, `[Pipeline failed]: ${message}`);
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true });
    logEmitter.emit(`done:${deploymentId}`, { done: true });
  }
}
