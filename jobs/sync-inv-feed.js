const fs = require("fs");
const path = require("path");
const SftpClient = require("ssh2-sftp-client");
const { get_inv_feed_data } = require("../api");

const [addLogEvent] = require("../utils/logger/log");
const {
  type: { I, E },
  tag: { cal, det, cat, seq }
} = require("../utils/logger/enums");

const FEEDS = [
  { name: "inv_feed", envVar: "INV_FEED", filename: "Avante_Biomed_Inventory.csv" },
  { name: "inv_feed_2", envVar: "INV_FEED_2", filename: "Avante_Imaging_Inventory.csv" }
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

function jsonToCsv(data) {
  const headers = [];
  const seen = new Set();
  for (const record of data) {
    for (const key of Object.keys(record)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }

  const headerRow = headers.map(escapeField).join(",");
  const rows = data.map((record) =>
    headers.map((key) => escapeField(cleanValue(record[key]))).join(",")
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

      // 2. Convert to CSV
      const csvContent = jsonToCsv(response.value);
      const filename = feed.filename;
      const localPath = path.resolve(__dirname, "../files", filename);
      fs.writeFileSync(localPath, csvContent, "utf-8");

      await addLogEvent(I, run_log, "sync_inv_feed", det, {
        message: `CSV written: ${filename}`,
        record_count: response.value.length
      }, null);

      // 3. Upload to SFTP — unless explicitly skipped. Owner decision
      // 2026-08-25: the vendor box currently has no key for us, and smoke
      // runs must fetch + write CSVs WITHOUT sending anything. The skip is
      // logged INFO (an intentional no-send is not an error).
      if (process.env.SKIP_SFTP === "1") {
        await addLogEvent(I, run_log, "sync_inv_feed", det, {
          message: "SFTP upload skipped (SKIP_SFTP=1)",
          local: localPath
        }, null);
        console.log(`SFTP upload skipped (SKIP_SFTP=1): ${localPath}`);
        continue;
      }

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
