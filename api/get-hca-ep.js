const { default: axios } = require("axios");

const [addLogEvent] = require("../utils/logger/log");
const {
  type: { I, W, E },
  tag: { cal, det, cat }
} = require("../utils/logger/enums");

const get_hca_ep_data = async (run_log) => {
  await addLogEvent(I, run_log, "get_hca_ep_data", cal, null, null);
  const odate_url = process.env.HCA_URI;
  try {
    const res = await axios.get(odate_url, {
      // Axios will build the Basic Authorization header
      auth: {
        username: process.env.PROD_LOGIN_NAME, // e.g. "admin" or "admin@TenantName"
        password: process.env.PROD_LOGIN_PW
      },
      headers: {
        Accept: "application/json"
      }
    });

    await addLogEvent(
      I,
      run_log,
      "get_hca_ep_data",
      det,
      { res: res.data },
      null
    );

    return res.data;
  } catch (error) {
    await addLogEvent(E, run_log, "get_hca_ep_data", cat, null, error);
    console.error("OData error:", error.response?.status, error.response?.data);
  }
};

module.exports = get_hca_ep_data;
