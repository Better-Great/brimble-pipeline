import type { FastifyPluginAsync } from "fastify";

import { query } from "../db/client.js";
import { getLogsForDeployment, logEmitter } from "../pipeline/logStore.js";

const logsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string } }>("/deployments/:id/logs", async (request, reply) => {
    const deploymentId = request.params.id;

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    reply.raw.flushHeaders();

    const writeEvent = (payload: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const existingLogs = await getLogsForDeployment(deploymentId);
    for (const row of existingLogs) {
      writeEvent({
        line: row.line_number,
        content: row.content,
        deploymentId,
      });
    }

    const deploymentState = await query<{ status: string }>(
      "SELECT status FROM deployments WHERE id = $1",
      [deploymentId],
    );
    const currentStatus = deploymentState.rows[0]?.status;
    if (currentStatus === "running" || currentStatus === "failed") {
      writeEvent({ done: true });
      reply.raw.end();
      return reply;
    }

    const heartbeat = setInterval(() => {
      if (!reply.raw.writableEnded) {
        reply.raw.write(": ping\n\n");
      }
    }, 15_000);

    let closed = false;
    const cleanup = () => {
      if (closed) {
        return;
      }
      closed = true;
      clearInterval(heartbeat);
      logEmitter.off(deploymentId, onLog);
      logEmitter.off(`done:${deploymentId}`, onDone);
      if (!reply.raw.writableEnded) {
        reply.raw.end();
      }
    };

    const onLog = (event: { line: number; content: string }) => {
      writeEvent({
        line: event.line,
        content: event.content,
        deploymentId,
      });
    };

    const onDone = () => {
      writeEvent({ done: true });
      cleanup();
    };

    logEmitter.on(deploymentId, onLog);
    logEmitter.on(`done:${deploymentId}`, onDone);

    request.raw.on("close", cleanup);
    return reply;
  });
};

export default logsRoutes;
