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
  |------------------------> Frontend (Node `serve` of Vite `dist/`)
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
- Node.js **20.19+** (or **22.12+**) for local frontend tooling (Vite 8); see `.nvmrc`

### Docker socket permissions (Linux)

The backend runs **as a non-root user** and talks to Docker via `/var/run/docker.sock`.

Set `DOCKER_SOCK_GID` in `.env` to the **group id** of the host socket:

```bash
stat -c '%g' /var/run/docker.sock
```

## Running locally

1. `git clone <your-repo-url>`
2. `cd brimble-pipeline`
3. `cp .env.example .env` (required: `docker-compose.yml` reads values from `.env` for interpolation)
4. `docker compose up --build`
5. Open `http://localhost:${CADDY_HTTP_PORT}` (defaults to `http://localhost` when `CADDY_HTTP_PORT=80`)

## Health checks (for orchestration / sidecars)

- **Inside Docker network**: `GET http://backend:${PORT}/health` (Compose DNS service name `backend`, port from `PORT` in `.env`)
- **Through Caddy (public)**: `GET http://localhost:${CADDY_HTTP_PORT}/health` (when `CADDY_HTTP_PORT=80`, this is `http://localhost/health`)

## Local development (without Docker)

This is optional; reviewers will primarily use Docker Compose.

- **Backend**: `cd backend && npm install && npm run dev` (requires `POSTGRES_URL` pointing at a reachable Postgres)
- **Frontend**: `cd frontend && npm install && npm run dev` (`vite` reads env from the repo root `.env` and requires `API_URL` for the `/api` proxy target)

## Automated tests

- **Backend**: `cd backend && npm run test` (coverage: `npm run test:coverage`)
- **Frontend**: `cd frontend && npm run test` (coverage: `npm run test:coverage`)

## Environment variables

| Variable | Purpose | Example |
| --- | --- | --- |
| `POSTGRES_URL` | Backend DB connection string | `postgresql://postgres:postgres@postgres:5432/brimble` |
| `POSTGRES_DB` | Postgres database name | `brimble` |
| `POSTGRES_USER` | Postgres username | `postgres` |
| `POSTGRES_PASSWORD` | Postgres password | `postgres` |
| `PORT` | Backend listen port | `3000` |
| `RAILPACK_BIN` | Railpack binary path | `/usr/local/bin/railpack` |
| `RAILPACK_VERSION` | Railpack release tag used when building the backend image | `v0.23.0` |
| `CADDY_ADMIN_URL` | Caddy admin API base URL | `http://caddy:2019` |
| `API_URL` | Used for `vite dev` proxying + passed as a Docker build-arg for `vite build` | `http://backend:3000` |
| `CADDY_HTTP_PORT` | Host port published to Caddy `:80` | `80` |
| `CADDY_ADMIN_PORT` | Host port published to Caddy admin `:2019` | `2019` |
| `CADDY_SITE_ADDRESS` | Caddy site address (Caddyfile) | `:80` |
| `CADDY_ADMIN_LISTEN_ADDR` | Caddy admin listen address (Caddyfile) | `0.0.0.0:2019` |
| `CADDY_BACKEND_UPSTREAM` | Upstream for `/api/*` + `/health*` | `backend:3000` |
| `CADDY_FRONTEND_UPSTREAM` | Upstream for the UI | `frontend:5173` |
| `DOCKER_SOCK_GID` | Host `/var/run/docker.sock` group id (Linux) | output of `stat -c '%g' /var/run/docker.sock` |
| `APP_UID` | Runtime user uid inside backend image | `10001` |
| `APP_GID` | Runtime user gid inside backend image | `10001` |
| `FRONTEND_APP_UID` | Runtime user uid inside frontend image | `10002` |
| `FRONTEND_APP_GID` | Runtime user gid inside frontend image | `10002` |

## How the pipeline works

1. Create deployment from Git URL or ZIP upload.
2. Backend creates a deployment row with `pending` status.
3. Pipeline runner checks out/extracts source in `/tmp/brimble/{deploymentId}`.
4. Railpack builds Docker image `brimble-deploy-{deploymentId}`.
5. Backend runs the image on a free host port (`4000-5000`).
6. Backend appends a Caddy route for `http://localhost/{deploymentId}`.
7. UI subscribes to SSE logs until the deployment emits `done:true`.

## Known limitations / improvements

- Caddy route deletion finds routes by path match and deletes by array index; production should persist stable route IDs from Caddy responses.
- No authentication/authorization yet.
- In-memory port and log counters reset on backend restart.
- Pipeline retry and cleanup policies are minimal.

## Rough time spent

Approximately 4-6 hours for initial end-to-end scaffold and wiring.
