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
    const [equipment_ep_data, tech_ep_data] = await Promise.all([
      get_hca_ep_data(run_log, process.env.HCA_URI, "equipment"),
      get_hca_ep_data(run_log, process.env.HCA_TECH, "tech_support")
    ]);

    const equipment_values = equipment_ep_data.value.map(
      ({ Model_2, AddressID, CustomerID_2, AccountID, LocationID, ...rest }) => rest
    );
    const tech_values = tech_ep_data.value;

    const result = await insertHcaOdata(equipment_values, tech_values);

    await addLogEvent(
      I,
      run_log,
      "sync_hca",
      det,
      {
        capture_datetime: result.capture_datetime,
        equipment_count: equipment_values.length,
        tech_support_count: tech_values.length
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
