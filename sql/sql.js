const { QueryFile } = require("pg-promise");
const { join: joinPath } = require("path");

// HELPER FOR LINKING TO EXTERNAL QUERY FILES
const sql = (file) => {
  const fullPath = joinPath(__dirname, file); // GENERATING FULL PATH;
  return new QueryFile(fullPath, { minify: true });
};

module.exports = {
  insert_hca_odata: sql("queries/insert-hca-odata.sql")
};
