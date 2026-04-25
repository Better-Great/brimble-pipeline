# Why this approach

This project is intentionally optimized for Brimble's hard requirements first, then hardened to a senior fullstack/devops baseline.

## 1) End-to-end first

The system is composed as a single stack (`caddy`, `backend`, `frontend`, `postgres`, `buildkit`) so evaluators can run one command and get a working pipeline.

Key choices:

- Caddy is the single ingress for UI, API, and dynamic deployment routes.
- Backend owns orchestration and state transitions.
- Postgres persists deployments and log history.
- Railpack handles app image creation.

## 2) Reliability before polish

Critical reliability improvements were prioritized:

- deterministic DB bootstrap (`docker-entrypoint-initdb.d` + idempotent runtime migrations)
- readiness checks (`/ready`) so dependencies wait for real DB availability
- timeout guards for clone/build processes
- cleanup on pipeline failures (workdir/container/route)
- dynamic docker network resolution (portable across compose project names)

## 3) Security posture practical for this assignment

- backend/frontend containers run app processes as non-root users
- no secrets committed; `.env` remains untracked
- runtime docker-socket access is explicitly documented and isolated to backend responsibilities

## 4) Developer and reviewer ergonomics

- tests for meaningful backend/frontend behavior
- explicit verification runbook in README
- compose supports both local builds and prebuilt image pulls

This keeps submission review simple while still showing production-oriented thinking.
