const { default: axios } = require("axios");

const [addLogEvent] = require("../utils/logger/log");
const {
  type: { I, W, E },
  tag: { cal, det, cat }
} = require("../utils/logger/enums");

const get_inv_feed_data = async (run_log, endpoint_url) => {
  await addLogEvent(I, run_log, "get_inv_feed_data", cal, null, null);
  try {
    const res = await axios.get(endpoint_url, {
      auth: {
        username: process.env.PROD_LOGIN_NAME,
        password: process.env.PROD_LOGIN_PW
      },
      headers: {
        Accept: "application/json"
      }
    });

    await addLogEvent(
      I,
      run_log,
      "get_inv_feed_data",
      det,
      { record_count: res.data?.value?.length },
      null
    );

    return res.data;
  } catch (error) {
    await addLogEvent(E, run_log, "get_inv_feed_data", cat, null, error);
    console.error("OData error:", error.response?.status, error.response?.data);
  }
};

module.exports = get_inv_feed_data;
