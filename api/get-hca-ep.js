const fetch = require("node-fetch");

const [addLogEvent] = require("../utils/logger/log");
const {
  type: { I, W, E },
  tag: { cal, det, cat }
} = require("../utils/logger/enums");

const get_hca_ep_data = async (run_log, odata_url, label) => {
  const action = `get_hca_ep_data:${label}`;
  await addLogEvent(I, run_log, action, cal, null, null);
  try {
    const credentials = Buffer.from(
      `${process.env.PROD_LOGIN_NAME}:${process.env.PROD_LOGIN_PW}`
    ).toString("base64");

    const res = await fetch(odata_url, {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${credentials}`
      }
    });

    if (!res.ok) {
      const body = await res.text();
      const err = new Error(`OData request failed`);
      err.response = { status: res.status, data: body };
      throw err;
    }

    const data = await res.json();

    await addLogEvent(
      I,
      run_log,
      action,
      det,
      { res: data },
      null
    );

    return data;
  } catch (error) {
    await addLogEvent(E, run_log, action, cat, null, error);
    console.error("OData error:", error.response?.status, error.response?.data);
    throw error;
  }
};

module.exports = get_hca_ep_data;
