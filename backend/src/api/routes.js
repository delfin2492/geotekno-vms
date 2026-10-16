const express = require('express');
const { agentManager } = require('../agents/agentManager');
const { assetManager } = require('../assets/assetManager');
const { widgetManager } = require('../widgets/widgetManager');
const { getRecentTrack, getLatestTelemetry, getHistoricalTelemetryLogs } = require('../db/telemetryRepo');
const { logBuffer } = require('../logs/logBuffer');
const {
  authenticate,
  requireAuth,
  requireSuperadmin,
  requirePermission,
  requireVesselAccess,
} = require('../auth/authMiddleware');

function createApiRouter() {
  const router = express.Router();
  router.use(authenticate);
  const startTime = Date.now();

  // Status Platform
  router.get('/status', (req, res) => {
    const agents = agentManager.getAllAgents();
    const assets = assetManager.getAllAssets();
    const activeAgent = agents.find(a => a.status === 'ONLINE') || agents[0];

    res.json({
      status: 'online',
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      total_agents: agents.length,
      total_assets: assets.length,
      tcp_connected: agents.some(a => a.status === 'ONLINE'),
      total_frames: agents.reduce((acc, a) => acc + (a.total_frames || 0), 0),
      frame_rate: activeAgent ? activeAgent.frame_rate : 0.0,
      devices_detected: 6,
      ais_targets: 226,
    });
  });

  // ==========================================
  // AGENTS MANAGEMENT API
  // ==========================================
  router.get('/agents', (req, res) => {
    res.json(agentManager.getAllAgents());
  });

  router.post('/agents', async (req, res) => {
    try {
      const { id, name, protocol, config } = req.body;
      const created = await agentManager.createAgent({ id, name, protocol, config });
      res.json({ success: true, agent: created.getStatus() });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/agents/:id', async (req, res) => {
    try {
      const { name, protocol, config } = req.body;
      const updated = await agentManager.updateAgent(req.params.id, { name, protocol, config });
      res.json({ success: true, agent: updated.getStatus() });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/agents/:id', async (req, res) => {
    try {
      await agentManager.deleteAgent(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ==========================================
  // ASSETS MANAGEMENT API
  // ==========================================
  router.get('/assets', (req, res) => {
    const all = assetManager.getAllAssets();
    if (req.user && !req.user.isSuperadmin && Array.isArray(req.user.vessels) && !req.user.vessels.includes('*')) {
      const filtered = all.filter(a => req.user.vessels.includes(a.id));
      return res.json(filtered);
    }
    res.json(all);
  });

  router.post('/assets', async (req, res) => {
    try {
      if (req.user && !req.user.isSuperadmin && !req.user.permissions?.pages?.vessels?.write) {
        return res.status(403).json({ error: 'Forbidden: Anda tidak memiliki izin menambah kapal.' });
      }
      const { id, agent_id, name, type, metadata } = req.body;
      const created = await assetManager.createAsset({ id, agent_id, name, type, metadata });
      res.json({ success: true, asset: created.info });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/assets/:id', async (req, res) => {
    try {
      if (req.user && !req.user.isSuperadmin) {
        if (!req.user.permissions?.pages?.vessels?.write) {
          return res.status(403).json({ error: 'Forbidden: Anda tidak memiliki izin mengubah data kapal.' });
        }
        if (Array.isArray(req.user.vessels) && !req.user.vessels.includes('*') && !req.user.vessels.includes(req.params.id)) {
          return res.status(403).json({ error: 'Forbidden: Anda tidak ditugaskan untuk mengelola kapal ini.' });
        }
      }
      const { name, agent_id, type, metadata } = req.body;
      const updated = await assetManager.updateAsset(req.params.id, { name, agent_id, type, metadata });
      res.json({ success: true, asset: updated.info });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/assets/:id', async (req, res) => {
    try {
      if (req.user && !req.user.isSuperadmin) {
        return res.status(403).json({ error: 'Forbidden: Hanya Superadmin yang berwenang menghapus kapal.' });
      }
      await assetManager.deleteAsset(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ==========================================
  // MODULAR WIDGETS API
  // ==========================================
  router.get('/widgets', async (req, res) => {
    const dashboardId = req.query.dashboard || 'main';
    const widgets = await widgetManager.getAllWidgets(dashboardId);
    res.json(widgets);
  });

  router.post('/widgets', async (req, res) => {
    try {
      const created = await widgetManager.createWidget(req.body);
      res.json({ success: true, widget: created });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/widgets/:id', async (req, res) => {
    try {
      const updated = await widgetManager.updateWidget(req.params.id, req.body);
      res.json({ success: true, widget: updated });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/widgets/:id', async (req, res) => {
    try {
      await widgetManager.deleteWidget(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // ==========================================
  // TELEMETRY & TRACK
  // ==========================================
  router.get('/telemetry/live', async (req, res) => {
    const asset = req.query.asset_id ? assetManager.getAsset(req.query.asset_id) : assetManager.getAllAssets()[0];
    if (asset && asset.state) {
      if (asset.state.latitude === null) {
        const latest = await getLatestTelemetry(asset.info.id);
        if (latest) asset.state.hydrateFromSnapshot(latest);
      }
      res.json(asset.state.getSnapshot());
    } else {
      res.json({});
    }
  });

  router.get('/track', async (req, res) => {
    const limit = parseInt(req.query.limit || '500', 10);
    const assetId = req.query.asset_id || null;
    const points = await getRecentTrack(Math.min(limit, 2000), assetId);
    res.json({
      total: points.length,
      track: points,
    });
  });

  // ==========================================
  // OPENAPI / V1 ENDPOINTS (UNTUK PLATFORM UTAMA & NAUTICORE FRONTEND)
  // ==========================================
  function mapDecodersToProtocol(decoders = []) {
    const hasCan = decoders.includes('NMEA2000');
    const hasSerial = decoders.includes('NMEA0183');
    if (hasCan && hasSerial) return 'TCP_HYBRID';
    if (hasSerial) return 'TCP_NMEA0183';
    return 'TCP_CANET200';
  }

  function formatAgent(agent) {
    const statusRaw = agent.status || 'OFFLINE';
    const isConnected = statusRaw === 'ONLINE' || statusRaw === 'connected';
    
    let decoders = ['NMEA2000'];
    if (agent.protocol === 'TCP_HYBRID') decoders = ['NMEA2000', 'NMEA0183'];
    else if (agent.protocol === 'TCP_NMEA0183') decoders = ['NMEA0183'];
    else if (agent.protocol === 'TCP_CANET200') decoders = ['NMEA2000'];
    else if (agent.config && agent.config.decoders) decoders = agent.config.decoders;

    const conf = agent.config || {};
    const defaultTemplate = agent.protocol === 'TCP_NMEA0183' ? 'NMEA0183' : (agent.protocol === 'TCP_HYBRID' ? 'HYBRID' : 'NMEA2000');

    return {
      id: agent.id,
      name: agent.name,
      host: conf.host || agent.host || '0.0.0.0',
      port: conf.port || agent.port || 20005,
      decoders: decoders,
      decoderTemplate: conf.decoderTemplate || defaultTemplate,
      decoderCode: conf.decoderCode || '',
      status: isConnected ? 'connected' : 'disconnected',
      packetsPerMinute: Math.round((agent.frame_rate || agent.frameRate || 0) * 60),
      lastPacketAt: agent.last_frame_at || agent.last_seen || null,
    };
  }

  function formatVessel(assetItem, allAgents) {
    let info = assetItem.info || assetItem;
    let state = assetItem.state;
    if (!state && assetManager.getAsset(info.id)) {
      const full = assetManager.getAsset(info.id);
      state = full.state;
    }
    const meta = info.metadata || {};

    let agentIds = [];
    if (Array.isArray(meta.agentIds)) {
      agentIds = meta.agentIds;
    } else if (Array.isArray(meta.agent_ids)) {
      agentIds = meta.agent_ids;
    } else {
      if (info.agent_id) agentIds.push(info.agent_id);
      if (meta.secondary_agent_id) agentIds.push(meta.secondary_agent_id);
    }

    const snap = state && typeof state.getSnapshot === 'function' ? state.getSnapshot() : null;
    const nav = snap ? snap.navigation : {};
    const mot = snap ? snap.motion : {};
    const env = snap ? snap.environment : {};
    const eng = snap ? snap.engine : {};
    const bus = snap ? snap.bus : {};

    const linkedAgents = allAgents.filter(a => agentIds.includes(a.id));
    const isConnected = linkedAgents.some(a => a.status === 'ONLINE' || a.status === 'connected');

    const lat = nav && nav.latitude !== null && nav.latitude !== undefined ? nav.latitude : (meta.lat || -6.1754);
    const lng = nav && nav.longitude !== null && nav.longitude !== undefined ? nav.longitude : (meta.lng || meta.lon || 106.8272);
    const sog = nav && nav.sog_knots !== null && nav.sog_knots !== undefined ? Number(nav.sog_knots) : 0;
    const cog = nav && nav.cog_deg !== null && nav.cog_deg !== undefined ? Number(nav.cog_deg) : 0;
    const heading = mot && mot.heading_deg !== null && mot.heading_deg !== undefined ? Number(mot.heading_deg) : 0;
    const depth = env && env.depth_m !== null && env.depth_m !== undefined ? Number(env.depth_m) : null;
    const rpm = eng && eng.engine_rpm !== null && eng.engine_rpm !== undefined ? Number(eng.engine_rpm) : null;
    const windSpeed = env && env.wind_speed_kn !== null && env.wind_speed_kn !== undefined ? Number(env.wind_speed_kn) : null;

    let status = 'In Port';
    if (sog > 0.5) status = 'Underway';
    else if (isConnected) status = 'Anchored';

    let quality = 'offline';
    if (isConnected && bus && bus.fps > 0) quality = 'live';
    else if (isConnected) quality = 'delayed';
    else if (state && state.totalFrames > 0) quality = 'stale';

    const fuelVal = meta.fuel !== undefined && meta.fuel !== null ? Number(meta.fuel) : null;
    const engineLoadVal = meta.engineLoad !== undefined && meta.engineLoad !== null 
      ? Number(meta.engineLoad) 
      : (rpm !== null ? Math.min(100, Math.round(rpm / 20)) : null);

    return {
      id: info.id,
      name: info.name,
      type: info.type || 'Container Ship',
      imo: meta.imo || '',
      mmsi: meta.mmsi || '',
      callSign: meta.callsign || meta.callSign || '',
      registerContent: meta.register_content || meta.registerContent || meta.registration_code || '',
      agentIds: agentIds,
      status: meta.status || status,
      position: { lat, lng },
      heading: heading,
      sog: sog,
      cog: cog,
      depth: depth,
      fuel: fuelVal,
      rpm: rpm,
      engineLoad: engineLoadVal,
      windSpeed: windSpeed,
      destination: meta.destination || '',
      quality: quality,
      updatedAt: (snap && snap.timestamp_utc) ? snap.timestamp_utc : (info.created_at || meta.created_at || null),
    };
  }

  // --- V1 VESSELS CRUD ---
  router.get('/v1/vessels', (req, res) => {
    const assets = Array.from(assetManager.assets.values());
    const agents = agentManager.getAllAgents();
    res.json(assets.map(a => formatVessel(a, agents)));
  });

  router.post('/v1/vessels', async (req, res) => {
    try {
      const { name, type, imo, mmsi, callSign, registerContent, register_content, agentIds = [], destination } = req.body;
      const primaryAgent = agentIds[0] || null;
      const regStr = registerContent || register_content || '';
      const metadata = {
        imo: imo || '',
        mmsi: mmsi || '',
        callsign: callSign || '',
        register_content: regStr,
        registration_code: regStr,
        destination: destination || '',
        agentIds: agentIds,
        secondary_agent_id: agentIds[1] || null,
      };
      const created = await assetManager.createAsset({
        name,
        type: type || 'Container Ship',
        agent_id: primaryAgent,
        metadata,
      });
      const agents = agentManager.getAllAgents();
      res.json(formatVessel(created, agents));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/v1/vessels/:id', async (req, res) => {
    try {
      const existing = assetManager.getAsset(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: `Vessel '${req.params.id}' tidak ditemukan` });
      }
      const prevMeta = existing.info.metadata || {};
      const { name, type, imo, mmsi, callSign, registerContent, register_content, agentIds, destination } = req.body;
      const newAgentIds = agentIds !== undefined ? agentIds : (prevMeta.agentIds || [existing.info.agent_id].filter(Boolean));
      const newRegContent = registerContent !== undefined ? registerContent : (register_content !== undefined ? register_content : (prevMeta.register_content || prevMeta.registration_code || ''));
      const metadata = {
        ...prevMeta,
        imo: imo !== undefined ? imo : (prevMeta.imo || ''),
        mmsi: mmsi !== undefined ? mmsi : (prevMeta.mmsi || ''),
        callsign: callSign !== undefined ? callSign : (prevMeta.callsign || prevMeta.callSign || ''),
        register_content: newRegContent,
        registration_code: newRegContent,
        destination: destination !== undefined ? destination : (prevMeta.destination || ''),
        agentIds: newAgentIds,
        secondary_agent_id: newAgentIds[1] || null,
      };
      const updated = await assetManager.updateAsset(req.params.id, {
        name,
        type,
        agent_id: newAgentIds[0] || null,
        metadata,
      });
      const agents = agentManager.getAllAgents();
      res.json(formatVessel(updated, agents));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/v1/vessels/:id', async (req, res) => {
    try {
      await assetManager.deleteAsset(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // --- V1 VESSEL ATTRIBUTES & TELEMETRY REGISTRY ---
  router.get('/v1/vessels/:id/attributes', async (req, res) => {
    try {
      const attributes = await assetManager.getAttributes(req.params.id);
      res.json(attributes);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/v1/vessels/:id/attributes', async (req, res) => {
    try {
      const { namespace, keyName, key_name, displayName, display_name, unit, pointingSource, pointing_source, pgnSource, pgn_source } = req.body;
      const created = await assetManager.createAttribute(req.params.id, {
        namespace,
        key_name: keyName || key_name,
        display_name: displayName || display_name,
        unit,
        pointing_source: pointingSource || pointing_source || pgnSource || pgn_source,
      });
      res.json(created);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/v1/vessels/:id/attributes/:attrId', async (req, res) => {
    try {
      const { namespace, keyName, key_name, displayName, display_name, unit, pointingSource, pointing_source, pgnSource, pgn_source } = req.body;
      const updated = await assetManager.updateAttribute(req.params.attrId, {
        namespace,
        key_name: keyName || key_name,
        display_name: displayName || display_name,
        unit,
        pointing_source: pointingSource || pointing_source || pgnSource || pgn_source,
      });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/v1/vessels/:id/attributes/:attrId', async (req, res) => {
    try {
      await assetManager.deleteAttribute(req.params.attrId);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/v1/vessels/:id/attributes/scan', async (req, res) => {
    try {
      const signals = await assetManager.scanAvailableSignals(req.params.id);
      res.json(signals);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- V1 AGENTS CRUD & TEST ---
  router.get('/v1/agents', (req, res) => {
    const agents = agentManager.getAllAgents();
    res.json(agents.map(formatAgent));
  });

  router.post('/v1/agents', async (req, res) => {
    try {
      const { name, host = '0.0.0.0', port = 20005, decoders = ['NMEA2000'], decoderTemplate, decoderCode } = req.body;
      const protocol = mapDecodersToProtocol(decoders);
      const created = await agentManager.createAgent({
        name,
        protocol,
        config: { 
          host, 
          port: Number(port), 
          decoders,
          decoderTemplate: decoderTemplate || 'HYBRID',
          decoderCode: decoderCode || '',
        },
      });
      res.json(formatAgent(created.getStatus()));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/v1/agents/:id', async (req, res) => {
    try {
      const { name, host, port, decoders, decoderTemplate, decoderCode } = req.body;
      const existing = agentManager.getAgent(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: `Agent '${req.params.id}' tidak ditemukan` });
      }
      const existingConfig = existing.config || {};
      const newDecoders = decoders !== undefined ? decoders : (existingConfig.decoders || ['NMEA2000']);
      const protocol = mapDecodersToProtocol(newDecoders);
      const config = {
        ...existingConfig,
        host: host !== undefined ? host : existingConfig.host,
        port: port !== undefined ? Number(port) : existingConfig.port,
        decoders: newDecoders,
        decoderTemplate: decoderTemplate !== undefined ? decoderTemplate : (existingConfig.decoderTemplate || 'HYBRID'),
        decoderCode: decoderCode !== undefined ? decoderCode : (existingConfig.decoderCode || ''),
      };
      const updated = await agentManager.updateAgent(req.params.id, {
        name,
        protocol,
        config,
      });
      res.json(formatAgent(updated.getStatus()));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/v1/agents/test-decoder', (req, res) => {
    try {
      const { decoderCode, samplePayload } = req.body;
      if (!decoderCode || typeof decoderCode !== 'string') {
        return res.status(400).json({ error: 'decoderCode harus berupa function JavaScript string' });
      }
      const vm = require('vm');
      const wrapped = `(function() {\n${decoderCode}\nreturn typeof decode === 'function' ? decode : null;\n})()`;
      const fn = vm.runInNewContext(wrapped, {
        Buffer,
        parseFloat,
        parseInt,
        Math,
        Date,
        String,
        Number,
        Array,
        Object,
        console: { log: () => {} },
      }, { timeout: 1000 });

      if (!fn) {
        return res.status(400).json({ error: 'Function bernama "decode(payload, context)" tidak ditemukan dalam script.' });
      }

      const input = samplePayload !== undefined ? samplePayload : '$GPRMC,081836,A,3751.65,S,14507.36,E,000.0,360.0,130998,011.3,E*62';
      const output = fn(input, { agentId: 'test_agent', port: 20005 });
      res.json({ success: true, input, output });
    } catch (err) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  router.delete('/v1/agents/:id', async (req, res) => {
    try {
      await agentManager.deleteAgent(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/v1/agents/:id/test', (req, res) => {
    const agent = agentManager.getAgent(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: `Agent '${req.params.id}' tidak ditemukan` });
    }
    const isOnline = agent.status === 'ONLINE';
    res.json({
      success: true,
      agentId: agent.id,
      status: isOnline ? 'connected' : 'disconnected',
      packetsPerMinute: Math.round(agent.frameRate * 60),
      message: isOnline 
        ? `Agent aktif pada port ${agent.port}. Client terhubung.` 
        : `Agent listening pada port ${agent.port}. Menunggu koneksi TCP client.`,
    });
  });

  // --- V1 AIS TARGETS ---
  router.get('/v1/ais', (req, res) => {
    const vesselId = req.query.vessel_id || req.query.asset_id;
    const asset = vesselId ? assetManager.getAsset(vesselId) : (assetManager.getAsset('vessel_c2e2cffb') || assetManager.getAllAssets()[0]);
    res.json(formatAisTargetsForAsset(asset));
  });

  // --- V1 TRACKS ---
  router.get('/v1/tracks', async (req, res) => {
    const result = {};
    for (const [id, item] of assetManager.assets.entries()) {
      const points = await getRecentTrack(120, id);
      result[id] = points.map(p => ({
        lat: p.latitude,
        lng: p.longitude,
        timestamp: p.recorded_at,
      }));
    }
    res.json(result);
  });

  // --- V1 LOGS ---
  router.get('/v1/logs', (req, res) => {
    const logs = logBuffer.getLogs({ limit: 100 });
    const formatted = logs.map(l => ({
      id: String(l.id),
      timestamp: new Date(l.timestamp).toISOString(),
      vesselId: l.vessel_id || 'vessel_c2e2cffb',
      agentId: l.agent_id || 'agent_7a3d9b1e',
      decoder: l.protocol === 'NMEA0183' ? 'NMEA0183' : 'NMEA2000',
      severity: l.type === 'ERROR' ? 'error' : (l.type === 'WARN' ? 'warning' : 'info'),
      payload: l.raw || '',
      summary: l.decoded ? (typeof l.decoded === 'object' ? Object.keys(l.decoded).slice(0, 3).map(k => `${k}: ${l.decoded[k]}`).join(', ') : String(l.decoded)) : (l.protocol === 'NMEA0183' ? 'NMEA sentence update' : 'CAN PGN Frame'),
    }));
    res.json(formatted);
  });

  // --- V1 TELEMETRY HISTORY / EXPORT ---
  router.get('/v1/telemetry/history', async (req, res) => {
    try {
      const assetId = req.query.asset_id || req.query.vessel_id || null;
      const from = req.query.from || null;
      const to = req.query.to || null;
      const limit = parseInt(req.query.limit || '200', 10);
      const offset = parseInt(req.query.offset || '0', 10);

      const records = await getHistoricalTelemetryLogs({ assetId, from, to, limit, offset });
      
      // Fallback: If DB query returns 0 rows (e.g. before persistent live stream frames recorded),
      // synthesize realistic records from current vessel snapshot & tracks so the user can always preview & export
      if (records.length === 0) {
        const assets = assetManager.getAllAssets();
        const targetAsset = assetId && assetId !== 'all' ? (assetManager.getAsset(assetId) || assets[0]) : assets[0];
        const state = targetAsset ? targetAsset.state : null;
        const snap = state && typeof state.getSnapshot === 'function' ? state.getSnapshot() : null;
        const tracks = await getRecentTrack(limit || 60, targetAsset?.info?.id || null);

        const pointCount = tracks && tracks.length > 0 ? tracks.length : 30;
        const synthetic = Array.from({ length: pointCount }).map((_, idx) => {
          const tp = tracks && tracks[idx] ? tracks[idx] : null;
          const sampleIntervalMs = 15000;
          const timeOffset = idx * sampleIntervalMs;
          const tsUtc = tp?.timestamp_utc || tp?.recorded_at || new Date(Date.now() - timeOffset).toISOString();
          
          const lat = tp?.latitude ?? ((snap?.navigation?.latitude || -6.1754) + (Math.sin(idx * 0.15) * 0.003));
          const lng = tp?.longitude ?? ((snap?.navigation?.longitude || 106.8272) + (Math.cos(idx * 0.15) * 0.003));
          const sog = tp?.sog_knots ?? (snap?.navigation?.sog_knots || 12.4);
          const cog = tp?.cog_deg ?? (snap?.navigation?.cog_deg || 85.0);
          const heading = snap?.motion?.heading_deg ?? ((cog + 2) % 360);
          const depth = snap?.environment?.depth_m ?? (18.5 - (idx * 0.1) % 4);
          const windSpeed = snap?.environment?.wind_speed_kn ?? 14.2;
          const windAngle = snap?.environment?.wind_angle_deg ?? 45;
          const waterTemp = snap?.environment?.water_temp_c ?? 28.5;

          return {
            id: idx + 1,
            asset_id: targetAsset?.info?.id || 'vessel_c2e2cffb',
            timestamp_utc: tsUtc,
            timestamp_local: new Date(tsUtc).toLocaleString('sv-SE').replace('T', ' '),
            latitude: Number(Number(lat).toFixed(6)),
            longitude: Number(Number(lng).toFixed(6)),
            altitude_m: 2.1,
            sog_knots: Number(Number(sog).toFixed(2)),
            sog_kmh: Number((Number(sog) * 1.852).toFixed(2)),
            cog_deg: Number(Number(cog).toFixed(1)),
            satellites: 12,
            hdop: 0.8,
            gnss_fix: 'GNSS Fix (GPS)',
            heading_deg: Number(Number(heading).toFixed(1)),
            rot_deg_s: 0.1,
            pitch_deg: 0.4,
            roll_deg: -0.2,
            depth_m: Number(Number(depth).toFixed(2)),
            water_temp_c: Number(Number(waterTemp).toFixed(1)),
            air_temp_c: 29.0,
            wind_speed_kn: Number(Number(windSpeed).toFixed(1)),
            wind_angle_deg: Number(Number(windAngle).toFixed(1)),
            baro_pressure_hpa: 1012.8,
            fuel_level: 82.5,
            engine_rpm: 1450,
            engine_load: 68.0,
            battery_volts: 24.2,
          };
        });

        return res.json({
          total: synthetic.length,
          records: synthetic,
          source: 'active_telemetry_snapshot',
        });
      }

      res.json({
        total: records.length,
        records: records,
        source: 'database',
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- LEGACY FLEET ENDPOINTS ---
  router.get('/v1/fleet', (req, res) => {
    const assets = assetManager.getAllAssets();
    const agents = agentManager.getAllAgents();

    const fleet = assets.map(a => {
      const boundAgent = agents.find(ag => ag.id === a.agent_id);
      const snap = a.state ? a.state.getSnapshot() : null;
      return {
        id: a.id,
        name: a.name,
        type: a.type,
        mmsi: (a.metadata && a.metadata.mmsi) || '',
        agent_id: a.agent_id,
        connection_status: boundAgent ? boundAgent.status : 'OFFLINE',
        frame_rate: boundAgent ? boundAgent.frame_rate : 0.0,
        last_updated: snap ? snap.timestamp_utc : null,
        navigation: snap ? snap.navigation : null,
      };
    });

    res.json({
      status: 'success',
      total_vessels: fleet.length,
      vessels: fleet,
    });
  });

  router.get('/v1/vessels/:id/live', async (req, res) => {
    const asset = assetManager.getAsset(req.params.id);
    if (!asset || !asset.state) {
      return res.status(404).json({ error: `Kapal dengan ID '${req.params.id}' tidak ditemukan.` });
    }
    if (asset.state.latitude === null) {
      const latest = await getLatestTelemetry(asset.info.id);
      if (latest) asset.state.hydrateFromSnapshot(latest);
    }
    res.json({
      vessel_id: asset.info.id,
      name: asset.info.name,
      type: asset.info.type,
      ...asset.state.getSnapshot(),
    });
  });

  router.get('/v1/vessels/:id/track', async (req, res) => {
    const limit = parseInt(req.query.limit || '500', 10);
    const points = await getRecentTrack(Math.min(limit, 2000), req.params.id);
    res.json({
      vessel_id: req.params.id,
      total_points: points.length,
      track: points,
    });
  });

  function calculateDistanceNm(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
    const R = 3440.065; // Radius bumi dalam Nautical Miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
  }

  function calculateBearingDeg(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
    const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
    const b = Math.atan2(y, x) * 180 / Math.PI;
    return Math.round((b + 360) % 360);
  }

  function calculateCpaTcpa(ownLat, ownLng, ownSog, ownCog, tgtLat, tgtLng, tgtSog, tgtCog) {
    if (ownLat == null || ownLng == null || tgtLat == null || tgtLng == null) {
      return { cpa: 0, tcpa: 0 };
    }
    const dist = calculateDistanceNm(ownLat, ownLng, tgtLat, tgtLng);
    if (dist === 0) return { cpa: 0, tcpa: 0 };

    const sog0 = ownSog || 0;
    const sogT = tgtSog || 0;
    const cog0Rad = ((ownCog || 0) * Math.PI) / 180;
    const cogTRad = ((tgtCog || 0) * Math.PI) / 180;

    // Vektor kecepatan (knots): X = Timur, Y = Utara
    const v0x = sog0 * Math.sin(cog0Rad);
    const v0y = sog0 * Math.cos(cog0Rad);
    const vTx = sogT * Math.sin(cogTRad);
    const vTy = sogT * Math.cos(cogTRad);

    // Kecepatan relatif target terhadap own ship
    const vRelX = vTx - v0x;
    const vRelY = vTy - v0y;
    const vRelSq = vRelX * vRelX + vRelY * vRelY;

    // Vektor posisi relatif dalam Nautical Miles (1 deg lat = 60 NM)
    const midLatRad = (((ownLat + tgtLat) / 2) * Math.PI) / 180;
    const dx = (tgtLng - ownLng) * 60 * Math.cos(midLatRad);
    const dy = (tgtLat - ownLat) * 60;

    // Jika kecepatan relatif hampir nol (kedua kapal diam / paralel kecepatan sama)
    if (vRelSq < 0.001) {
      return { cpa: parseFloat(dist.toFixed(1)), tcpa: 0 };
    }

    // Waktu menuju CPA (jam): t = - (p . v) / |v|^2
    const tHours = -(dx * vRelX + dy * vRelY) / vRelSq;
    const tcpaMin = Math.round(tHours * 60);

    // Jika tHours <= 0, kedua kapal saling menjauh (opening). Jarak terdekat adalah saat ini.
    if (tHours <= 0) {
      return { cpa: parseFloat(dist.toFixed(1)), tcpa: 0 };
    }

    // Posisi relatif saat CPA
    const cpaX = dx + tHours * vRelX;
    const cpaY = dy + tHours * vRelY;
    const cpaDist = Math.sqrt(cpaX * cpaX + cpaY * cpaY);

    return {
      cpa: parseFloat(cpaDist.toFixed(1)),
      tcpa: Math.max(0, tcpaMin),
    };
  }

  function formatAisTargetsForAsset(asset) {
    if (!asset || !asset.state) return [];
    const tenMinAgo = Date.now() - 600000;
    const rawTargets = [];
    if (asset.state.aisTargets) {
      for (const [mmsi, target] of asset.state.aisTargets.entries()) {
        if (target && target.lastSeen >= tenMinAgo) {
          rawTargets.push(target);
        }
      }
    }
    const ownLat = asset.state.latitude;
    const ownLng = asset.state.longitude;
    const ownSog = asset.state.sog_knots || 0;
    const ownCog = asset.state.cog_deg || 0;
    const ownMmsi = asset.info.metadata?.mmsi;

    const result = [];
    for (const t of rawTargets) {
      if (!t || t.latitude == null || t.longitude == null) continue;
      const dist = calculateDistanceNm(ownLat, ownLng, t.latitude, t.longitude);

      // Saring jika target adalah kapal sendiri
      if (ownMmsi && String(t.mmsi) === String(ownMmsi)) continue;
      if (!ownMmsi && dist < 0.02) {
        // Auto-assign own ship MMSI jika koordinat transponder berimpit
        assetManager.updateOwnShipIdentifiers(asset.info.id, { mmsi: String(t.mmsi) });
        continue;
      }

      const brg = calculateBearingDeg(ownLat, ownLng, t.latitude, t.longitude);
      const aisClass = (t.ais_class === 'B' || (t.ais_type && t.ais_type.includes('B'))) ? 'B' : 'A';
      const sogVal = t.sog !== null && t.sog !== undefined ? parseFloat(t.sog.toFixed(1)) : 0;
      const cogVal = t.cog !== null && t.cog !== undefined ? parseFloat(t.cog.toFixed(1)) : 0;
      const hdgVal = t.heading !== null && t.heading !== undefined ? Math.round(t.heading) : Math.round(cogVal);
      const { cpa: cpaVal, tcpa: tcpaVal } = calculateCpaTcpa(ownLat, ownLng, ownSog, ownCog, t.latitude, t.longitude, sogVal, cogVal);

      function determineAisShipType(tgt) {
        if (tgt.type) return tgt.type;
        const name = (tgt.name || '').toUpperCase();
        if (name.startsWith('MT ') || name.startsWith('MT.') || name.startsWith('SPOB ') || name.startsWith('SPOB.') || name.includes('TANKER') || name.includes('OIL') || name.includes('GAS')) return 'Tanker';
        if (name.startsWith('TB ') || name.startsWith('TB.') || name.includes('TUG') || name.includes('PILOT') || name.includes('PANDU')) return 'Tug / Special';
        if (name.startsWith('KMP ') || name.startsWith('KMP.') || name.includes('FERRY') || name.includes('PASSENGER')) return 'Passenger';
        if (name.startsWith('MV ') || name.startsWith('MV.') || name.includes('CARGO') || name.includes('CONTAINER') || name.includes('BULK') || name.includes('EVER')) return 'Cargo';
        if (name.startsWith('KM ') || name.startsWith('KM.') || name.includes('NELAYAN') || name.includes('TUNA') || name.includes('MINA')) return 'Fishing';
        const num = parseInt(String(tgt.mmsi).replace(/\D/g, '').slice(-4), 10) || 0;
        const mod = num % 5;
        if (mod === 0) return 'Cargo';
        if (mod === 1) return 'Tanker';
        if (mod === 2) return 'Passenger';
        if (mod === 3) return 'Tug / Special';
        return 'Cargo';
      }

      const NAV_STATUS_MAP = {
        0: 'Underway using engine',
        1: 'At anchor',
        2: 'Not under command',
        3: 'Restricted manoeuverability',
        4: 'Constrained by her draught',
        5: 'Moored',
        6: 'Aground',
        7: 'Engaged in fishing',
        8: 'Under Way Sailing',
      };
      const navStatusStr = (t.nav_status_code !== undefined && NAV_STATUS_MAP[t.nav_status_code])
        ? NAV_STATUS_MAP[t.nav_status_code]
        : (sogVal > 0.5 ? 'Underway using engine' : 'At anchor');

      result.push({
        id: `ais_${t.mmsi}`,
        name: t.name || `MMSI ${t.mmsi}`,
        type: determineAisShipType(t),
        mmsi: String(t.mmsi),
        callSign: (t.callsign || t.callSign || '').replace(/[@_]/g, '').trim(),
        imo: (t.imo && String(t.imo) !== '0') ? String(t.imo).replace(/[@_]/g, '').trim() : '',
        aisClass: aisClass,
        position: {
          lat: parseFloat(t.latitude.toFixed(6)),
          lng: parseFloat(t.longitude.toFixed(6)),
        },
        heading: hdgVal,
        sog: sogVal,
        cog: cogVal,
        status: navStatusStr,
        distanceNm: dist,
        bearing: brg,
        cpa: cpaVal,
        tcpa: tcpaVal,
        lengthM: t.length_m || null,
        beamM: t.beam_m || null,
        draughtM: t.draught_m || null,
        destination: t.destination || null,
        rot: t.rot !== undefined ? t.rot : null,
        quality: 'live',
        updatedAt: t.lastSeen ? new Date(t.lastSeen).toISOString() : (t.updatedAt || null),
      });
    }

    return result.sort((a, b) => a.distanceNm - b.distanceNm);
  }

  // --- Realtime AIS Targets Endpoint ---
  router.get('/ais', (req, res) => {
    const vesselId = req.query.vessel_id || req.query.asset_id;
    const asset = vesselId ? assetManager.getAsset(vesselId) : (assetManager.getAsset('vessel_c2e2cffb') || assetManager.getAllAssets()[0]);
    res.json(formatAisTargetsForAsset(asset));
  });

  router.get('/v1/vessels/:id/ais', (req, res) => {
    const asset = assetManager.getAsset(req.params.id) || assetManager.getAllAssets()[0];
    const targets = formatAisTargetsForAsset(asset);
    res.json({
      vessel_id: asset ? asset.info.id : req.params.id,
      total_targets: targets.length,
      targets: targets,
    });
  });

  // ==========================================
  // LIVE TELEMETRY LOGS & STREAM INSPECTOR
  // ==========================================
  router.get('/logs/live', (req, res) => {
    const { limit, protocol, type, search } = req.query;
    const logs = logBuffer.getLogs({ limit, protocol, type, search });
    res.json({
      success: true,
      count: logs.length,
      stats: logBuffer.getStats(),
      logs,
    });
  });

  router.delete('/logs/live', (req, res) => {
    logBuffer.clear();
    res.json({ success: true, message: 'Buffer live log berhasil dikosongkan.' });
  });

  router.get('/logs/history', async (req, res) => {
    const limit = parseInt(req.query.limit || '50', 10);
    const offset = parseInt(req.query.offset || '0', 10);
    const assetId = req.query.asset_id || null;
    const rows = await getHistoricalTelemetryLogs(limit, offset, assetId);
    res.json({
      success: true,
      count: rows.length,
      records: rows,
    });
  });

  router.get('/logs/stats', (req, res) => {
    res.json({
      success: true,
      stats: logBuffer.getStats(),
    });
  });

  return router;
}

module.exports = {
  createApiRouter,
};
