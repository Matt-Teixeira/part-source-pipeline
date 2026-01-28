const db = require("../db/pgPool");
const { insert_hca_odata } = require("./sql");

const trimStrings = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj.trim();
  if (Array.isArray(obj)) return obj.map(trimStrings);
  if (typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, trimStrings(v)])
    );
  }
  return obj;
};

/**
 * Insert HCA OData value array into api.hca_odata table
 *
 * @param {Array} hcaData - The value array from HCA OData response
 * @returns {Promise<{id: number, capture_datetime: string}>}
 */
const insertHcaOdata = async (hcaData) => {
  try {
    const cleanData = trimStrings(hcaData);
    return db.one(insert_hca_odata, [
      JSON.stringify(hcaData),
      JSON.stringify(cleanData)
    ]);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

module.exports = {
  insertHcaOdata
};
