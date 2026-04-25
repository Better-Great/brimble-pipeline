# Environment-agnostic image strategy

The goal is to build once, push once, and run on any host with compatible Docker/Compose.

## What was changed

- `backend` and `frontend` now define explicit image refs in Compose:
  - `${BACKEND_IMAGE}`
  - `${FRONTEND_IMAGE}`
- Compose network name is fixed to `brimble-net` for stable runtime behavior.
- Backend deployment runner uses `DOCKER_NETWORK` (defaults to `brimble-net`) so deployment containers join the same network predictably.

## Publish flow (local machine)

```bash
docker login -u <dockerhub-username>
docker compose build backend frontend
docker compose push backend frontend
```

## Consume flow (another machine)

```bash
cp .env.example .env
# optionally set BACKEND_IMAGE / FRONTEND_IMAGE to a specific tag
docker compose pull backend frontend
docker compose up -d
```

## Tagging recommendation

Avoid only `latest` in real usage. Prefer immutable tags:

- `bettergreat/brimble-backend:git-<sha>`
- `bettergreat/brimble-frontend:git-<sha>`

Then set those in `.env`:

```bash
BACKEND_IMAGE=bettergreat/brimble-backend:git-<sha>
FRONTEND_IMAGE=bettergreat/brimble-frontend:git-<sha>
```

This makes deployments reproducible and easier to roll back.

## About Docker credential warning

If you see:

`credentials are stored unencrypted in ~/.docker/config.json`

that means Docker is using plain config auth storage. For stronger local security, configure a credential helper (`pass`, `secretservice`, etc.) per Docker docs.
