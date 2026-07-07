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

const decodeEntities = (str) =>
  str
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

// Pull the human-readable text out of an HTML ServiceDescription value.
// Keeps only the <body> content, drops <style>/<script> noise, turns block
// elements into line breaks, decodes entities, and collapses whitespace.
// Only values wrapped in an <html>/<body> document (the Acumatica RTE shape)
// are processed; plain-text notes — including ones containing angle-bracket
// tokens like "<TBD>" or "model <X>" — pass through untouched.
const stripHtml = (value) => {
  if (typeof value !== "string" || !/<(?:html|body)\b/i.test(value)) return value;

  const bodyMatch = value.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let content = bodyMatch ? bodyMatch[1] : value;

  content = content.replace(/<(style|script)[^>]*>[\s\S]*?<\/\1>/gi, "");
  content = content.replace(/<\/(p|div|li|tr|h[1-6])\s*>/gi, "\n");
  content = content.replace(/<br\s*\/?>/gi, "\n");
  content = content.replace(/<[^>]+>/g, "");
  content = decodeEntities(content);

  return content
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n");
};

// Recursively strip HTML from any ServiceDescription field (cleaning stage only).
const stripServiceDescriptions = (obj) => {
  if (Array.isArray(obj)) return obj.map(stripServiceDescriptions);
  if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [
        k,
        k === "ServiceDescription" ? stripHtml(v) : stripServiceDescriptions(v)
      ])
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
    const cleanSrvOrderDetails = stripServiceDescriptions(
      trimStrings(srvOrderDetailsData)
    );
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
  stripHtml,
  stripServiceDescriptions
};
