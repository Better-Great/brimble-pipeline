import { EventEmitter } from "node:events";

import { query } from "../db/client.js";
import type { Log } from "../types.js";

type LogRow = {
  id: number;
  deployment_id: string | null;
  line_number: number;
  content: string;
  created_at: Date;
};

const deploymentLineCounters = new Map<string, number>();

export const logEmitter = new EventEmitter();

async function getNextLineNumber(deploymentId: string): Promise<number> {
  const existingCounter = deploymentLineCounters.get(deploymentId);
  if (existingCounter !== undefined) {
    const next = existingCounter + 1;
    deploymentLineCounters.set(deploymentId, next);
    return next;
  }

  const result = await query<{ max_line: number | null }>(
    "SELECT MAX(line_number) AS max_line FROM logs WHERE deployment_id = $1",
    [deploymentId],
  );
  const currentMax = result.rows[0]?.max_line ?? 0;
  const next = currentMax + 1;
  deploymentLineCounters.set(deploymentId, next);
  return next;
}

export async function appendLog(deploymentId: string, content: string): Promise<void> {
  const lineNumber = await getNextLineNumber(deploymentId);
  await query(
    `INSERT INTO logs (deployment_id, line_number, content)
     VALUES ($1, $2, $3)`,
    [deploymentId, lineNumber, content],
  );
}

export async function getLogsForDeployment(deploymentId: string): Promise<Log[]> {
  const result = await query<LogRow>(
    `SELECT id, deployment_id, line_number, content, created_at
     FROM logs
     WHERE deployment_id = $1
     ORDER BY line_number ASC`,
    [deploymentId],
  );

  return result.rows;
}
