const fs = require("fs");
const path = require("path");
const SftpClient = require("ssh2-sftp-client");
const { get_inv_feed_data } = require("../api");

const [addLogEvent] = require("../utils/logger/log");
const {
  type: { I, E },
  tag: { cal, det, cat, seq }
} = require("../utils/logger/enums");

// Column mapping: JSON key -> CSV header
const INV_FEED_COLUMN_MAP = [
  { key: "ItemNumberorderableSKU", header: "Item Number (orderable SKU)" },
  { key: "Vendor", header: "Vendor" },
  { key: "QOH", header: "QOH" },
  { key: "StockYN", header: "Stock: Y/N" },
  { key: "LeadTimeEstimatedShipDateBusinessDays", header: "Lead Time / Estimated Ship Date (business Days)" },
  { key: "ConditionCodeNewOEMOriginalNewAftermarketRefurbished", header: "Condition Code (New OEM Original; New Aftermarket; Refurbished)" },
  { key: "Warehouse", header: "Warehouse" }
];

const INV_FEED_2_COLUMN_MAP = [
  { key: "ItemNumber", header: "Item Number" },
  { key: "Vendor", header: "Vendor" },
  { key: "OEM", header: "OEM" },
  { key: "PartDescription", header: "Part Description" },
  { key: "ListPrice", header: "List Price" },
  { key: "OutrightCosttoPartsSource", header: "Outright Cost to PartsSource" },
  { key: "ExchangeCost", header: "Exchange Cost" },
  { key: "CoreCharge", header: "Core Charge" },
  { key: "UOM", header: "UOM" },
  { key: "QTYUOM", header: "QTY / UOM" },
  { key: "ConditionCode", header: "Condition Code" },
  { key: "StockYN", header: "Stock: Y/N" },
  { key: "QOH", header: "QOH" },
  { key: "LeadTime", header: "Lead Time" },
  { key: "SystemManufacturer", header: "System Manufacturer" },
  { key: "CompatibleModels", header: "Compatible Models" },
  { key: "ManufacturedYear", header: "Manufactured Year" },
  { key: "Usage", header: "Usage" }
];

const FEEDS = [
  { name: "inv_feed", envVar: "INV_FEED", filename: "Avante_Biomed_Inventory.csv", columnMap: INV_FEED_COLUMN_MAP },
  { name: "inv_feed_2", envVar: "INV_FEED_2", filename: "Avante_Imaging_Inventory.csv", columnMap: INV_FEED_2_COLUMN_MAP }
];

function cleanValue(val) {
  if (val === null || val === undefined) return "";
  return String(val).trim();
}

function escapeField(val) {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
}

function jsonToCsv(data, columnMap) {
  const headerRow = columnMap.map((col) => escapeField(col.key)).join(",");
  const rows = data.map((record) =>
    columnMap
      .map((col) => escapeField(cleanValue(record[col.key])))
      .join(",")
  );
  return [headerRow, ...rows].join("\n");
}

const sync_inv_feed = async (run_log) => {
  await addLogEvent(I, run_log, "sync_inv_feed", cal, null, null);

  for (const feed of FEEDS) {
    const endpointUrl = process.env[feed.envVar];
    if (!endpointUrl) {
      await addLogEvent(E, run_log, "sync_inv_feed", seq, {
        message: `Missing env var: ${feed.envVar}`
      }, null);
      continue;
    }

    try {
      // 1. Fetch data from OData endpoint
      const response = await get_inv_feed_data(run_log, endpointUrl);
      if (!response?.value || response.value.length === 0) {
        await addLogEvent(I, run_log, "sync_inv_feed", det, {
          message: `No data returned for ${feed.name}`
        }, null);
        continue;
      }

      // 2. Convert to CSV with column mapping and cleaning
      const csvContent = jsonToCsv(response.value, feed.columnMap);
      const filename = feed.filename;
      const localPath = path.resolve(__dirname, "../files", filename);
      fs.writeFileSync(localPath, csvContent, "utf-8");

      await addLogEvent(I, run_log, "sync_inv_feed", det, {
        message: `CSV written: ${filename}`,
        record_count: response.value.length
      }, null);

      // 3. Upload to SFTP
      const sftp = new SftpClient();
      try {
        await sftp.connect({
          host: process.env.SFTP_HOST,
          port: parseInt(process.env.SFTP_PORT),
          username: process.env.SFTP_USER,
          password: process.env.SFTP_PASS
        });

        const remotePath = `./${filename}`;
        await sftp.put(localPath, remotePath);

        await addLogEvent(I, run_log, "sync_inv_feed", det, {
          message: "CSV uploaded successfully",
          local: localPath,
          remote: remotePath
        }, null);

        console.log("CSV uploaded successfully to", remotePath);
      } catch (sftpError) {
        await addLogEvent(E, run_log, "sync_inv_feed", cat, null, sftpError);
        console.error("SFTP upload error:", sftpError.message);
      } finally {
        await sftp.end();
      }
    } catch (error) {
      await addLogEvent(E, run_log, "sync_inv_feed", cat, null, error);
      console.error(`Error processing ${feed.name}:`, error.message);
    }
  }
};

module.exports = sync_inv_feed;
