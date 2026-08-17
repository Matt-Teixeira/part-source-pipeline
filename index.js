("use strict");
require("dotenv").config();

// #JOBS
const { sync_hca, send_csv_sftp, sync_inv_feed } = require("./jobs");

// DATABASE -- BOTH POOLS ARE ALREADY INSTANTIATED TRANSITIVELY AT REQUIRE TIME
// (utils/db/pg-pool BY THE LOGGER'S require, db/pgPool BY jobs -> sql/qf-provider).
// THEY ARE REQUIRED HERE SO dbInsertLogEvents CAN RUN AND THE finally CAN CLOSE THEM.
const pgp = require("pg-promise")();
const pgPool = require("./utils/db/pg-pool");
const job_db = require("./db/pgPool");

const [
  addLogEvent,
  writeLogEvents,
  dbInsertLogEvents,
  makeAppRunLog
] = require("./utils/logger/log");
const {
  type: { I, W, E },
  tag: { cal, det, cat, seq, qaf }
} = require("./utils/logger/enums");

// FAIL-LOUDLY EXIT-CODE CONTRACT (see DESIGN.md):
//   0 = success or skipped, 1 = failed (fatal error reached on_boot),
//   2 = partial (tolerated errors logged by the jobs) or self-log persistence failure,
//   3 = usage error (unknown job name -> operator must fix the invocation).
const EXIT = { SUCCESS: 0, FAILED: 1, PARTIAL: 2, USAGE: 3 };

// THE ONLY VALID MANUAL INVOCATIONS (argv[2]); ANYTHING ELSE IS A USAGE ERROR.
const JOB_TYPES = ["hca_sync", "send_csv_sftp", "inv_feed_sync"];

const run_job = async (run_log, job_type) => {
  await addLogEvent(I, run_log, "run_job", cal, null, null);
  try {
    switch (job_type) {
      case "hca_sync":
        await sync_hca(run_log);
        break;
      case "send_csv_sftp":
        await send_csv_sftp(run_log);
        break;
      case "inv_feed_sync":
        await sync_inv_feed(run_log);
        break;
      default:
        // UNREACHABLE: on_boot VALIDATES job_type AGAINST JOB_TYPES BEFORE
        // DISPATCH AND THROWS E_UNKNOWN_RUN_GROUP (EXIT 3) ON A MISMATCH.
        break;
    }
  } catch (error) {
    console.log(error);
    await addLogEvent(E, run_log, "run_job", cat, null, error);
  }
};

// DERIVE THE FINAL RUN OUTCOME FROM THE EVENTS THE RUN ACTUALLY RECORDED.
// NOTE (VISIBILITY GAP, SEE NOTES.md): THIS APP'S JOB LAYERS (sync-hca,
// send-csv-sftp, sync-inv-feed AND THEIR API/SFTP HELPERS) CATCH THEIR OWN
// FAILURES AND LOG ERROR EVENTS WITHOUT RETHROWING, SO A COMPLETELY FAILED
// JOB SURFACES AS partial (EXIT 2), NOT failed (EXIT 1), UNTIL THE JOB
// LAYERS PROPAGATE. A FATAL ERROR IS ONE THAT ESCAPED TO on_boot'S CATCH.
const deriveOutcome = (run_log, fatal_error) => {
  const events = run_log.log_events || [];
  const error_events = events.filter((e) => e.type === "ERROR").length;
  const warn_events = events.filter((e) => e.type === "WARN").length;
  const failed_systems = [
    ...new Set(
      events
        .filter((e) => e.type === "ERROR" && e.note)
        .map((e) => e.note.sme || e.note.system_id)
        .filter(Boolean)
    ),
  ];

  let outcome;
  let exit_code;
  if (fatal_error) {
    outcome = "failed";
    exit_code =
      fatal_error.code === "E_UNKNOWN_RUN_GROUP" ? EXIT.USAGE : EXIT.FAILED;
  } else if (error_events > 0) {
    outcome = "partial";
    exit_code = EXIT.PARTIAL;
  } else if (run_log.outcome === "skipped") {
    // JOBS MAY OPT IN: run_log.outcome = "skipped" WHEN THERE WAS NO WORK.
    outcome = "skipped";
    exit_code = EXIT.SUCCESS;
  } else {
    outcome = "success";
    exit_code = EXIT.SUCCESS;
  }

  return {
    outcome: outcome,
    exit_code: exit_code,
    error_events: error_events,
    warn_events: warn_events,
    systems: {
      failed_count: failed_systems.length,
      failed: failed_systems.slice(0, 50),
    },
    fatal: fatal_error
      ? {
          code: fatal_error.code || null,
          message: String(fatal_error.message || fatal_error),
        }
      : null,
    contract: "run_outcome/v1",
  };
};

const on_boot = async () => {
  const run_log = await makeAppRunLog();

  const job_type = process.argv[2];

  // argv IS ADDED SO ops-dashboard CAN LABEL THIS APP'S RUNS FROM
  // verbose_log->0->'note'->'argv'->>2. SAFE HERE (UNLIKE data_acquisition):
  // THIS APP NEVER INSERTED A SINGLE util.app_run_logs ROW BEFORE, SO THERE
  // IS NO EXISTING JOB-GRID SHARDING TO DISTURB.
  let note = {
    job_type,
    argv: process.argv
  };

  await addLogEvent(I, run_log, "on_boot", cal, note, null);

  let fatal_error = null;
  try {
    if (!JOB_TYPES.includes(job_type)) {
      // FAIL LOUDLY: AN UNKNOWN/TYPO'D JOB NAME PREVIOUSLY FELL INTO
      // run_job's default: break -- A SILENT NO-OP THAT EXITED 0 WITH NO
      // AUDIT RECORD ANYWHERE.
      const err = new Error(`Unknown run group: ${JSON.stringify(job_type)}`);
      err.code = "E_UNKNOWN_RUN_GROUP";
      throw err;
    }

    await run_job(run_log, job_type);
  } catch (error) {
    fatal_error = error;
    console.error(error);
    await addLogEvent(E, run_log, "on_boot", cat, null, error);
  } finally {
    // 1) DECIDE THE OUTCOME AND SET THE (HONEST) EXIT CODE. NEVER process.exit():
    //    process.exitCode LETS PENDING I/O FLUSH AND THE LOOP DRAIN NATURALLY.
    const outcome = deriveOutcome(run_log, fatal_error);
    process.exitCode = outcome.exit_code;

    // 2) APPEND TERMINAL run_outcome EVENT (type INFO ON PURPOSE: IT MUST
    //    NEVER LAND IN warn_error_logs -- ops-dashboard DERIVES STATUS AND
    //    incident-engine MATERIALIZES INCIDENTS FROM THAT COLUMN). THIS
    //    APP'S VENDORED LOGGER (VARIANT B) HAS NO addRunSummary; THE
    //    OUTCOME EVENT IS STILL LAST AND CARRIES A VALID dt FOR ended_at.
    await addLogEvent(I, run_log, "run_outcome", det, outcome, null);

    // 3) PERSIST THE SELF-LOG, DB FIRST THEN DISK (DISK CAPTURES ANY DB-INSERT
    //    ERROR EVENT). THE DB INSERT IS NEW FOR THIS APP: IT IMPORTED
    //    dbInsertLogEvents BUT NEVER CALLED IT, SO EVERY PRIOR RUN --
    //    INCLUDING FAILED ONES -- WAS INVISIBLE TO ops-dashboard AND
    //    incident-engine.
    const db_insert_ok = await dbInsertLogEvents(pgp, run_log);
    const disk_write_ok = await writeLogEvents(run_log);
    if (!db_insert_ok || !disk_write_ok) {
      // MONITORING IS BLIND FOR THIS RUN -- NEVER REPORT A CLEAN SUCCESS.
      if (process.exitCode === EXIT.SUCCESS) process.exitCode = EXIT.PARTIAL;
      console.error(
        `[run_outcome] self-log persistence failed (db=${db_insert_ok} disk=${disk_write_ok})`
      );
    }

    console.log(
      `[run_outcome] ${outcome.outcome} exit=${process.exitCode}` +
        ` errors=${outcome.error_events} warns=${outcome.warn_events}` +
        ` failed_systems=${outcome.systems.failed_count}`
    );

    // 4) RELEASE BOTH SHARED POOLS SO THE EVENT LOOP CAN DRAIN (SEE THE
    //    REQUIRE-SITE COMMENT: BOTH ARE LIVE THE MOMENT THIS FILE LOADS).
    try {
      await pgPool.$pool.end();
    } catch (e) {
      console.error(`[run_outcome] utils/db/pg-pool close: ${e.message}`);
    }
    try {
      await job_db.$pool.end();
    } catch (e) {
      console.error(`[run_outcome] db/pgPool close: ${e.message}`);
    }
    pgp.end();

    // 5) FAILSAFE: IF A LEAKED HANDLE (SFTP CLIENT, SOCKET) KEEPS THE LOOP
    //    ALIVE, FORCE-EXIT WITH THE SAME HONEST CODE INSTEAD OF HANGING.
    //    unref() SO THE TIMER ITSELF NEVER HOLDS THE LOOP OPEN.
    const failsafe = setTimeout(() => {
      console.error(
        "[run_outcome] event loop did not drain within 30s; forcing exit"
      );
      process.exit(process.exitCode);
    }, 30_000);
    failsafe.unref();
  }
};

on_boot().catch((error) => {
  // BOOTSTRAP FAILURE (makeAppRunLog / FIRST LOG EVENT): NOTHING WAS RECORDED,
  // SO AT LEAST CRASH HONESTLY.
  console.error(error);
  process.exit(EXIT.FAILED);
});
