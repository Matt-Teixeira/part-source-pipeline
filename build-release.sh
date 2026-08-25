#!/usr/bin/env bash
# Release part-source-pipeline: mirror THIS working tree to
# /opt/apps/part-source-pipeline, apply the #RELEASE: .env overrides, stamp the
# released commit, build as svc. Fleet paradigm — adapted from monday's
# build-release.sh (docs/migration_CLAUDE.md Part 1: "Clean-tree guard",
# "Release provenance").
#
# Flow:
#   1. Clean-tree guard      — refuse to release a dirty tree (untracked counts)
#   2. Mirror via tar-pipe   — working tree -> $DEST, with excludes
#   3. Transform .env        — apply #RELEASE:KEY=VALUE, strip markers
#   4. Stamp RELEASE_SHA     — into the DEPLOYED .env only (idempotent)
#   5. chown + build as svc  — image becomes psp:svc
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
RELEASE_USER="svc"
ALLOW_DIRTY="${ALLOW_DIRTY:-0}"

for arg in "$@"; do
    case "$arg" in
        --allow-dirty) ALLOW_DIRTY=1 ;;
        *) echo "ERROR: unknown argument '$arg' (only --allow-dirty is accepted)"; exit 1 ;;
    esac
done

# --- 1. Clean-tree guard (BEFORE anything touches $DEST) ---------------------
# The tar-pipe mirrors the WORKING TREE, not a git ref. A dirty release would
# put code in /opt/apps that exists in no commit: unreproducible, untraceable,
# nothing to roll back to. Untracked files count — tar would copy them.
GIT_SHA="unknown"
if git -C "$SRC" rev-parse --git-dir >/dev/null 2>&1; then
    GIT_SHA="$(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo unknown)"
    GIT_BRANCH="$(git -C "$SRC" rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"

    if [ -n "$(git -C "$SRC" status --porcelain)" ]; then
        if [ "$ALLOW_DIRTY" = "1" ]; then
            echo "WARNING: working tree is dirty, releasing anyway (--allow-dirty)."
        else
            echo "ERROR: working tree is dirty — refusing to release."
            git -C "$SRC" status --short
            exit 1
        fi
    fi

    if git -C "$SRC" rev-parse --abbrev-ref '@{upstream}' >/dev/null 2>&1; then
        AHEAD="$(git -C "$SRC" rev-list --count '@{upstream}..HEAD' 2>/dev/null || echo 0)"
        [ "$AHEAD" -gt 0 ] && echo "WARNING: $AHEAD commit(s) on '$GIT_BRANCH' not pushed to upstream."
    else
        echo "WARNING: branch '$GIT_BRANCH' has no upstream — this release exists only on this host."
    fi
else
    echo "WARNING: $SRC is not a git repository — cannot verify what is being released."
fi

# --- Destination -------------------------------------------------------------
# Hardcoded on purpose, NOT derived from APP_NAME: this app's APP_NAME is
# part_source_pipeline (underscore, the logger's container path) while the
# release dir follows the repo name (hyphen). Deriving from APP_NAME (the
# monday pattern) would release to the wrong directory here.
DEST="/opt/apps/part-source-pipeline"
if [ "$DEST" = "$SRC" ]; then
    echo "ERROR: SRC and DEST are the same directory — run this from a dev tree, not the release copy."
    exit 1
fi

echo "==> releasing part-source-pipeline  commit: $GIT_SHA  ->  $DEST"

# --- 2. Wipe + tar-pipe mirror -----------------------------------------------
# node_modules in $DEST is preserved across releases as build.sh's install
# cache. Excludes cover (a) things that must never ship (git, agent dirs) and
# (b) this repo's gitignored bulk that would pass the clean-tree guard but be
# copied by tar: files/ (inv_feed CSVs), dev run logs under utils/logger/
# (named *-log.*.json — a bare *.json exclude would strip package.json and
# break the release build, so the pattern is deliberately narrow). Verify
# exclude changes by diffing `tar -tf` output, never by eyeballing patterns.
sudo mkdir -p "$DEST"
sudo find "$DEST" -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} +
sudo tar -C "$SRC" \
    --exclude='./node_modules' \
    --exclude='*/node_modules' \
    --exclude='./.git' \
    --exclude='./.claude' \
    --exclude='./.agents' \
    --exclude='./.codex' \
    --exclude='./files' \
    --exclude='*.csv' \
    --exclude='*.log' \
    --exclude='./utils/logger/logs' \
    --exclude='./utils/logger/*-log.*' \
    -cf - . | sudo tar -C "$DEST" -xf -

# inv_feed_sync writes ./files and dies without it; the dir is excluded from
# the mirror above (gitignored CSV bulk), so recreate it deliberately owned.
# entrypoint.sh will not re-chown a deliberately-owned dir, which is the point.
sudo mkdir -p "$DEST/files"
sudo chown "${RELEASE_USER}:docker" "$DEST/files"
sudo chmod 2775 "$DEST/files"

# --- 3. Apply #RELEASE: overrides to the DEPLOYED .env ------------------------
# Two passes over the same file: collect overrides, then rewrite active lines
# and drop the marker lines. Idempotent — after one pass no markers remain.
tmp_env="$(mktemp)"
sudo awk '
    FNR==NR {
        if ($0 ~ /^#RELEASE:/) {
            l = substr($0, 10)
            e = index(l, "=")
            if (e > 0) {
                k = substr(l, 1, e-1)
                v = substr(l, e+1)
                sub(/[ \t]+#.*$/, "", v)
                gsub(/^[ \t]+|[ \t]+$/, "", k)
                gsub(/^[ \t]+|[ \t]+$/, "", v)
                ov[k] = v
            }
        }
        next
    }
    {
        if ($0 ~ /^#RELEASE:/) next
        if ($0 ~ /^[A-Za-z_][A-Za-z0-9_]*=/) {
            e = index($0, "=")
            k = substr($0, 1, e-1)
            if (k in ov) { print k "=" ov[k]; next }
        }
        print
    }
' "$DEST/.env" "$DEST/.env" > "$tmp_env"
sudo cp "$tmp_env" "$DEST/.env"
rm -f "$tmp_env"

# --- 4. Stamp RELEASE_SHA (idempotent: delete then append) --------------------
# index.js reads this into the boot note, so every util.app_run_logs row and
# every run-log file identifies the commit that produced it. Never set it by
# hand; a dev tree has no key and records 'dev-tree' instead.
sudo sed -i '/^# Injected by build-release.sh/d; /^RELEASE_SHA=/d' "$DEST/.env"
printf '\n# Injected by build-release.sh — do not edit by hand.\nRELEASE_SHA=%s\n' \
    "$GIT_SHA" | sudo tee -a "$DEST/.env" >/dev/null

# --- 5. Ownership + build as svc ----------------------------------------------
sudo chown -R "${RELEASE_USER}:docker" "$DEST"
# svc owns it; docker-group members (the admins on this box) can read it for
# preflight/debugging. The .env holds live credentials — no wider access.
sudo chmod 640 "$DEST/.env" || true

# svc has no host home (/nonexistent). The docker CLI tolerates that for
# simple commands, but BuildKit mkdirs $HOME/.docker and dies (verified on the
# pilot's first release: "mkdir /nonexistent: permission denied"). NEVER
# HOME=/tmp (/tmp/.docker svc:700 breaks docker for other users) — use the
# private persistent dir the pilot established.
SVC_HOME="/opt/apps/.svc-home"
sudo mkdir -p "$SVC_HOME"
sudo chown "$RELEASE_USER":docker "$SVC_HOME"
sudo chmod 700 "$SVC_HOME"
sudo -u "$RELEASE_USER" env HOME="$SVC_HOME" bash -c "cd '$DEST' && ./build.sh"

sudo chown -R "${RELEASE_USER}:docker" "$DEST"

echo "==> release complete: $DEST  commit: $GIT_SHA  image: psp:svc"
echo "    verify: grep '^RELEASE_SHA=' $DEST/.env ; (cd $DEST && bash preflight-check.sh)"
