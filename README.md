# brimble-pipeline

Self-hosted deployment pipeline: submit a Git URL or ZIP, build with Railpack, run as a container, route through Caddy, and watch logs in the UI.

## Quick start (Docker Compose)

### 1) Clone and configure

```bash
git clone <your-repo-url>
cd brimble-pipeline
cp .env.example .env
```

On Linux, set Docker socket group id in `.env`:

```bash
stat -c '%g' /var/run/docker.sock
```

Put that value in `DOCKER_SOCK_GID`.

### 2) Start everything

```bash
docker compose up -d --build
```

### 3) Open app

- UI: `http://localhost` (or `http://localhost:${CADDY_HTTP_PORT}`)
- Health: `http://localhost/health`
- Ready: `http://localhost/ready`

### 4) Stop everything

```bash
docker compose down
```

Remove data volumes too:

```bash
docker compose down -v
```

## Deploy your first app

1. Open the UI.
2. Enter a deployment name.
3. Choose:
   - `Git URL`, or
   - `Upload ZIP`
4. Click **Deploy**.
5. Open **Show logs** on the deployment card.
6. When status becomes `running`, open the deployment URL from the card.

GitHub subdirectory URLs are supported, for example:

`https://github.com/<owner>/<repo>/tree/<branch>/sample-app`

## Architecture (high-level)

```text
Browser
  -> Caddy (ingress/proxy)
      -> Frontend (React + Vite build served by Node)
      -> Backend (Fastify API + pipeline orchestration)
          -> Postgres (deployments/logs)
          -> Docker daemon (run built apps)
          -> BuildKit + Railpack (image builds)
```

## Compose services

- `caddy`: public ingress for UI, API, health, and deployment routes
- `frontend`: operator dashboard
- `backend`: deployment API and pipeline orchestration
- `postgres`: persistence for deployments and logs
- `buildkit`: builder backend used by Railpack

## Common commands

Start / rebuild:

```bash
docker compose up -d --build
```

View logs:

```bash
docker compose logs -f backend
docker compose logs -f caddy
```

Check service status:

```bash
docker compose ps
```

Run tests:

```bash
cd backend && npm test
cd frontend && npm test
```

## Environment variables

`.env.example` contains only variables used by compose, backend runtime, frontend dev proxy, and Caddy config.

Key ones you may edit first:

- `CADDY_HTTP_PORT`
- `CADDY_ADMIN_PORT`
- `POSTGRES_*`
- `DOCKER_SOCK_GID`
- `DEPLOYMENT_BASE_URL`
- `VITE_DEV_API_URL` (for local `npm run dev`)

## CI/CD

- CI workflow: `.github/workflows/ci.yml`
  - backend tests
  - frontend tests
  - compose validation
  - backend/frontend docker build checks
- CD workflow: `.github/workflows/cd.yml`
  - runs only after CI succeeds
  - logs into DockerHub
  - builds and pushes backend/frontend images

Required GitHub secrets for CD:

- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

## Docker Hub usage

Local publish:

```bash
docker compose build backend frontend
docker compose push backend frontend
```

On another machine:

```bash
cp .env.example .env
docker compose pull backend frontend
docker compose up -d
```

## Troubleshooting

- Deployment stuck/fails:
  - open deployment logs in UI
  - check `docker compose logs -f backend`
- Caddy route issues:
  - check `docker compose logs -f caddy`
- Docker socket permission issues:
  - verify `DOCKER_SOCK_GID` in `.env`
- Fresh DB required:
  - `docker compose down -v` then `docker compose up -d --build`

## Docs

- `docs/approach.md` - implementation approach
- `docs/trade-offs.md` - trade-off decisions and rationale
- `docs/dockerhub-environment-agnostic.md` - image portability strategy
# brimble-pipeline

## Overview

Brimble Pipeline is a lightweight self-hosted deployment system that turns source code into running containers and exposes each deployment through dynamic routes. It supports Git and ZIP-based sources, stores build/runtime logs in PostgreSQL, and streams those logs to the UI in real time.

The stack is intentionally simple: Fastify for APIs, plain `pg` for persistence, Docker for runtime isolation, Railpack for image builds, Caddy for routing, and a React dashboard for operators.

Design rationale and delivery notes live under `docs/`:

- `docs/approach.md`
- `docs/dockerhub-environment-agnostic.md`

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
- Node.js **22.12+** for local tooling (`.nvmrc` is pinned to `22.12.0`)

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

### Postgres schema (Compose)

`docker-compose.yml` mounts `backend/src/db/migrations/` into the container as `/docker-entrypoint-initdb.d`. The official Postgres image executes `*.sql` there in filename order when the `pgdata` volume is **new and empty** (first cluster init). Normal restarts do not re-run those scripts. To apply them again on a clean database, remove the volume (for example `docker compose down -v`, which deletes stored data) and bring the stack back up.

## Health checks (for orchestration / sidecars)

- **Inside Docker network**: `GET http://backend:${PORT}/health` (Compose DNS service name `backend`, port from `PORT` in `.env`)
- **Through Caddy (public)**: `GET http://localhost:${CADDY_HTTP_PORT}/health` (when `CADDY_HTTP_PORT=80`, this is `http://localhost/health`)

## Local development (without Docker)

This is optional; reviewers will primarily use Docker Compose.

- **Backend**: `cd backend && npm install && npm run dev` (requires `POSTGRES_URL` pointing at a reachable Postgres)
- **Frontend**: `cd frontend && npm install && npm run dev` (`vite` reads env from the repo root `.env` and proxies `/api` to `VITE_DEV_API_URL` (default `http://localhost`), falling back to `API_URL` when set)

## Automated tests

- **Backend**: `cd backend && npm run test` (coverage: `npm run test:coverage`)
- **Frontend**: `cd frontend && npm run test` (coverage: `npm run test:coverage`)

## GitHub Actions CI

CI is defined in `.github/workflows/ci.yml` and runs on pushes to `main` plus all pull requests:

- backend test job (`npm ci && npm test`)
- frontend test job (`npm ci && npm test`)
- compose validation job (`docker compose config -q`)
- backend/frontend image build verification (`docker compose build backend frontend`)

## GitHub Actions CD (Docker Hub)

CD is defined in `.github/workflows/cd.yml` and runs on `main`, tags (`v*`), and manual dispatch.

- runs backend/frontend tests + compose validation as a release gate
- logs in to Docker Hub using `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN` secrets
- builds and pushes:
  - `docker.io/<DOCKERHUB_USERNAME>/brimble-backend`
  - `docker.io/<DOCKERHUB_USERNAME>/brimble-frontend`
- tagging strategy:
  - `latest` on default branch
  - `sha-<shortsha>` on each publish
  - `<git-tag>` on tag pushes (for example `v1.2.0`)

## Environment variables

| Variable | Purpose | Example |
| --- | --- | --- |
| `POSTGRES_URL` | Backend DB connection string | `postgresql://postgres:postgres@postgres:5432/brimble` |
| `POSTGRES_DB` | Postgres database name | `brimble` |
| `POSTGRES_USER` | Postgres username | `postgres` |
| `POSTGRES_PASSWORD` | Postgres password | `postgres` |
| `PORT` | Backend listen port | `3000` |
| `CORS_ORIGIN` | Allowed CORS origin(s) for backend API (`*` for demo) | `*` |
| `RAILPACK_BIN` | Railpack binary path | `/usr/local/bin/railpack` |
| `RAILPACK_VERSION` | Railpack release tag used when building the backend image | `v0.23.0` |
| `RAILPACK_BUILD_TIMEOUT_MS` | Railpack build timeout before process termination | `900000` |
| `GIT_CLONE_TIMEOUT_MS` | Git clone timeout before process termination | `120000` |
| `BUILDKIT_HOST` | BuildKit target used by Railpack (Compose-managed daemon) | `docker-container://buildkit` |
| `DOCKER_NETWORK` | Docker network used when running deployed app containers | `brimble-net` |
| `DEPLOYMENT_BASE_URL` | Public base URL used when constructing deployment URLs | `http://localhost` |
| `DEPLOYMENT_PORT_MIN` | Minimum host port for deployed containers | `4000` |
| `DEPLOYMENT_PORT_MAX` | Maximum host port for deployed containers | `5000` |
| `CONTAINER_INTERNAL_PORT_PRIMARY` | First internal app port attempted in deployment containers | `3000` |
| `CONTAINER_INTERNAL_PORT_FALLBACK` | Fallback internal app port attempted if primary fails | `8080` |
| `CADDY_ADMIN_URL` | Caddy admin API base URL | `http://caddy:2019` |
| `CADDY_ADMIN_ORIGIN` | Origin header used for Caddy Admin API requests | `//0.0.0.0:2019` |
| `API_URL` | Used for `vite dev` proxying + passed as a Docker build-arg for `vite build` | `http://backend:3000` |
| `VITE_DEV_API_URL` | Preferred local `vite dev` proxy target for `/api` on host runs | `http://localhost` |
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
   - GitHub subdirectory URLs are supported (for example `https://github.com/<owner>/<repo>/tree/<branch>/sample-app`).
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

## Verification runbook

Use this sequence to validate evaluator expectations from a clean state:

1. `cp .env.example .env`
2. `docker compose down -v`
3. `docker compose up -d --build`
4. `curl http://localhost/health` and `curl http://localhost/ready`
5. `docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\dt'`
6. `cd backend && npm test`
7. `cd frontend && npm test`

This confirms compose startup, Caddy ingress, backend readiness, and DB schema creation.

## Docker Hub workflow (build once, run anywhere)

With Docker Hub login already in place, publish images:

```bash
docker compose build backend frontend
docker compose push backend frontend
```

Then on any host (same repo and `.env` contract), run:

```bash
docker compose pull backend frontend
docker compose up -d
```

Because `backend` and `frontend` now declare both explicit image names (`bettergreat/brimble-backend:latest`, `bettergreat/brimble-frontend:latest`) and `build`, you can either:

- build locally when iterating (`docker compose up --build`), or
- pull prebuilt images for reproducible environment-agnostic runs (`docker compose pull && up -d`).



