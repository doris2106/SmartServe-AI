const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { loadConfigFromSSM } = require('../config/ssm');
const { getSeedSQL } = require('./seed');

async function initializeDatabase() {
  console.log('[DB-Init] Initializing SmartServe Database Schema and Seed Data...');
  const config = await loadConfigFromSSM();

  const connection = await mysql.createConnection({
    host: config.dbHost,
    port: config.dbPort,
    user: config.dbUser,
    password: config.dbPassword,
    multipleStatements: true
  });

  console.log(`[DB-Init] Connected to MySQL at ${config.dbHost}:${config.dbPort}`);

  // 1. Run Schema
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  console.log('[DB-Init] Executing schema.sql...');
  await connection.query(schemaSql);
  console.log('[DB-Init] Schema created successfully.');

  // 2. Run Seed
  console.log('[DB-Init] Executing seed.js...');
  const seedSql = await getSeedSQL();
  await connection.query(seedSql);
  console.log('[DB-Init] Database seeded successfully with initial users, departments, categories, and tickets.');

  await connection.end();
  console.log('[DB-Init] Database setup completed.');
}

if (require.main === module) {
  initializeDatabase().catch(err => {
    console.error('[DB-Init Error]:', err);
    process.exit(1);
  });
}

module.exports = { initializeDatabase };

