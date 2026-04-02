const path = require("path");
const SftpClient = require("ssh2-sftp-client");

const [addLogEvent] = require("../utils/logger/log");
const {
  type: { I, E },
  tag: { cal, det, cat }
} = require("../utils/logger/enums");

const send_csv_sftp = async (run_log) => {
  await addLogEvent(I, run_log, "send_csv_sftp", cal, null, null);

  const sftp = new SftpClient();
  const localPath = path.resolve(__dirname, "../files/test.csv");
  const remotePath = "./test.csv";

  try {
    await sftp.connect({
      host: process.env.SFTP_HOST,
      port: parseInt(process.env.SFTP_PORT),
      username: process.env.SFTP_USER,
      password: process.env.SFTP_PASS
    });

    await sftp.put(localPath, remotePath);

    await addLogEvent(I, run_log, "send_csv_sftp", det, {
      message: "CSV uploaded successfully",
      local: localPath,
      remote: remotePath
    }, null);

    console.log("CSV uploaded successfully to", remotePath);
  } catch (error) {
    await addLogEvent(E, run_log, "send_csv_sftp", cat, null, error);
    console.error("SFTP upload error:", error.message);
    console.log("\n" + error);
  } finally {
    await sftp.end();
  }
};

module.exports = send_csv_sftp;
