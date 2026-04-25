import { mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { v4 as uuidv4 } from "uuid";

import { query } from "../db/client.js";
import { removeRoute } from "../pipeline/caddy.js";
import { releaseContainerPort, stopContainer } from "../pipeline/runner.js";
import { triggerDeploymentPipeline } from "../pipeline/trigger.js";

type CreateDeploymentBody = {
  name?: string;
  sourceType?: "git" | "upload";
  sourceUrl?: string;
};

type DeploymentRow = {
  id: string;
  name: string;
  status: string;
  source_type: "git" | "upload" | null;
  source_url: string | null;
  image_tag: string | null;
  container_id: string | null;
  container_port: number | null;
  url: string | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
};

function isLikelyGitUrl(value: string): boolean {
  return /^(https?:\/\/|git@|ssh:\/\/)/i.test(value);
}

async function parseCreatePayload(request: FastifyRequest) {
  const deploymentId = uuidv4();
  let name: string | undefined;
  let sourceType: "git" | "upload" | undefined;
  let sourceUrl: string | undefined;

  if (request.isMultipart()) {
    const uploadDir = path.join("/tmp/uploads", deploymentId);
    await mkdir(uploadDir, { recursive: true });

    let uploadedFile = false;
    let uploadIsZip = false;

    for await (const part of request.parts()) {
      if (part.type === "file") {
        if (part.fieldname !== "file") {
          part.file.resume();
          continue;
        }

        const targetPath = path.join(uploadDir, "upload.zip");
        uploadIsZip = part.mimetype === "application/zip" || (part.filename ?? "").toLowerCase().endsWith(".zip");
        await pipeline(part.file, createWriteStream(targetPath));
        uploadedFile = true;
        continue;
      }

      if (part.fieldname === "name") {
        name = String(part.value);
      } else if (part.fieldname === "sourceType") {
        const value = String(part.value);
        if (value === "git" || value === "upload") {
          sourceType = value;
        }
      } else if (part.fieldname === "sourceUrl") {
        sourceUrl = String(part.value);
      }
    }

    if (!name || !sourceType) {
      return { error: "name and sourceType are required." as const };
    }

    if (sourceType === "upload" && !uploadedFile) {
      return { error: "A zip file upload is required for sourceType=upload." as const };
    }
    if (sourceType === "upload" && !uploadIsZip) {
      return { error: "Only .zip uploads are supported." as const };
    }

    if (sourceType === "git" && !sourceUrl) {
      return { error: "sourceUrl is required for sourceType=git." as const };
    }
    if (sourceType === "git" && sourceUrl && !isLikelyGitUrl(sourceUrl)) {
      return { error: "sourceUrl must be a valid git URL." as const };
    }

    return {
      deploymentId,
      name,
      sourceType,
      sourceUrl: sourceType === "git" ? sourceUrl : null,
    };
  }

  const body = request.body as CreateDeploymentBody | undefined;
  if (!body?.name || !body.sourceType) {
    return { error: "name and sourceType are required." as const };
  }

  if (body.sourceType === "git" && !body.sourceUrl) {
    return { error: "sourceUrl is required for sourceType=git." as const };
  }
  if (body.sourceType === "git" && body.sourceUrl && !isLikelyGitUrl(body.sourceUrl)) {
    return { error: "sourceUrl must be a valid git URL." as const };
  }

  if (body.sourceType === "upload") {
    return { error: "Multipart file upload is required for sourceType=upload." as const };
  }

  return {
    deploymentId,
    name: body.name,
    sourceType: body.sourceType,
    sourceUrl: body.sourceType === "git" ? body.sourceUrl ?? null : null,
  };
}

const deploymentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/deployments", async (request, reply) => {
    const parsed = await parseCreatePayload(request);
    if ("error" in parsed) {
      return reply.status(400).send({ message: parsed.error });
    }

    const result = await query<DeploymentRow>(
      `INSERT INTO deployments (id, name, status, source_type, source_url)
       VALUES ($1, $2, 'pending', $3, $4)
       RETURNING *`,
      [parsed.deploymentId, parsed.name, parsed.sourceType, parsed.sourceUrl],
    );

    const deployment = result.rows[0];

    void triggerDeploymentPipeline(deployment.id).catch((error) => {
      fastify.log.error({ error, deploymentId: deployment.id }, "Failed to trigger pipeline");
    });

    return reply.status(201).send(deployment);
  });

  fastify.get("/deployments", async () => {
    const result = await query<
      Pick<
        DeploymentRow,
        | "id"
        | "name"
        | "status"
        | "image_tag"
        | "url"
        | "error_message"
        | "source_type"
        | "source_url"
        | "created_at"
        | "updated_at"
      >
    >(
      `SELECT id, name, status, image_tag, url, error_message, source_type, source_url, created_at, updated_at
       FROM deployments
       ORDER BY created_at DESC`,
    );

    return result.rows;
  });

  fastify.get<{ Params: { id: string } }>("/deployments/:id", async (request, reply) => {
    const result = await query<DeploymentRow>("SELECT * FROM deployments WHERE id = $1", [
      request.params.id,
    ]);

    if (result.rowCount === 0) {
      return reply.status(404).send({ message: "Deployment not found" });
    }

    return result.rows[0];
  });

  fastify.delete<{ Params: { id: string } }>("/deployments/:id", async (request, reply) => {
    const lookup = await query<Pick<DeploymentRow, "container_id" | "container_port">>(
      "SELECT container_id, container_port FROM deployments WHERE id = $1",
      [request.params.id],
    );

    if (lookup.rowCount === 0) {
      return reply.status(404).send({ message: "Deployment not found" });
    }

    try {
      await removeRoute(request.params.id);
    } catch (error) {
      fastify.log.warn({ error, deploymentId: request.params.id }, "Failed to remove Caddy route");
    }

    const deployment = lookup.rows[0];
    if (deployment.container_id) {
      await stopContainer(deployment.container_id);
    }
    if (deployment.container_port) {
      releaseContainerPort(deployment.container_port);
    }

    await query("DELETE FROM deployments WHERE id = $1", [request.params.id]);
    return reply.status(204).send();
  });
};

export default deploymentsRoutes;
