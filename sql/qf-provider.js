const db = require("../db/pgPool");
const { insert_hca_odata } = require("./sql");

/**
 * Insert HCA OData value array into api.hca_odata table
 *
 * @param {Array} hcaData - The value array from HCA OData response
 * @returns {Promise<{id: number, capture_datetime: string}>}
 */
const insertHcaOdata = async (hcaData) => {
  try {
    return db.one(insert_hca_odata, [JSON.stringify(hcaData)]);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

module.exports = {
  insertHcaOdata
};
