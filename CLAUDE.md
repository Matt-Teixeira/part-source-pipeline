# CLAUDE.md

**part-source-pipeline** (`APP_NAME=part_source_pipeline`, image `psp:*`) is a
Node.js run-once job app: each invocation runs one named job and exits.

**Migrated to the fleet dev/release paradigm 2026-08-25** (third app, after
data_acquisition and monday). Conventions live in
`/opt/apps/data_acquisition/docs/migration_CLAUDE.md` Part 1; this file is
app-specific. The editable tree is `~/apps/part-source-pipeline` (branch
`STAGING_docker`); `/opt/apps/part-source-pipeline` is build output produced
ONLY by `build-release.sh` — never edit or commit there.

## Schedule: deliberately DORMANT

**There are no cron entries for this app, on purpose** (owner decision
2026-08-25; the previous schedule was stopped by Matt 2026-08-19, last
`hca_sync` run 17:00 UTC that day). The app is released and verified but not
running. Reviving a job is an owner decision, done by adding hardened entries
to the **shared svc crontab** (`sudo crontab -u svc -e`, cadence section,
absolute paths, `flock -n`, `-T`, direct argv, bounded `.out` file — see the
paradigm doc). Historical cadence if revived: `hca_sync` hourly at :00;
`inv_feed_sync` unknown (no surviving record); `send_csv_sftp` never
scheduled. A run appearing in `util.app_run_logs` with `RELEASE_SHA` =
`dev-tree` means someone ran a dev tree; with a real SHA, someone ran the
release copy by hand — both are fine, neither should be periodic.

| Job (`node index.js <job>`) | What it does | State it touches |
| --- | --- | --- |
| `hca_sync` | Fetches 5 Acumatica OData endpoints (Basic auth, read-only GETs), inserts ONE row per run into `api.hca_odata` | Vendor API (read), staging DB (write) |
| `inv_feed_sync` | Fetches 2 OData inventory feeds, writes `files/Avante_Biomed_Inventory.csv` + `files/Avante_Imaging_Inventory.csv`, uploads both to PartsSource's **production SFTP** (`SKIP_SFTP=1` skips the upload) | Vendor APIs (read), `files/` (write), vendor SFTP (**write**) |
| `send_csv_sftp` | Uploads `files/test.csv` (does not exist) | Test scaffolding — dead |

## The 5-file pattern

`build.sh` (in-tree deps + `psp:${USER_ID}` image), `build-release.sh`
(clean-tree guard, tar mirror to `/opt/apps/part-source-pipeline`, `#RELEASE:`
transform, `RELEASE_SHA` stamp, builds `psp:svc` as svc), `preflight-check.sh`
(zero warnings = clean), `entrypoint.sh` (gosu drop, dir repair),
`docker-compose.yaml`. See `docs/run.md` for the run commands.

## Run record

Every run writes both sinks (since `c0048b6`, audit OPS-03; the first-ever
`util.app_run_logs` rows for this app are the 2026-08-25 migration smoke
runs — `dev-tree` for dev, `68876cb` for the release round-trip):

- `util.app_run_logs` row per run (vendored variant-B logger,
  `utils/logger/log.js`) — what ops-dashboard and incident-engine read.
- Per-run JSON file log (see *Logging* below for paths).
- **`run_outcome/v1` exit-code contract** — terminal `run_outcome` event
  (type INFO on purpose) + honest exit codes: 0 success/skipped, 1 failed
  (fatal reached `on_boot`), 2 partial (tolerated errors OR self-log
  persistence failure), 3 usage (unknown job name). Set via `process.exitCode`,
  never `process.exit()`. ops-dashboard + incident-engine consume this —
  **never regress to exit-0-on-error.** Known gap (documented in `index.js`):
  job layers umbrella-catch, so a totally failed job surfaces as partial/2.

## Logging

`utils/logger/log.js` writes one fixed container path,
`/opt/run-logs/part_source_pipeline/` (= `/opt/run-logs/${APP_NAME}/`,
underscore). The compose mount decides where that lands on the host:
`${LOG_DIR:-./utils/logger/logs}` — dev default in-tree (gitignored), release
`#RELEASE:LOG_DIR=/opt/run-logs/part-source-pipeline` (hyphen host dir /
underscore container path is intentional). A missing `LOG_DIR` fails safe to
the dev path. Filename is `${APP_NAME}-log.${USER_ID}.${run_id}.json`, so a
non-`svc` file in `/opt/run-logs` means someone ran a dev command against the
release copy. `LOGGER='dev'` adds console error stacks + run stats; the file
and DB sinks are unaffected by it. The old `RUN_ENV` path switch is gone.

## Known warts (kept deliberately — do not "fix" without owner sign-off)

- **SFTP credential in git history.** Accepted owner exception 2026-08-18
  (see setup doc SECURITY BASELINE): the vendor cannot rotate it, a
  history-aware scan WILL find it, repo access control is the boundary.
  `.env.example` was scrubbed (SEC-02); the untracked `.env` still carries it.
- **Vendor SFTP is currently unusable** (2026-08-25): PartsSource does not
  have our key on their box. Uploads fail until that is resolved; migration
  smoke runs use the skip-upload switch (added during migration) so
  `inv_feed_sync` can be exercised without sending anything.
- **Commented-out Azure PROD block in `.env`** (`PG_HOST=prod-...azure...`).
  Inactive (keys absent, so the `PGHOST || PG_HOST` fallback in both pools
  cannot fire). Keep commented; never uncomment on this host.
- **`PGUSER=postgres`** — superuser. Per-app role migration is a separate
  tracked fleet effort (3/10 done), not part of this migration.
- **`utils/` is the shared-era museum** (alert-processor/alert-notify/mmb-rpp/
  odd-jobs SQL, `vpn/`, `units/`, `pg-pool copy.js`, `pg-helpers_hhm.js`).
  Only `utils/logger/` and `utils/db/` are live for this app. Cleanup is
  deferred post-cutover per standing decision — needs per-item owner sign-off.
- **`send_csv_sftp`** — dead test job. Dead families stay dead.

## Database

Two pools, both live at require-time (see `index.js` header comment):
`db/pgPool.js` (jobs → `api.hca_odata`) and `utils/db/pg-pool.js` (logger →
`util.app_run_logs`). Both read `PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD`
with `PG_*` fallbacks. `PG_SSLMODE=require` (encrypted, no CA verify —
verify-full is part of the future role migration, not this one).

Rotation: registered in `/opt/resources/scripts/rotate-envs-20260817.sh`
(matches on value = data_acquisition's `PGPASSWORD`; rewrites both
`/opt/apps/part-source-pipeline/.env` and `~/apps/part-source-pipeline/.env`).
Verified in-list and value-matched 2026-08-25.

## Environment variables

See `.env.example` (tracked). App-specific on top of the shared set:
`HCA_URI`, `HCA_TECH`, `HCA_INVOICE`, `HCA_CONTRACT_DETAILS`,
`HCA_SRV_ORDER_DETAILS` (OData endpoints), `INV_FEED`, `INV_FEED_2` (feed
endpoints), `PROD_LOGIN_NAME`/`PROD_LOGIN_PW` (Basic-auth pair for all OData
calls), `SFTP_HOST`/`SFTP_PORT`/`SFTP_USER`/`SFTP_PASS`.
