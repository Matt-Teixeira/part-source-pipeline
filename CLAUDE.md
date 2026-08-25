# CLAUDE.md

> ## ⚠️ MID-MIGRATION (started 2026-08-25) — read this first
>
> **part-source-pipeline is being migrated to the fleet dev/release paradigm.**
> The spec is `/opt/apps/data_acquisition/docs/migration_CLAUDE.md` (Part 1 =
> conventions, Part 3 = migration checklist — the ONLY checklist; do not create
> a rival one here). Reference implementations: **data_acquisition** (dev clone
> `~/apps/data_acquisition`, pilot 2026-08-24) and **monday** (`~/apps/monday`,
> 2026-08-25 — closer to this app in external-API/output-file shape). Until this
> banner is removed, sections below may describe pre-migration state or the
> target — each is labelled. When this file disagrees with the paradigm docs,
> **the paradigm docs win**.
>
> Migration state right now:
> - `/opt/apps/part-source-pipeline` (this tree) is **frozen** — docs-only
>   commits, no code. It will be wiped and replaced by `build-release.sh`
>   output at cutover. The editable tree will be `~/apps/part-source-pipeline`.
> - **The schedule is deliberately stopped** (by Matt, 2026-08-19; last
>   `hca_sync` run 17:00 UTC that day) **and STAYS stopped after this
>   migration** — owner decision 2026-08-25: do not restart `hca_sync`
>   (historical cadence: hourly at :00), `inv_feed_sync` is "not right now",
>   `send_csv_sftp` was never scheduled. Restarting any of them is an owner
>   decision, made by adding hardened entries to the shared svc crontab.
> - `docs/run.md` describes the pre-migration run flow (npm ci into a shared
>   node_modules cache mount). It is superseded as migration commits land.

**part-source-pipeline** (`APP_NAME=part_source_pipeline`, image `psp:*`) is a
Node.js run-once job app: each invocation runs one named job and exits.

| Job (`node index.js <job>`) | What it does | State it touches |
| --- | --- | --- |
| `hca_sync` | Fetches 5 Acumatica OData endpoints (Basic auth, read-only GETs), inserts ONE row per run into `api.hca_odata` | Vendor API (read), staging DB (write) |
| `inv_feed_sync` | Fetches 2 OData inventory feeds, writes `files/Avante_Biomed_Inventory.csv` + `files/Avante_Imaging_Inventory.csv`, uploads both to PartsSource's **production SFTP** | Vendor APIs (read), `files/` (write), vendor SFTP (**write**) |
| `send_csv_sftp` | Uploads `files/test.csv` (does not exist) | Test scaffolding — dead |

## Run record

Both sinks exist since commit `c0048b6` (2026-08-17, audit OPS-03), but **no
scheduled run ever executed that code** — `util.app_run_logs` has zero
`part_source_pipeline` rows as of 2026-08-25. Once runs happen:

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

## Logging (pre-migration state — target is the `LOG_DIR` pattern)

`utils/logger/log.js` switches on `RUN_ENV`: `dev` → `./utils/logger/`,
anything else → `/opt/run-logs/${APP_NAME}/` (compose bind-maps host
`/opt/run-logs/part-source-pipeline` — hyphen host / underscore container is
intentional). File tag comes from `LOGGER`. Target state: fixed container
path, `${LOG_DIR:-./utils/logger/logs}` mount that fails safe to the dev
path, `#RELEASE:LOG_DIR` override, filename tag from `USER_ID`.

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
