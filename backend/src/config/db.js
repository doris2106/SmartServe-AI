const mysql = require('mysql2/promise');
const { loadConfigFromSSM } = require('./ssm');

let pool = null;

async function getDBPool() {
  if (pool) return pool;

  const config = await loadConfigFromSSM();
  console.log(`[Database] Initializing MySQL connection pool -> Host: ${config.dbHost}:${config.dbPort}, DB: ${config.dbName}, User: ${config.dbUser}`);

  pool = mysql.createPool({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    database: config.dbName,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000
  });

  return pool;
}

// Helper for executing parameterized queries safely
async function query(sql, params = []) {
  const p = await getDBPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

module.exports = {
  getDBPool,
  query
};

