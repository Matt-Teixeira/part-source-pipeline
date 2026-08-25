#!/usr/bin/env bash
# Preflight for part-source-pipeline — validates the environment the NEXT run
# will actually use. Fleet paradigm (data_acquisition/docs/migration_CLAUDE.md);
# adapted from monday's preflight. A clean run reports ZERO warnings: treat a
# persistent warning as a bug in the check itself, or it trains people to
# ignore output.
#
# Exit codes: 0 = pass (or warnings only), 1 = critical errors found.
set -u
cd "$(dirname "$0")"

ERRORS=0; WARNINGS=0; OKS=0
ok()    { echo "  OK    $*"; OKS=$((OKS+1)); }
warn()  { echo "  WARN  $*"; WARNINGS=$((WARNINGS+1)); }
error() { echo "  ERROR $*"; ERRORS=$((ERRORS+1)); }
info()  { echo "        $*"; }
section(){ echo; echo "== $* =="; }

# Read KEY= from .env, stripping quotes, dotenv-style inline comments and
# trailing whitespace. NEVER source this .env (fleet rule: values with $ or
# spaces must not pass through shell expansion).
env_val() {
    grep "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- \
        | sed -e 's/[[:space:]]\+#.*$//' -e 's/[[:space:]]*$//' \
              -e "s/^['\"]//" -e "s/['\"]$//"
}

# ---------------------------------------------------------------- 1. host dirs
section "Host directories"
# files/ is inv_feed_sync's CSV output dir: gitignored (missing in a fresh
# clone, entrypoint.sh creates it on first docker run) and recreated svc:docker
# by build-release.sh in the release copy.
if [ -d files ] && [ -w files ]; then
    ok "files/ writable ($(stat -c '%U:%G %a' files))"
elif [ -d files ]; then
    error "files/ exists but is not writable by $(id -un) ($(stat -c '%U:%G %a' files)) — inv_feed_sync dies"
else
    warn "files/ missing (entrypoint.sh creates it on first docker run; build-release.sh creates it in a release)"
fi

# The run-log mount source — whatever LOG_DIR points at (dev default if unset),
# NOT a hardcoded path, so this checks the directory the run will actually use.
LOG_DIR_V="$(env_val LOG_DIR)"; LOG_DIR_V="${LOG_DIR_V:-./utils/logger/logs}"
if [ -d "$LOG_DIR_V" ] && [ -w "$LOG_DIR_V" ]; then
    ok "LOG_DIR $LOG_DIR_V writable ($(stat -c '%U:%G %a' "$LOG_DIR_V"))"
elif [ -d "$LOG_DIR_V" ]; then
    error "LOG_DIR $LOG_DIR_V exists but is not writable by $(id -un) ($(stat -c '%U:%G %a' "$LOG_DIR_V"))"
else
    warn "LOG_DIR $LOG_DIR_V missing (entrypoint.sh creates+chowns it on first docker run)"
fi

# ------------------------------------------------------------------- 2. docker
section "Docker"
if docker ps >/dev/null 2>&1; then ok "docker daemon reachable"; else error "docker daemon not reachable as $(id -un)"; fi
if id -nG | grep -qw docker; then ok "$(id -un) is in the docker group"; else error "$(id -un) not in docker group"; fi
if docker compose version >/dev/null 2>&1; then ok "docker compose available"; else error "docker compose not available"; fi

USER_ID_V="$(env_val USER_ID)"
if [ -n "$USER_ID_V" ]; then
    if docker image inspect "psp:${USER_ID_V}" >/dev/null 2>&1; then
        ok "image psp:${USER_ID_V} present"
    else
        error "image psp:${USER_ID_V} missing — run: bash build.sh"
    fi
fi

# ----------------------------------------------------------------- 3. networks
section "Networks"
if docker network inspect pg_net >/dev/null 2>&1; then ok "network pg_net exists"; else error "network pg_net missing"; fi

# --------------------------------------------------------------------- 4. .env
section ".env"
if [ ! -f .env ]; then
    error ".env missing — copy .env.example and fill it in"
else
    REQUIRED="APP_NAME USER_ID LOGGER LOG_DIR
              PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PG_SSLMODE
              PROD_LOGIN_NAME PROD_LOGIN_PW
              HCA_URI HCA_TECH HCA_INVOICE HCA_CONTRACT_DETAILS HCA_SRV_ORDER_DETAILS
              INV_FEED INV_FEED_2
              SFTP_HOST SFTP_PORT SFTP_USER SFTP_PASS
              DOCKER_GID UID_0 UID_1 UID_2"
    for key in $REQUIRED; do
        v="$(env_val "$key")"
        if [ -z "$v" ]; then
            error ".env: $key is empty or missing"
        else
            case "$key" in
                *PW*|*PASSWORD*|*PASS*|*TOKEN*|*SECRET*|HCA_*|INV_FEED*|PROD_LOGIN_NAME) ok ".env: $key set (masked)" ;;
                *) ok ".env: $key=$v" ;;
            esac
        fi
    done

    # The logger builds its container write path from APP_NAME; the compose
    # mount hardcodes the matching container dir. A drifted value writes logs
    # outside the mount, i.e. into the container's ephemeral filesystem.
    APP_NAME_V="$(env_val APP_NAME)"
    if [ -n "$APP_NAME_V" ] && [ "$APP_NAME_V" != "part_source_pipeline" ]; then
        error ".env: APP_NAME='$APP_NAME_V' — must be part_source_pipeline (underscore; the logger's mount path)"
    fi

    # PGHOST empty is worse than missing: both pools fall back PGHOST -> PG_HOST,
    # and this .env keeps a commented-out Azure PROD block someone could
    # uncomment. Compose pins PGHOST for containerized runs; this guards the
    # non-Docker path too.
    if [ -z "$(env_val PGHOST)" ] && [ -n "$(env_val PG_HOST)" ]; then
        error ".env: PGHOST empty while PG_HOST is set — the pools would silently target PG_HOST ($(env_val PG_HOST))"
    fi

    for retired in IMAGE_TAG RUN_USER RUN_ENV; do
        grep -q "^$retired=" .env && warn ".env: retired key $retired still present — remove it (see .env.example)"
    done
fi

# ---------------------------------------------------------------- 5. app files
section "Application files"
for f in index.js package.json Dockerfile entrypoint.sh docker-compose.yaml build.sh build-release.sh; do
    if [ -f "$f" ]; then ok "$f present"; else error "$f missing"; fi
done
for d in api db jobs sql utils/db utils/logger; do
    if [ -d "$d" ]; then ok "$d/ present"; else error "$d/ missing"; fi
done
if [ -e utils/.git ]; then error "utils/.git exists — utils must be app-owned, not a nested repo"; else ok "utils/ is app-owned (no nested .git)"; fi

# --------------------------------------------------------------------- 6. deps
section "Dependencies"
if [ -d node_modules ] && [ -n "$(ls -A node_modules 2>/dev/null)" ]; then
    ok "root node_modules present ($(ls node_modules | wc -l) entries)"
else
    error "root node_modules missing or empty — run: bash build.sh"
fi

# ------------------------------------------------- 7. external services (AUTH)
section "External services (authenticated checks)"

# The Postgres auth test MUST run from a sibling container on pg_net, never
# via `docker exec <pg_container> psql`: pg_hba trusts local and loopback, so
# an exec'd psql succeeds with a deliberately WRONG password (that path hid a
# rotated password for three weeks on a sibling app). This mirrors how the app
# connects (both pools): PG_SSLMODE from .env (require on this host).
PGHOST_V="$(env_val PGHOST)"; PGPORT_V="$(env_val PGPORT)"; PGUSER_V="$(env_val PGUSER)"
PGPASSWORD_V="$(env_val PGPASSWORD)"; PGDATABASE_V="$(env_val PGDATABASE)"
PG_SSLMODE_V="$(env_val PG_SSLMODE)"; PG_SSLMODE_V="${PG_SSLMODE_V:-require}"
if [ -z "$PGPASSWORD_V" ]; then
    error "PGPASSWORD empty in .env — cannot verify PostgreSQL authentication"
elif ! docker image inspect postgres:16 >/dev/null 2>&1; then
    # An unverified check must never look like a passing one.
    warn "postgres:16 image absent — PostgreSQL auth NOT verified"
    info "Fix: docker pull postgres:16   (needed only for this check)"
else
    PG_OUT=$(docker run --rm --network pg_net \
        -e PGPASSWORD="$PGPASSWORD_V" -e PGSSLMODE="$PG_SSLMODE_V" \
        -e PGCONNECT_TIMEOUT=10 \
        postgres:16 \
        psql -h "$PGHOST_V" -p "$PGPORT_V" -U "$PGUSER_V" -d "$PGDATABASE_V" \
             -tAc "SELECT 'ok'" 2>&1)
    if [ "$(echo "$PG_OUT" | tail -1 | tr -d '[:space:]')" = "ok" ]; then
        ok "PostgreSQL auth OK (sibling-container SSL connection as $PGUSER_V)"
    elif echo "$PG_OUT" | grep -qi "password authentication failed\|no password supplied"; then
        error "PostgreSQL rejected PGPASSWORD from .env — likely a rotated credential"
        info "Fix: check the secret with its owner; update BOTH copies' .env (dev clone + release)"
    elif echo "$PG_OUT" | grep -qi "certificate\|SSL"; then
        error "PostgreSQL SSL failure: $(echo "$PG_OUT" | head -2)"
    else
        error "PostgreSQL check failed: $(echo "$PG_OUT" | head -2)"
    fi
fi

# HCA OData: an authenticated read-only GET proves the Basic credential — a
# non-empty PROD_LOGIN_PW proves nothing (the Redis-NOAUTH lesson). All five
# HCA endpoints and both INV feeds share this credential, so one probe covers
# them. $top=1 keeps the response tiny; the credential travels in a header via
# process substitution, never in process args visible to ps.
HCA_URI_V="$(env_val HCA_URI)"
PL_NAME_V="$(env_val PROD_LOGIN_NAME)"; PL_PW_V="$(env_val PROD_LOGIN_PW)"
if [ -z "$HCA_URI_V" ] || [ -z "$PL_NAME_V" ] || [ -z "$PL_PW_V" ]; then
    error "HCA_URI / PROD_LOGIN_NAME / PROD_LOGIN_PW incomplete — cannot verify OData auth"
elif ! command -v curl >/dev/null 2>&1; then
    warn "curl not available — OData auth NOT verified"
else
    case "$HCA_URI_V" in
        *\?*) HCA_PROBE="${HCA_URI_V}&\$top=1" ;;
        *)    HCA_PROBE="${HCA_URI_V}?\$top=1" ;;
    esac
    B64="$(printf '%s:%s' "$PL_NAME_V" "$PL_PW_V" | base64 -w0)"
    # 90s, not 30: Acumatica computes the full inquiry server-side BEFORE
    # applying $top, so even a 1-row probe takes ~40s (measured 2026-08-25).
    HCA_CODE=$(curl -sS --max-time 90 -o /tmp/psp-preflight-hca.$$ -w '%{http_code}' \
        -H "Accept: application/json" \
        -H @<(printf 'Authorization: Basic %s\n' "$B64") \
        "$HCA_PROBE" 2>&1)
    if [ "$HCA_CODE" = "200" ] && grep -q '"value"' /tmp/psp-preflight-hca.$$ 2>/dev/null; then
        ok "HCA OData auth OK (read-only GET, \$top=1; credential shared by all endpoints)"
    elif [ "$HCA_CODE" = "401" ] || [ "$HCA_CODE" = "403" ]; then
        error "HCA OData rejected PROD_LOGIN credentials (HTTP $HCA_CODE)"
    else
        error "HCA OData check failed (HTTP $HCA_CODE): $(head -c 200 /tmp/psp-preflight-hca.$$ 2>/dev/null)"
    fi
    rm -f /tmp/psp-preflight-hca.$$
fi

# SFTP: presence-only by decision (2026-08-25) — the vendor box has no key for
# us right now, so any connect attempt can only fail; and once restored, a
# login probe would touch a production vendor system. The scheduled
# inv_feed_sync (when the owner revives it) exercises the real upload.
info "SFTP: presence-only (SFTP_* checked above); vendor key pending — uploads disabled, use SKIP_SFTP=1"

# ------------------------------------------------------------------ 8. summary
section "Summary"
echo "  $OKS ok, $WARNINGS warnings, $ERRORS errors"
if [ "$ERRORS" -gt 0 ]; then
    echo "  RESULT: FAIL"
    exit 1
fi
[ "$WARNINGS" -gt 0 ] && echo "  RESULT: PASS (with warnings — a clean run should report zero)"
[ "$WARNINGS" -eq 0 ] && echo "  RESULT: PASS"
