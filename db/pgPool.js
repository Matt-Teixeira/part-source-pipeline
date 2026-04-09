const fs = require('fs');
const pgp = require('pg-promise')();

function buildSsl() {
   const mode = (process.env.PG_SSLMODE || 'disable').toLowerCase();
   if (mode === 'disable') return false;
   const caPath = process.env.PG_SSL_PATH;
   if (caPath && fs.existsSync(caPath)) {
      return { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
   }
   return { rejectUnauthorized: false };
}

const config = {
   host: process.env.PGHOST || process.env.PG_HOST,
   port: Number(process.env.PGPORT || process.env.PG_PORT),
   database: process.env.PGDATABASE || process.env.PG_DB,
   user: process.env.PGUSER || process.env.PG_USER,
   password: process.env.PGPASSWORD || process.env.PG_PW,
   ssl: buildSsl(),
};

const db = pgp(config);

module.exports = db;
