# Build and run

Deps + image (in-tree node_modules, image tag `psp:${USER_ID}` from `.env`):

```sh
bash build.sh
```

Run a job — dev clone, as yourself:

```sh
RUN_USER=$USER docker compose run --rm app node index.js hca_sync
RUN_USER=$USER SKIP_SFTP=1 docker compose run --rm app node index.js inv_feed_sync
```

Run a job — release copy (`/opt/apps/part-source-pipeline`), `RUN_USER`
omitted so `entrypoint.sh` defaults to `svc`:

```sh
cd /opt/apps/part-source-pipeline && docker compose run --rm app node index.js hca_sync
```

Every dev run is a real run: `hca_sync` inserts into `api.hca_odata` on
staging, `inv_feed_sync` uploads to the vendor SFTP unless `SKIP_SFTP=1`.

The pre-migration flow (`npm ci` into a shared `node_mod_cache` mount, `npm
run <job>` wrappers) is retired — see CLAUDE.md.
