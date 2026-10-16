const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');

const cookieParser = require('cookie-parser');

const config = require('./config');
const { initDatabase } = require('./db/pool');
const { assetManager } = require('./assets/assetManager');
const { agentManager } = require('./agents/agentManager');
const { saveTelemetrySnapshot } = require('./db/telemetryRepo');
const { createWsServer } = require('./network/wsServer');
const { createApiRouter } = require('./api/routes');
const { createAuthRouter } = require('./api/authRoutes');

async function main() {
  console.log('============================================================');
  console.log(' MARINE NAVIGATION PLATFORM (AGENT & ASSET ARCHITECTURE)');
  console.log(' Dynamic Protocol Ingestion • PostgreSQL PostGIS • Modular');
  console.log('============================================================');

  // 1. Inisialisasi Database PostgreSQL & Migrasi
  await initDatabase();

  // 2. Inisialisasi Asset Digital Twins (Memuat daftar kapal dari DB)
  await assetManager.init();

  // 3. Inisialisasi Agent Manager (Mendengarkan Port TCP USR secara dinamis)
  await agentManager.init();

  // 4. Inisialisasi Express & REST API
  const app = express();
  app.use(cors({ origin: true, credentials: true }));
  app.use(cookieParser());
  app.use(express.json());

  // Sajikan frontend web Aqua Map
  const frontendPath = path.join(__dirname, '../../frontend/public');
  app.use(express.static(frontendPath));

  // REST API Routes
  app.use('/api/v1/auth', createAuthRouter());
  app.use('/api/auth', createAuthRouter()); // Alias for convenience
  app.use('/api', createApiRouter());

  const server = http.createServer(app);

  // 5. Inisialisasi WebSocket Server untuk Multi-Asset Telemetry Broadcast
  const wsService = createWsServer(server);

  server.listen(config.http.port, '0.0.0.0', () => {
    console.log(`[HTTP & WS] Server web berjalan di http://0.0.0.0:${config.http.port}`);
    console.log(`[HTTP & WS] WebSocket aktif di ws://0.0.0.0:${config.http.port}/ws`);
  });

  // 6. Background Telemetry Logger per Asset (Hanya simpan saat data baru diterima)
  const dbLogInterval = setInterval(async () => {
    for (const [assetId, assetItem] of assetManager.assets.entries()) {
      if (assetItem.state.lastDataReceivedAt && assetItem.state.lastDataReceivedAt !== assetItem.state._lastSavedDataAt) {
        assetItem.state._lastSavedDataAt = assetItem.state.lastDataReceivedAt;
        const snap = assetItem.state.getSnapshot();
        await saveTelemetrySnapshot(snap, assetId);
      }
    }
  }, Math.round(config.logIntervalSec * 1000));

  // Penanganan Graceful Shutdown
  const shutdown = () => {
    console.log('\n[SHUTDOWN] Menghentikan layanan...');
    clearInterval(dbLogInterval);
    wsService.close();
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[FATAL ERROR]', err);
  process.exit(1);
});
