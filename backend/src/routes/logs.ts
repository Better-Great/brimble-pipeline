import type { FastifyPluginAsync } from "fastify";

import { getLogsForDeployment, logEmitter } from "../pipeline/logStore.js";

const logsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string } }>("/deployments/:id/logs", async (request, reply) => {
    const deploymentId = request.params.id;

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
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

    let closed = false;
    const cleanup = () => {
      if (closed) {
        return;
      }
      closed = true;
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
