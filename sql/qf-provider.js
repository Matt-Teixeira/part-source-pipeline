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

const insertHcaOdata = async (equipmentData, techSupportData, invoiceData, contractDetailsData, srvOrderDetailsData) => {
  try {
    const cleanEquipment = trimStrings(equipmentData);
    const cleanTechSupport = trimStrings(techSupportData);
    const cleanInvoice = trimStrings(invoiceData);
    const cleanContractDetails = trimStrings(contractDetailsData);
    const cleanSrvOrderDetails = trimStrings(srvOrderDetailsData);
    return db.one(insert_hca_odata, [
      JSON.stringify(equipmentData),
      JSON.stringify(cleanEquipment),
      JSON.stringify(techSupportData),
      JSON.stringify(cleanTechSupport),
      JSON.stringify(invoiceData),
      JSON.stringify(cleanInvoice),
      JSON.stringify(contractDetailsData),
      JSON.stringify(cleanContractDetails),
      JSON.stringify(srvOrderDetailsData),
      JSON.stringify(cleanSrvOrderDetails)
    ]);
  } catch (error) {
    console.log(error);
    throw error;
  }
};

module.exports = {
  insertHcaOdata,
  trimStrings
};
