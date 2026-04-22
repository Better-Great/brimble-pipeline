# brimble-pipeline

## Overview

Brimble Pipeline is a lightweight self-hosted deployment system that turns source code into running containers and exposes each deployment through dynamic routes. It supports Git and ZIP-based sources, stores build/runtime logs in PostgreSQL, and streams those logs to the UI in real time.

The stack is intentionally simple: Fastify for APIs, plain `pg` for persistence, Docker for runtime isolation, Railpack for image builds, Caddy for routing, and a React dashboard for operators.

## Architecture

```text
Browser
  |
  v
Caddy (localhost:80, admin:2019)
  |------------------------> Frontend (Vite preview)
  |
  +------------------------> Backend (Fastify API)
                               |         |
                               |         +--> Docker daemon (/var/run/docker.sock)
                               |
                               +--> Postgres (deployments, logs)
```

## Prerequisites

- Docker
- Docker Compose
- Git

## Running locally

1. `git clone <your-repo-url>`
2. `cd brimble-pipeline`
3. `cp .env.example .env`
4. `docker compose up --build`
5. Open `http://localhost`

## Environment variables

| Variable | Purpose | Example |
| --- | --- | --- |
| `POSTGRES_URL` | Backend DB connection string | `postgresql://postgres:postgres@postgres:5432/brimble` |
| `POSTGRES_DB` | Postgres database name | `brimble` |
| `POSTGRES_USER` | Postgres username | `postgres` |
| `POSTGRES_PASSWORD` | Postgres password | `postgres` |
| `PORT` | Backend listen port | `3000` |
| `RAILPACK_BIN` | Railpack binary path | `/usr/local/bin/railpack` |
| `CADDY_ADMIN_URL` | Caddy admin API base URL | `http://caddy:2019` |
| `API_URL` | Frontend dev API proxy target | `http://backend:3000` |

## How the pipeline works

1. Create deployment from Git URL or ZIP upload.
2. Backend creates a deployment row with `pending` status.
3. Pipeline runner checks out/extracts source in `/tmp/brimble/{deploymentId}`.
4. Railpack builds Docker image `brimble-deploy-{deploymentId}`.
5. Backend runs the image on a free host port (`4000-5000`).
6. Backend appends a Caddy route for `http://localhost/{deploymentId}`.
7. UI subscribes to SSE logs until the deployment emits `done:true`.

## Known limitations / improvements

- Caddy route deletion uses a simple endpoint strategy; production should track route IDs explicitly.
- No authentication/authorization yet.
- In-memory port and log counters reset on backend restart.
- Pipeline retry and cleanup policies are minimal.

## Rough time spent

Approximately 4-6 hours for initial end-to-end scaffold and wiring.
# brimble-pipeline
