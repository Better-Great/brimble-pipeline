# Trade-offs

This file explains the main trade-offs made in this project and why they were chosen.

## 1) Simple single-stack Compose vs distributed production topology

**Choice:** run `caddy`, `backend`, `frontend`, `postgres`, and `buildkit` in one `docker compose` stack.

**Why:** easiest evaluator experience (`cp .env.example .env` + `docker compose up -d --build`), fewer moving parts, fast iteration.

**Trade-off:** not equivalent to a multi-host, autoscaled production platform.

## 2) Docker socket orchestration vs isolated build/runner service

**Choice:** backend controls deployments through host Docker socket.

**Why:** straightforward implementation for app build/run lifecycle and cleanup.

**Trade-off:** wider host control from backend container; this is acceptable for assignment scope but would be tightened in a multi-tenant production environment.

## 3) Dynamic Caddy route management vs static predeclared routes

**Choice:** backend writes/removes Caddy routes via admin API.

**Why:** supports per-deployment URLs without manual config edits.

**Trade-off:** route state is runtime-managed; production systems may prefer durable route ids/state reconciliation.

## 4) Build with Railpack + BuildKit vs framework-specific Dockerfiles

**Choice:** use Railpack for user app builds.

**Why:** broad support for unknown app repos with less user configuration.

**Trade-off:** less deterministic than hand-tuned Dockerfiles for each app type, and build diagnostics can be noisier.

## 5) Postgres for deployment/log persistence vs in-memory only

**Choice:** persist deployment records and logs in Postgres.

**Why:** keeps history after service restart and supports UI polling/streaming.

**Trade-off:** extra operational component; requires DB bootstrapping and health checks.

## 6) SSE log streaming vs WebSockets

**Choice:** Server-Sent Events for deployment logs.

**Why:** one-way stream is enough, simpler operational model, easy browser support.

**Trade-off:** no bi-directional channel; reconnect handling is required for reliability.

## 7) Compose-first user path vs mixed local process path

**Choice:** primary documented path is Docker Compose.

**Why:** reduces environment drift and improves reproducibility for reviewers.

**Trade-off:** local non-compose dev mode exists but is secondary and may need extra env care.

## 8) Security hardening within scope vs full platform hardening

**Choice:** run app containers as non-root where practical, avoid committed secrets, validate inputs, add failure cleanup.

**Why:** reasonable security baseline for submission.

**Trade-off:** missing enterprise features like authN/authZ, fine-grained runtime isolation policies, secret manager integration, and audit pipelines.
