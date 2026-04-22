import "dotenv/config";

import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";

import { runMigrations } from "./db/migrate.js";
import { logEmitter } from "./pipeline/logStore.js";
import routes from "./routes/index.js";

async function buildServer() {
  const fastify = Fastify({ logger: true });

  await fastify.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "DELETE"],
  });
  await fastify.register(multipart);
  fastify.get("/health", async () => ({ status: "ok", timestamp: new Date() }));
  await fastify.register(routes, { prefix: "/api" });

  return fastify;
}

async function start() {
  void logEmitter;
  const port = Number(process.env.PORT || 3000);
  await runMigrations();

  const fastify = await buildServer();
  await fastify.listen({
    host: "0.0.0.0",
    port,
  });
}

void start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
