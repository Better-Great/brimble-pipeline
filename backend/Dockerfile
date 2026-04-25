FROM node:22-bookworm-slim AS build

ARG RAILPACK_VERSION=v0.23.0

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl tar \
  && rm -rf /var/lib/apt/lists/* \
  && npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000

COPY package.json package-lock.json* tsconfig.json ./
RUN npm ci

RUN set -eux; \
  arch="$(uname -m)"; \
  case "$arch" in \
    x86_64) railpack_arch="x86_64-unknown-linux-musl" ;; \
    aarch64|arm64) railpack_arch="arm64-unknown-linux-musl" ;; \
    *) echo "unsupported arch: $arch" >&2; exit 1 ;; \
  esac; \
  tarball="railpack-${RAILPACK_VERSION}-${railpack_arch}.tar.gz"; \
  url="https://github.com/railwayapp/railpack/releases/download/${RAILPACK_VERSION}/${tarball}"; \
  tmp="/tmp/${tarball}"; \
  curl -fsSL -o "$tmp" "$url"; \
  mkdir -p /tmp/railpack-extract; \
  tar -xzf "$tmp" -C /tmp/railpack-extract; \
  bin="$(find /tmp/railpack-extract -type f -name railpack | head -n 1)"; \
  test -n "$bin"; \
  install -m 0755 "$bin" /usr/local/bin/railpack; \
  rm -rf /tmp/railpack-extract "$tmp"

COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ARG APP_UID=10001
ARG APP_GID=10001
ARG DOCKER_SOCK_GID=0

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl docker.io dumb-init git gosu \
  && rm -rf /var/lib/apt/lists/* \
  && npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000

COPY --from=build /usr/local/bin/railpack /usr/local/bin/railpack

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY src/db/migrations ./dist/db/migrations
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN groupadd -g "${APP_GID}" brimble \
  && useradd -r -u "${APP_UID}" -g brimble -m -d /home/brimble brimble \
  && if [ "${DOCKER_SOCK_GID}" -ne 0 ]; then \
    groupadd -g "${DOCKER_SOCK_GID}" dockersock; \
    usermod -aG dockersock brimble; \
  fi \
  && mkdir -p /tmp/brimble /tmp/uploads \
  && chown -R brimble:brimble /app /tmp/brimble /tmp/uploads \
  && chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
