#!/usr/bin/env bash
# Build for part-source-pipeline: deps + image. Fleet paradigm
# (data_acquisition docs/migration_CLAUDE.md Part 1).
#
#   1. npm install at the project root, run inside a throwaway node:lts
#      container as the CALLING host user, so node_modules lands IN-TREE with
#      ownership matching the host (no shared cache dir — each copy owns its
#      deps; the /opt/resources/node_mod_cache mount is retired).
#   2. docker compose build. Build args (DOCKER_GID, UID_0/1/2) are
#      interpolated by compose from .env — host identity lives only there, and
#      the Dockerfile ARGs have no defaults on purpose, so a missing value
#      fails the build instead of baking a wrong uid.
#
# Single keys are read with grep, never by sourcing .env — values containing
# $ or spaces must not pass through shell expansion (monday's $$-in-URI bug).
set -euo pipefail
cd "$(dirname "$0")"

env_val() {
    grep "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- \
        | sed -e 's/[[:space:]]\+#.*$//' -e 's/[[:space:]]*$//' \
              -e "s/^['\"]//" -e "s/['\"]$//"
}

USER_ID="$(env_val USER_ID)"
[ -n "$USER_ID" ] || { echo "ERROR: USER_ID is not set in .env — it drives the image tag psp:\$USER_ID"; exit 1; }

echo "==> npm install (in-tree, as $(id -un))"
docker run --rm \
  -v "$(pwd)":/workspace -w /workspace \
  --user "$(id -u):$(id -g)" \
  -e NPM_CONFIG_CACHE=/tmp/.npm \
  node:lts npm install

echo "==> docker compose build (image psp:${USER_ID})"
docker compose build app

echo "==> done: psp:${USER_ID}"
