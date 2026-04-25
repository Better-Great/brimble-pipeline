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
