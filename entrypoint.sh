#!/bin/bash
set -e

# Default to svc if RUN_USER not specified
RUN_USER="${RUN_USER:-svc}"

# Dynamically set HOME based on user
export HOME="/home/$RUN_USER"

# Repair writable directories while still root, BEFORE gosu drops privileges.
# This app's on-disk writers are:
#   /workspace/files                    -- inv_feed_sync CSV output (gitignored,
#                                          so a fresh clone has no such dir)
#   /opt/run-logs/part_source_pipeline  -- the vendored logger's run-log JSON
#                                          (bind-mounted; host side is LOG_DIR)
# Docker creates a missing bind-mount source as root:root, and the app dies
# inside createWriteStream/writeFileSync -- before any logging exists to say
# why. Only a root-owned directory is repaired: one somebody deliberately
# chowned (e.g. /opt/run-logs/part-source-pipeline as svc:docker) is left alone.
for dir in /workspace/files /opt/run-logs/part_source_pipeline; do
    mkdir -p "$dir"
    if [ "$(stat -c %u "$dir")" = "0" ]; then
        echo "entrypoint: $dir is root-owned (Docker created it) — chowning to $RUN_USER:docker"
        chown "$RUN_USER":docker "$dir" || true
        chmod 2775 "$dir" || true
    fi
done

# Execute command as the specified user
exec gosu "$RUN_USER" "$@"
