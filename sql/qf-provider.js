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
 * Insert HCA OData value arrays (equipment + tech support) into api.hca_odata
 *
 * @param {Array} equipmentData   - value array from HCA_URI endpoint
 * @param {Array} techSupportData - value array from HCA_TECH endpoint
 * @returns {Promise<{capture_datetime: string}>}
 */
const insertHcaOdata = async (equipmentData, techSupportData) => {
  try {
    const cleanEquipment = trimStrings(equipmentData);
    const cleanTechSupport = trimStrings(techSupportData);
    return db.one(insert_hca_odata, [
      JSON.stringify(equipmentData),
      JSON.stringify(cleanEquipment),
      JSON.stringify(techSupportData),
      JSON.stringify(cleanTechSupport)
    ]);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

module.exports = {
  insertHcaOdata
};
