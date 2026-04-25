import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";

import { appendLog, logEmitter } from "./logStore.js";

function deriveDeploymentId(targetDir: string): string {
  return path.basename(targetDir);
}

type ParsedGitSource = {
  cloneUrl: string;
  branch?: string;
  subdir?: string;
};

function parseGitSource(input: string): ParsedGitSource {
  const githubTreeMatch = input.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/i,
  );
  if (githubTreeMatch) {
    const [, owner, repo, branch, subdir] = githubTreeMatch;
    return {
      cloneUrl: `https://github.com/${owner}/${repo}.git`,
      branch,
      subdir,
    };
  }
  return { cloneUrl: input };
}

export async function cloneRepo(gitUrl: string, targetDir: string): Promise<string> {
  const deploymentId = deriveDeploymentId(targetDir);
  const parsed = parseGitSource(gitUrl);
  const cloneArgs = ["clone", "--depth", "1"];
  if (parsed.branch) {
    cloneArgs.push("--branch", parsed.branch);
  }
  cloneArgs.push(parsed.cloneUrl, targetDir);

  const child = spawn("git", cloneArgs, {
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

  if (!parsed.subdir) {
    return targetDir;
  }

  const normalizedSubdir = parsed.subdir
    .split("/")
    .filter(Boolean)
    .join("/");
  const sourcePath = path.join(targetDir, normalizedSubdir);
  try {
    await access(sourcePath);
  } catch {
    throw new Error(`Requested subdirectory not found in repository: ${normalizedSubdir}`);
  }

  lineNumber += 1;
  await appendLog(deploymentId, `Using repository subdirectory: ${normalizedSubdir}`);
  logEmitter.emit(deploymentId, {
    line: lineNumber,
    content: `Using repository subdirectory: ${normalizedSubdir}`,
  });
  return sourcePath;
}
