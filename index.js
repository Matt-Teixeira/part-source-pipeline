("use strict");
require("dotenv").config();

// #JOBS
const { sync_hca, send_csv_sftp, sync_inv_feed } = require("./jobs");

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
        break;
    }
  } catch (error) {
    console.log(error);
    await addLogEvent(E, run_log, "run_job", cat, null, error);
  }
};

const on_boot = async () => {
  const run_log = await makeAppRunLog();

  const job_type = process.argv[2];

  let note = {
    job_type
  };

  try {
    await addLogEvent(I, run_log, "on_boot", cal, note, null);
    await run_job(run_log, job_type);

    await writeLogEvents(run_log);
  } catch (error) {
    await addLogEvent(E, run_log, "on_boot", cat, null, error);
    await writeLogEvents(run_log);
    console.log(error);
  }
};

on_boot();
