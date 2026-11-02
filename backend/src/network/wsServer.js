const { WebSocketServer, WebSocket } = require('ws');
const { assetManager } = require('../assets/assetManager');
const { logBuffer } = require('../logs/logBuffer');

let globalWss = null;

/**
 * Broadcast payload langsung per frame tanpa filter/throttling (Zero Delay / Loss Mode)
 */
function broadcastLiveTelemetry(assetId, snap) {
  if (!globalWss || globalWss.clients.size === 0 || !snap) return;

  const nav = snap.navigation || {};
  const mot = snap.motion || {};
  const env = snap.environment || {};
  const eng = snap.engine || {};

  const now = Date.now();
  const lastMs = snap.timestamp_utc ? new Date(snap.timestamp_utc).getTime() : null;
  const dataAgeSec = lastMs ? Math.max(0, (now - lastMs) / 1000) : null;

  let quality = 'offline';
  if (dataAgeSec !== null) {
    if (dataAgeSec <= 90) {
      quality = 'live';
    } else if (dataAgeSec <= 300) {
      quality = 'delayed';
    } else {
      quality = 'offline';
    }
  }

  const vesselUpdate = {
    depth: env.depth_m !== undefined && env.depth_m !== null ? Number(env.depth_m) : undefined,
    waterTemp: env.water_temp_c !== undefined && env.water_temp_c !== null ? Number(env.water_temp_c) : undefined,
    sog: nav.sog_knots !== undefined && nav.sog_knots !== null ? Number(nav.sog_knots) : undefined,
    cog: nav.cog_deg !== undefined && nav.cog_deg !== null ? Number(nav.cog_deg) : undefined,
    heading: mot.heading_deg !== undefined && mot.heading_deg !== null ? Number(mot.heading_deg) : undefined,
    pitch: mot.pitch_deg !== undefined && mot.pitch_deg !== null ? Number(mot.pitch_deg) : undefined,
    roll: mot.roll_deg !== undefined && mot.roll_deg !== null ? Number(mot.roll_deg) : undefined,
    rpm: eng.engine_rpm !== undefined && eng.engine_rpm !== null ? Number(eng.engine_rpm) : undefined,
    batteryVolts: eng.battery_volts !== undefined && eng.battery_volts !== null ? Number(eng.battery_volts) : undefined,
    quality,
    updatedAt: snap.timestamp_utc || (quality === 'live' ? new Date().toISOString() : null),
    customAttributes: snap.custom || {},
  };

  if (quality === 'offline') {
    vesselUpdate.status = 'Offline';
  }

  if (nav.latitude !== null && nav.latitude !== undefined && nav.longitude !== null && nav.longitude !== undefined) {
    vesselUpdate.position = { lat: nav.latitude, lng: nav.longitude };
  }

  const payload = JSON.stringify({
    type: 'telemetry',
    asset_id: assetId,
    data: snap,
    vessel_update: vesselUpdate,
  });

  for (const client of globalWss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function createWsServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  globalWss = wss;

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

  // Fallback heartbeat broadcast (1 Hz) untuk kapal yang benar-benar aktif
  const broadcastInterval = setInterval(() => {
    if (wss.clients.size === 0) return;

    const now = Date.now();
    for (const [assetId, assetItem] of assetManager.assets.entries()) {
      const lastMs = assetItem.state.lastDataReceivedAt;
      // Jangan broadcast jika kapal tidak pernah menerima data atau data sudah usang (> 90 detik)
      if (!lastMs || (now - lastMs > 90000)) {
        continue;
      }
      const snap = assetItem.state.getSnapshot();
      broadcastLiveTelemetry(assetId, snap);
    }
  }, 1000);

  // Broadcast live incoming logs setiap 100ms jika ada log pending
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
  }, 100);

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
  broadcastLiveTelemetry,
};
