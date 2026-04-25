#!/bin/sh
set -eu

if [ -S /var/run/docker.sock ]; then
  SOCK_GID="$(stat -c '%g' /var/run/docker.sock || true)"
  if [ -n "${SOCK_GID}" ]; then
    if getent group "${SOCK_GID}" >/dev/null 2>&1; then
      SOCK_GROUP="$(getent group "${SOCK_GID}" | cut -d: -f1)"
    else
      SOCK_GROUP="dockersock"
      groupadd -g "${SOCK_GID}" "${SOCK_GROUP}" >/dev/null 2>&1 || true
    fi
    usermod -aG "${SOCK_GROUP}" brimble >/dev/null 2>&1 || true
  fi
fi

exec gosu brimble "$@"
