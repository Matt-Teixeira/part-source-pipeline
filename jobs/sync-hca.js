const { get_hca_ep_data } = require("../api");
const { insertHcaOdata } = require("../sql/qf-provider");

const [addLogEvent] = require("../utils/logger/log");
const {
  type: { I, W, E },
  tag: { cal, det, cat }
} = require("../utils/logger/enums");

const sync_hca = async (run_log) => {
  await addLogEvent(I, run_log, "sync_hca", cal, null, null);

  try {
    const hca_ep_data = await get_hca_ep_data(run_log);

    const hca_values = hca_ep_data.value;
    const result = await insertHcaOdata(hca_values);

    await addLogEvent(
      I,
      run_log,
      "sync_hca",
      det,
      {
        capture_datetime: result.capture_datetime,
        record_count: hca_values.length
      },
      null
    );

    return result;
  } catch (error) {
    await addLogEvent(E, run_log, "sync_hca", cat, null, error);
    console.error("OData error:", error.response?.status, error.response?.data);
    console.error(error);
  }
};

module.exports = sync_hca;
