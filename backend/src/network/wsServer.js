const { WebSocketServer, WebSocket } = require('ws');
const { assetManager } = require('../assets/assetManager');
const { logBuffer } = require('../logs/logBuffer');

function createWsServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`[WS] Klien web terhubung dari: ${ip} (Total klien: ${wss.clients.size})`);

    // Kirim snapshot awal langsung saat terhubung
    try {
      const all = assetManager.getAllAssets();
      const primary = all.find((a) => a.id === 'vessel_c2e2cffb') || all[0];
      if (primary && primary.live_snapshot) {
        ws.send(
          JSON.stringify({
            type: 'telemetry',
            asset_id: primary.id,
            data: primary.live_snapshot,
          })
        );
      }
      // Kirim initial batch logs (40 log terakhir)
      const initialLogs = logBuffer.getLogs({ limit: 40 });
      if (initialLogs.length > 0) {
        ws.send(
          JSON.stringify({
            type: 'stream_logs',
            logs: initialLogs,
          })
        );
      }
    } catch (e) {}

    ws.on('close', () => {});
    ws.on('error', (err) => {
      console.warn('[WS ERROR]', err.message);
    });
  });

  // Broadcast snapshot per asset ke semua klien yang terhubung (1 Hz)
  const broadcastInterval = setInterval(() => {
    if (wss.clients.size === 0) return;

    for (const [assetId, assetItem] of assetManager.assets.entries()) {
      const snap = assetItem.state.getSnapshot();
      const payload = JSON.stringify({
        type: 'telemetry',
        asset_id: assetId,
        data: snap,
      });

      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
        }
      }
    }
  }, 1000);

  // Broadcast live incoming logs setiap 200ms jika ada log pending
  const logBroadcastInterval = setInterval(() => {
    if (wss.clients.size === 0) return;
    const pending = logBuffer.flushPending();
    if (pending.length === 0) return;

    const payload = JSON.stringify({
      type: 'stream_logs',
      logs: pending,
    });

    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }, 200);

  return {
    wss,
    close: () => {
      clearInterval(broadcastInterval);
      clearInterval(logBroadcastInterval);
    },
  };
}

module.exports = {
  createWsServer,
};
