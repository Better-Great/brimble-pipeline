import { spawn } from "node:child_process";
import path from "node:path";
import { createInterface } from "node:readline";

import { appendLog, logEmitter } from "./logStore.js";

function deriveDeploymentId(targetDir: string): string {
  return path.basename(targetDir);
}

export async function cloneRepo(gitUrl: string, targetDir: string): Promise<void> {
  const deploymentId = deriveDeploymentId(targetDir);
  const child = spawn("git", ["clone", "--depth", "1", gitUrl, targetDir], {
    stdio: ["ignore", "pipe", "pipe"],
  });

  let lineNumber = 0;
  const outputLines: string[] = [];
  const streamPromises: Promise<void>[] = [];

  const handleLine = async (content: string) => {
    lineNumber += 1;
    await appendLog(deploymentId, content);
    logEmitter.emit(deploymentId, { line: lineNumber, content });
    outputLines.push(content);
  };

  const stdoutRl = createInterface({ input: child.stdout });
  const stderrRl = createInterface({ input: child.stderr });

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

  if (exitCode !== 0) {
    const lastMessage =
      outputLines.length > 0 ? outputLines.slice(-5).join("\n") : "git clone failed.";
    throw new Error(lastMessage);
  }
}
