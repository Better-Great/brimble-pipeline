import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

import { appendLog, logEmitter } from "./logStore.js";

function sanitizeDeploymentId(deploymentId: string): string {
  return deploymentId.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

export async function buildImage(deploymentId: string, sourcePath: string): Promise<string> {
  const safeDeploymentId = sanitizeDeploymentId(deploymentId);
  const imageTag = `brimble-deploy-${safeDeploymentId}`;
  const railpackBin = process.env.RAILPACK_BIN || "railpack";

  const child = spawn(railpackBin, ["build", sourcePath, "--tag", imageTag], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let lineNumber = 0;
  const lastLines: string[] = [];

  const handleLine = async (content: string) => {
    lineNumber += 1;
    await appendLog(deploymentId, content);
    logEmitter.emit(deploymentId, { line: lineNumber, content });

    lastLines.push(content);
    if (lastLines.length > 5) {
      lastLines.shift();
    }
  };

  const stdoutRl = createInterface({ input: child.stdout });
  const stderrRl = createInterface({ input: child.stderr });

  const streamPromises: Promise<void>[] = [];

  stdoutRl.on("line", (line) => {
    streamPromises.push(handleLine(line));
  });
  stderrRl.on("line", (line) => {
    streamPromises.push(handleLine(line));
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      resolve(code ?? 1);
    });
  });

  await Promise.all(streamPromises);

  if (exitCode === 0) {
    return imageTag;
  }

  const message = lastLines.length > 0 ? lastLines.join("\n") : "Railpack build failed.";
  throw new Error(message);
}
