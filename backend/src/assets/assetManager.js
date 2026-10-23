/**
 * Asset Manager
 * Mengelola digital twin dari setiap Asset (Kapal/Sensor) yang terdaftar di sistem.
 */

const crypto = require('crypto');
const { VesselState } = require('../state/vesselState');
const { pool } = require('../db/pool');
const { getLatestTelemetry } = require('../db/telemetryRepo');

/**
 * Menghasilkan ID unik acak terstruktur untuk kapal
 * Format: vessel_ + 8 karakter hex acak (contoh: vessel_c2e2cffb)
 */
function generateVesselId() {
  return `vessel_${crypto.randomBytes(4).toString('hex')}`;
}

class AssetManager {
  constructor() {
    // Map: assetId -> { assetInfo: Object, state: VesselState }
    this.assets = new Map();

    // Otomatis sinkronisasi ulang asset dari database saat koneksi PostgreSQL pulih
    pool.on('connect', () => {
      this.reloadFromDatabase().catch(() => {});
    });
  }

  async init(maxRetries = 10, delayMs = 1500) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const res = await pool.query('SELECT * FROM core_assets ORDER BY created_at ASC');
        if (res.rows.length === 0) {
          console.log('[ASSET MANAGER] Belum ada asset di database.');
          return true;
        }

        this.assets.clear();
        for (const row of res.rows) {
          const item = this.registerAsset(row);
          // Muat telemetri terakhir dari database
          const latest = await getLatestTelemetry(row.id).catch(() => null);
          if (latest) {
            item.state.hydrateFromSnapshot(latest);
          }
        }
        console.log(`[ASSET MANAGER] Memuat ${this.assets.size} asset kapal dari database beserta telemetri terakhir.`);
        return true;
      } catch (err) {
        if (attempt === maxRetries) {
          console.warn(`[ASSET MANAGER WARN] Gagal memuat asset awal setelah ${maxRetries} percobaan:`, err.message);
          // Fallback default dengan ID konsisten 'vessel_c2e2cffb' agar selalu sinkron dengan DB core_asset_attributes
          const defaultId = 'vessel_c2e2cffb';
          const item = this.registerAsset({
            id: defaultId,
            agent_id: 'agent_7a3d9b1e',
            name: 'KM Geo Tekno',
            type: 'VESSEL',
            metadata: { mmsi: '525015359', registration_code: 'KM+Geo+Tekno', register_content: 'KM_Geo_Tekno' },
          });
          const latest = await getLatestTelemetry(defaultId).catch(() => null);
          if (latest) {
            item.state.hydrateFromSnapshot(latest);
          }
          return false;
        }
        console.log(`[ASSET MANAGER] Menunggu database siap (Percobaan ${attempt}/${maxRetries})...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  async reloadFromDatabase() {
    try {
      const res = await pool.query('SELECT * FROM core_assets ORDER BY created_at ASC');
      if (res.rows.length > 0) {
        for (const row of res.rows) {
          const item = this.registerAsset(row);
          const latest = await getLatestTelemetry(row.id).catch(() => null);
          if (latest && item.state.latitude === null) {
            item.state.hydrateFromSnapshot(latest);
          }
        }
        console.log(`[ASSET MANAGER] Sinkronisasi ulang ${res.rows.length} asset kapal dari database selesai.`);
      }
    } catch (err) {
      // ignore
    }
  }

  registerAsset(assetRow) {
    let existing = this.assets.get(assetRow.id);
    if (!existing) {
      existing = {
        info: assetRow,
        state: new VesselState(),
      };
      this.assets.set(assetRow.id, existing);
    } else {
      existing.info = assetRow;
    }
    return existing;
  }

  findAssetByCodeOrName(query) {
    if (!query) return null;
    const qClean = query.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const [id, item] of this.assets.entries()) {
      const meta = item.info.metadata || {};
      const regCode = (meta.register_content || meta.registerContent || meta.registration_code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (regCode && (regCode === qClean || qClean.includes(regCode) || regCode.includes(qClean))) {
        return item;
      }

      const nameClean = (item.info.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (nameClean && (nameClean === qClean || nameClean.includes(qClean) || qClean.includes(nameClean))) {
        return item;
      }

      const idClean = (item.info.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (idClean && (idClean === qClean || idClean.includes(qClean) || qClean.includes(idClean))) {
        return item;
      }
    }

    return this.assets.values().next().value || null;
  }

  getAsset(assetId) {
    return this.assets.get(assetId);
  }

  getAllAssets() {
    const list = [];
    for (const [id, item] of this.assets.entries()) {
      list.push({
        ...item.info,
        status: item.state.totalFrames > 0 ? 'ACTIVE' : 'IDLE',
        live_snapshot: item.state.getSnapshot(),
      });
    }
    return list;
  }

  async createAsset({ id, agent_id, name, type = 'VESSEL', company_id = 'comp_geotekno', metadata = {} }) {
    const assetId = id || generateVesselId();
    const compId = company_id || 'comp_geotekno';
    await pool.query(
      `INSERT INTO core_assets (id, agent_id, name, type, company_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET name = $3, agent_id = $2, company_id = $5, metadata = $6`,
      [assetId, agent_id, name, type, compId, JSON.stringify(metadata)]
    );

    const assetRow = { id: assetId, agent_id, name, type, company_id: compId, metadata };
    return this.registerAsset(assetRow);
  }

  async updateAsset(assetId, { name, agent_id, type, company_id, metadata }) {
    const existing = this.assets.get(assetId);
    if (!existing) {
      throw new Error(`Asset ${assetId} tidak ditemukan`);
    }

    const newName = name !== undefined ? name : existing.info.name;
    const newAgentId = agent_id !== undefined ? agent_id : existing.info.agent_id;
    const newType = type !== undefined ? type : existing.info.type;
    const newCompanyId = company_id !== undefined ? company_id : (existing.info.company_id || 'comp_geotekno');
    const newMetadata = metadata !== undefined ? metadata : existing.info.metadata;

    await pool.query(
      `UPDATE core_assets 
       SET name = $1, agent_id = $2, type = $3, company_id = $4, metadata = $5 
       WHERE id = $6`,
      [newName, newAgentId, newType, newCompanyId, JSON.stringify(newMetadata), assetId]
    );

    const assetRow = {
      id: assetId,
      name: newName,
      agent_id: newAgentId,
      type: newType,
      company_id: newCompanyId,
      metadata: newMetadata,
    };
    return this.registerAsset(assetRow);
  }

  async deleteAsset(assetId) {
    await pool.query('DELETE FROM core_assets WHERE id = $1', [assetId]);
    this.assets.delete(assetId);
    return true;
  }

  async updateOwnShipIdentifiers(assetId, { mmsi, callsign, imo }) {
    const item = this.assets.get(assetId);
    if (!item) return;
    let changed = false;
    const currentMeta = item.info.metadata || {};

    if (mmsi && (!currentMeta.mmsi || currentMeta.mmsi === '' || currentMeta.mmsi !== String(mmsi))) {
      currentMeta.mmsi = String(mmsi);
      changed = true;
    }
    if (callsign && callsign.trim() && (!currentMeta.callsign || currentMeta.callsign !== String(callsign).trim())) {
      currentMeta.callsign = String(callsign).trim();
      currentMeta.callSign = String(callsign).trim();
      changed = true;
    }
    if (imo && (!currentMeta.imo || currentMeta.imo === '' || currentMeta.imo !== String(imo))) {
      currentMeta.imo = String(imo);
      changed = true;
    }
    if (destination && destination.trim() && (!currentMeta.destination || currentMeta.destination !== destination.trim())) {
      currentMeta.destination = destination.trim();
      changed = true;
    }

    if (changed) {
      item.info.metadata = currentMeta;
      try {
        await pool.query('UPDATE core_assets SET metadata = $1 WHERE id = $2', [JSON.stringify(currentMeta), assetId]);
        console.log(`[ASSET MANAGER] Auto-updated Identifiers untuk ${item.info.name} (${assetId}): MMSI=${currentMeta.mmsi || '-'}, CallSign=${currentMeta.callsign || '-'}, IMO=${currentMeta.imo || '-'}, Destination=${currentMeta.destination || '-'}`);
      } catch (err) {
        console.warn('[ASSET MANAGER WARN] Gagal menyimpan auto-update identifiers:', err.message);
      }
    }
  }

  async getAttributes(assetId) {
    let targetId = assetId;
    let assetItem = this.assets.get(targetId);
    if (!assetItem) {
      assetItem = this.assets.get('vessel_c2e2cffb') || this.assets.values().next().value || null;
      if (assetItem) targetId = assetItem.info.id;
    }

    // Ambil data telemetri historis terakhir dari database jika ada
    const latestDb = (await getLatestTelemetry(targetId).catch(() => null)) ||
                     (await getLatestTelemetry('vessel_c2e2cffb').catch(() => null));

    // Jika assetItem belum memiliki posisi (latitude null), hydrate dari data database terakhir
    if (assetItem && latestDb && assetItem.state.latitude === null) {
      assetItem.state.hydrateFromSnapshot(latestDb);
    }

    const snap = assetItem ? assetItem.state.getSnapshot() : null;

    let res = await pool.query(
      'SELECT * FROM core_asset_attributes WHERE asset_id = $1 ORDER BY namespace ASC, display_name ASC',
      [targetId]
    );

    // Jika belum ada atribut untuk targetId ini, fallback ke default kapal utama
    if (res.rows.length === 0 && targetId !== 'vessel_c2e2cffb') {
      res = await pool.query(
        'SELECT * FROM core_asset_attributes WHERE asset_id = $1 ORDER BY namespace ASC, display_name ASC',
        ['vessel_c2e2cffb']
      );
    }

    return res.rows.map((row) => {
      let liveVal = resolveAttributeLiveValue(snap, row.namespace, row.key_name);
      let isFromDb = false;

      // JIKA NILAI DI LIVE SNAPSHOT KOSONG/NULL, OTOMATIS AMBIL DARI DATA TERAKHIR DATABASE
      if ((liveVal === null || liveVal === undefined) && latestDb) {
        const dbVal = resolveAttributeLiveValue(latestDb, row.namespace, row.key_name);
        if (dbVal !== null && dbVal !== undefined) {
          liveVal = dbVal;
          isFromDb = true;
        }
      }

      const isLiveNow = !isFromDb && liveVal !== null && (assetItem?.state?.totalFrames > 0);
      const sourceVal = row.pointing_source || row.pgn_source || '';

      let status = 'offline';
      if (isLiveNow) {
        status = 'live';
      } else if (liveVal !== null && liveVal !== undefined) {
        status = 'stale'; // Nilai terakhir yang diketahui (Last known value)
      }

      return {
        id: String(row.id),
        assetId: row.asset_id,
        namespace: row.namespace,
        keyName: row.key_name,
        displayName: row.display_name,
        unit: row.unit || '',
        pointingSource: sourceVal,
        pgnSource: sourceVal,
        liveValue: liveVal,
        status: status,
      };
    });
  }

  async createAttribute(assetId, { namespace, key_name, display_name, unit, pointing_source, pgn_source }) {
    const sourceVal = pointing_source || pgn_source || '';
    const res = await pool.query(
      `INSERT INTO core_asset_attributes (asset_id, namespace, key_name, display_name, unit, pointing_source)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [assetId, namespace, key_name, display_name, unit || '', sourceVal]
    );
    const row = res.rows[0];
    const savedSource = row.pointing_source || row.pgn_source || '';
    return {
      id: String(row.id),
      assetId: row.asset_id,
      namespace: row.namespace,
      keyName: row.key_name,
      displayName: row.display_name,
      unit: row.unit || '',
      pointingSource: savedSource,
      pgnSource: savedSource,
      liveValue: null,
      status: 'offline',
    };
  }

  async updateAttribute(attrId, { namespace, key_name, display_name, unit, pointing_source, pgn_source }) {
    const sourceVal = pointing_source !== undefined ? pointing_source : pgn_source;
    const res = await pool.query(
      `UPDATE core_asset_attributes
       SET namespace = COALESCE($1, namespace),
           key_name = COALESCE($2, key_name),
           display_name = COALESCE($3, display_name),
           unit = COALESCE($4, unit),
           pointing_source = COALESCE($5, pointing_source)
       WHERE id = $6
       RETURNING *`,
      [namespace, key_name, display_name, unit, sourceVal, attrId]
    );
    if (res.rows.length === 0) throw new Error(`Attribute ${attrId} tidak ditemukan`);
    const row = res.rows[0];
    const savedSource = row.pointing_source || row.pgn_source || '';
    return {
      id: String(row.id),
      assetId: row.asset_id,
      namespace: row.namespace,
      keyName: row.key_name,
      displayName: row.display_name,
      unit: row.unit || '',
      pointingSource: savedSource,
      pgnSource: savedSource,
      liveValue: null,
      status: 'offline',
    };
  }

  async deleteAttribute(attrId) {
    await pool.query('DELETE FROM core_asset_attributes WHERE id = $1', [attrId]);
    return true;
  }

  async scanAvailableSignals(assetId) {
    const registered = await this.getAttributes(assetId);
    const registeredKeys = new Set(registered.map((r) => `${r.namespace}.${r.keyName}`));

    const potentialSignals = [
      { namespace: 'navigation', keyName: 'stw', displayName: 'Speed Through Water (STW)', unit: 'kn', pointingSource: 'PGN 128259 DST810', pgnSource: 'PGN 128259 DST810' },
      { namespace: 'navigation', keyName: 'log_distance', displayName: 'Total Distance Log', unit: 'NM', pointingSource: 'PGN 128275 DST810', pgnSource: 'PGN 128275 DST810' },
      { namespace: 'navigation', keyName: 'trip_distance', displayName: 'Trip Distance Log', unit: 'NM', pointingSource: 'PGN 128275 DST810', pgnSource: 'PGN 128275 DST810' },
      { namespace: 'navigation', keyName: 'altitude', displayName: 'Antenna Altitude', unit: 'm', pointingSource: 'PGN 129029 GNSS', pgnSource: 'PGN 129029 GNSS' },
      { namespace: 'navigation', keyName: 'hdop', displayName: 'Horizontal Dilution of Precision', unit: 'HDOP', pointingSource: 'PGN 129029 GNSS', pgnSource: 'PGN 129029 GNSS' },
      { namespace: 'motion', keyName: 'pitch', displayName: 'Vessel Pitch / Trim Angle', unit: 'deg', pointingSource: 'PGN 127257 Attitude', pgnSource: 'PGN 127257 Attitude' },
      { namespace: 'motion', keyName: 'roll', displayName: 'Vessel Roll / Heel Angle', unit: 'deg', pointingSource: 'PGN 127257 Attitude', pgnSource: 'PGN 127257 Attitude' },
      { namespace: 'environment', keyName: 'baro_pressure', displayName: 'Barometric Atmospheric Pressure', unit: 'hPa', pointingSource: 'PGN 130311 Pressure', pgnSource: 'PGN 130311 Pressure' },
      { namespace: 'environment', keyName: 'air_temp', displayName: 'Ambient Air Temperature', unit: '°C', pointingSource: 'PGN 130310 Temp', pgnSource: 'PGN 130310 Temp' },
      { namespace: 'engine', keyName: 'coolant_temp', displayName: 'Engine Coolant Temperature', unit: '°C', pointingSource: 'PGN 127489 Dynamic Engine', pgnSource: 'PGN 127489 Dynamic Engine' },
      { namespace: 'engine', keyName: 'oil_pressure', displayName: 'Engine Oil Pressure', unit: 'kPa', pointingSource: 'PGN 127489 Dynamic Engine', pgnSource: 'PGN 127489 Dynamic Engine' },
      { namespace: 'engine', keyName: 'engine_hours', displayName: 'Total Engine Operating Hours', unit: 'hrs', pointingSource: 'PGN 127489 Engine Hours', pgnSource: 'PGN 127489 Engine Hours' },
      { namespace: 'electrical', keyName: 'battery_current', displayName: 'DC Battery Bank Current', unit: 'A', pointingSource: 'PGN 127508 Battery Status', pgnSource: 'PGN 127508 Battery Status' },
    ];

    // Sertakan sinyal dinamis yang terdeteksi dari Custom Decoder Script
    const targetAsset = this.assets.get(assetId);
    if (targetAsset && targetAsset.state) {
      const snap = targetAsset.state.getSnapshot();
      if (snap && snap.custom) {
        for (const [cKey, cVal] of Object.entries(snap.custom)) {
          potentialSignals.push({
            namespace: 'custom',
            keyName: cKey,
            displayName: cKey.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
            unit: typeof cVal === 'number' ? 'val' : '',
            pointingSource: 'Custom Decoder Script',
            pgnSource: 'Custom Decoder Script',
          });
        }
      }
    }

    return potentialSignals.filter((p) => !registeredKeys.has(`${p.namespace}.${p.keyName}`));
  }
}

function resolveAttributeLiveValue(snap, namespace, keyName) {
  if (!snap) return null;
  const ns = (namespace || '').toLowerCase();
  const k = (keyName || '').toLowerCase();

  if (ns === 'navigation') {
    if (k === 'position' || k === 'coordinates') {
      if (snap.navigation && snap.navigation.latitude !== null && snap.navigation.longitude !== null &&
          snap.navigation.latitude !== undefined && snap.navigation.longitude !== undefined) {
        return `${snap.navigation.latitude.toFixed(4)}, ${snap.navigation.longitude.toFixed(4)}`;
      }
      return null;
    }
    if (k === 'sog') return (snap.navigation && snap.navigation.sog_knots !== null && snap.navigation.sog_knots !== undefined) ? parseFloat(snap.navigation.sog_knots.toFixed(1)) : null;
    if (k === 'stw' || k === 'speed_through_water') return (snap.environment && snap.environment.stw_knots !== null && snap.environment.stw_knots !== undefined) ? parseFloat(snap.environment.stw_knots.toFixed(1)) : null;
    if (k === 'log_distance' || k === 'log_nm') return (snap.environment && snap.environment.log_nm !== null && snap.environment.log_nm !== undefined) ? parseFloat(snap.environment.log_nm.toFixed(2)) : null;
    if (k === 'trip_distance' || k === 'trip_log_nm') return (snap.environment && snap.environment.trip_log_nm !== null && snap.environment.trip_log_nm !== undefined) ? parseFloat(snap.environment.trip_log_nm.toFixed(2)) : null;
    if (k === 'cog') return (snap.navigation && snap.navigation.cog_deg !== null && snap.navigation.cog_deg !== undefined) ? Math.round(snap.navigation.cog_deg) : null;
    if (k === 'altitude') return (snap.navigation && snap.navigation.altitude_m !== null && snap.navigation.altitude_m !== undefined) ? parseFloat(snap.navigation.altitude_m.toFixed(1)) : null;
    if (k === 'satellites') return (snap.navigation && snap.navigation.satellites !== null && snap.navigation.satellites !== undefined) ? snap.navigation.satellites : null;
    if (k === 'hdop') return (snap.navigation && snap.navigation.hdop !== null && snap.navigation.hdop !== undefined) ? parseFloat(snap.navigation.hdop.toFixed(2)) : null;
  }

  if (ns === 'motion') {
    if (k === 'heading') return (snap.motion && snap.motion.heading_deg !== null && snap.motion.heading_deg !== undefined) ? Math.round(snap.motion.heading_deg) : null;
    if (k === 'rate_of_turn' || k === 'rot') return (snap.motion && snap.motion.rot_deg_s !== null && snap.motion.rot_deg_s !== undefined) ? parseFloat(snap.motion.rot_deg_s.toFixed(1)) : null;
    if (k === 'pitch') return (snap.motion && snap.motion.pitch_deg !== null && snap.motion.pitch_deg !== undefined) ? parseFloat(snap.motion.pitch_deg.toFixed(1)) : null;
    if (k === 'roll') return (snap.motion && snap.motion.roll_deg !== null && snap.motion.roll_deg !== undefined) ? parseFloat(snap.motion.roll_deg.toFixed(1)) : null;
  }

  if (ns === 'environment') {
    if (k === 'depth') return (snap.environment && snap.environment.depth_m !== null && snap.environment.depth_m !== undefined) ? parseFloat(snap.environment.depth_m.toFixed(1)) : null;
    if (k === 'wind_speed') return (snap.environment && snap.environment.wind_speed_kn !== null && snap.environment.wind_speed_kn !== undefined) ? parseFloat(snap.environment.wind_speed_kn.toFixed(1)) : null;
    if (k === 'wind_angle') return (snap.environment && snap.environment.wind_angle_deg !== null && snap.environment.wind_angle_deg !== undefined) ? Math.round(snap.environment.wind_angle_deg) : null;
    if (k === 'water_temp') return (snap.environment && snap.environment.water_temp_c !== null && snap.environment.water_temp_c !== undefined) ? parseFloat(snap.environment.water_temp_c.toFixed(1)) : null;
    if (k === 'air_temp') return (snap.environment && snap.environment.air_temp_c !== null && snap.environment.air_temp_c !== undefined) ? parseFloat(snap.environment.air_temp_c.toFixed(1)) : null;
    if (k === 'baro_pressure') return (snap.environment && snap.environment.baro_pressure_hpa !== null && snap.environment.baro_pressure_hpa !== undefined) ? snap.environment.baro_pressure_hpa : null;
  }

  if (ns === 'engine' || ns === 'propulsion') {
    if (k === 'rpm') return (snap.engine && snap.engine.engine_rpm !== null && snap.engine.engine_rpm !== undefined) ? Math.round(snap.engine.engine_rpm) : null;
    if (k === 'battery_volts') return (snap.engine && snap.engine.battery_volts !== null && snap.engine.battery_volts !== undefined) ? parseFloat(snap.engine.battery_volts.toFixed(1)) : null;
    if (k === 'boost_pressure' || k === 'boost_kpa') return (snap.engine && snap.engine.boost_kpa !== null && snap.engine.boost_kpa !== undefined) ? snap.engine.boost_kpa : null;
  }

  if (ns === 'electrical') {
    if (k === 'battery_volts') return (snap.engine && snap.engine.battery_volts !== null && snap.engine.battery_volts !== undefined) ? parseFloat(snap.engine.battery_volts.toFixed(1)) : null;
    if (k === 'battery_current' || k === 'battery_amps') return (snap.engine && snap.engine.battery_amps !== null && snap.engine.battery_amps !== undefined) ? parseFloat(snap.engine.battery_amps.toFixed(1)) : null;
    if (k === 'battery_temp' || k === 'battery_temp_c') return (snap.engine && snap.engine.battery_temp_c !== null && snap.engine.battery_temp_c !== undefined) ? parseFloat(snap.engine.battery_temp_c.toFixed(1)) : null;
  }

  // Cek Custom Attributes dari Script Decoder
  if (snap.custom) {
    if (snap.custom[keyName] !== undefined && snap.custom[keyName] !== null) return snap.custom[keyName];
    if (snap.custom[k] !== undefined && snap.custom[k] !== null) return snap.custom[k];
  }

  return null;
}

const assetManager = new AssetManager();

module.exports = {
  assetManager,
};
