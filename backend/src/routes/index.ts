import type { FastifyPluginAsync } from "fastify";

import deploymentsRoutes from "./deployments.js";
import logsRoutes from "./logs.js";

const apiRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(deploymentsRoutes);
  await fastify.register(logsRoutes);
};

export default apiRoutes;
