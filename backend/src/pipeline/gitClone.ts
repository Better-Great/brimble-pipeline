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
  let writeChain = Promise.resolve();

  const handleLine = async (content: string) => {
    lineNumber += 1;
    await appendLog(deploymentId, content);
    logEmitter.emit(deploymentId, { line: lineNumber, content });
    outputLines.push(content);
  };

  const stdoutRl = createInterface({ input: child.stdout });
  const stderrRl = createInterface({ input: child.stderr });

  stdoutRl.on("line", (line) => {
    writeChain = writeChain.then(() => handleLine(line));
  });
  stderrRl.on("line", (line) => {
    writeChain = writeChain.then(() => handleLine(line));
  });

  const cloneTimeoutMs = Number(process.env.GIT_CLONE_TIMEOUT_MS || 2 * 60_000);
  const timeout = setTimeout(() => {
    child.kill("SIGTERM");
  }, cloneTimeoutMs);

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => {
      resolve(code ?? 1);
    });
  });
  clearTimeout(timeout);

  await writeChain;

  if (exitCode !== 0) {
    const lastMessage =
      outputLines.length > 0 ? outputLines.slice(-5).join("\n") : "git clone failed.";
    throw new Error(lastMessage);
  }
}
