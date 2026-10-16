const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const pool = new Pool(config.db);

let isConnected = false;

pool.on('connect', () => {
  if (!isConnected) {
    console.log(`[DB] Terhubung ke PostgreSQL di ${config.db.host}:${config.db.port}/${config.db.database}`);
    isConnected = true;
  }
});

pool.on('error', (err) => {
  console.error('[DB ERROR] Masalah koneksi PostgreSQL:', err.message);
});

async function initDatabase(maxRetries = 10, delayMs = 2000) {
  const migrationFile = path.join(__dirname, 'migrations.sql');
  if (!fs.existsSync(migrationFile)) return true;
  const sql = fs.readFileSync(migrationFile, 'utf8');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await pool.query(sql);
      console.log('[DB] Migrasi skema database berhasil dijalankan.');
      return true;
    } catch (err) {
      if (attempt === maxRetries) {
        console.warn(`[DB WARN] Gagal menjalankan migrasi setelah ${maxRetries} percobaan:`, err.message);
        return false;
      }
      console.log(`[DB] Menunggu database siap (Percobaan ${attempt}/${maxRetries})...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

module.exports = {
  pool,
  initDatabase,
};
