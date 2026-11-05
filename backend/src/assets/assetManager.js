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
    return null;
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

  async updateOwnShipIdentifiers(assetId, { mmsi, callsign, imo, destination } = {}) {
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
      return [];
    }

    // Ambil data telemetri historis terakhir dari database kapal ini jika ada
    const latestDb = await getLatestTelemetry(targetId).catch(() => null);

    // Jika assetItem belum memiliki posisi (latitude null), hydrate dari data database terakhir miliknya sendiri
    if (assetItem && latestDb && assetItem.state.latitude === null) {
      assetItem.state.hydrateFromSnapshot(latestDb);
    }

    const snap = assetItem ? assetItem.state.getSnapshot() : null;

    const res = await pool.query(
      'SELECT * FROM core_asset_attributes WHERE asset_id = $1 ORDER BY namespace ASC, display_name ASC',
      [targetId]
    );

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

      let attrUpdatedAt = null;
      if (isLiveNow) {
        attrUpdatedAt = snap?.timestamp_utc || new Date().toISOString();
      } else if (isFromDb && latestDb) {
        attrUpdatedAt = latestDb.timestamp_utc || null;
      } else if (snap && snap.timestamp_utc) {
        attrUpdatedAt = snap.timestamp_utc;
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
        updatedAt: attrUpdatedAt,
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
    const registeredKeys = new Set();
    for (const r of registered) {
      const ns = (r.namespace || '').toLowerCase();
      const k = (r.keyName || '').toLowerCase();
      registeredKeys.add(`${ns}.${k}`);

      // Aliases normalizer agar tidak mendeteksi duplikat
      if (ns === 'navigation') {
        if (['position', 'coordinates', 'lat', 'lon', 'latitude', 'longitude'].includes(k)) {
          registeredKeys.add('navigation.position');
          registeredKeys.add('navigation.coordinates');
          registeredKeys.add('navigation.latitude');
          registeredKeys.add('navigation.longitude');
        }
        if (['sog', 'sog_knots', 'speed'].includes(k)) {
          registeredKeys.add('navigation.sog');
          registeredKeys.add('navigation.sog_knots');
        }
        if (['cog', 'cog_deg', 'course'].includes(k)) {
          registeredKeys.add('navigation.cog');
          registeredKeys.add('navigation.cog_deg');
        }
        if (['stw', 'stw_knots', 'speed_through_water'].includes(k)) {
          registeredKeys.add('navigation.stw');
          registeredKeys.add('navigation.stw_knots');
        }
        if (['altitude', 'altitude_m'].includes(k)) {
          registeredKeys.add('navigation.altitude');
          registeredKeys.add('navigation.altitude_m');
        }
        if (['log_distance', 'log_nm'].includes(k)) {
          registeredKeys.add('navigation.log_distance');
          registeredKeys.add('navigation.log_nm');
        }
        if (['trip_distance', 'trip_log_nm'].includes(k)) {
          registeredKeys.add('navigation.trip_distance');
          registeredKeys.add('navigation.trip_log_nm');
        }
      } else if (ns === 'motion') {
        if (['heading', 'heading_deg'].includes(k)) {
          registeredKeys.add('motion.heading');
          registeredKeys.add('motion.heading_deg');
        }
        if (['rot', 'rot_deg_s', 'rate_of_turn'].includes(k)) {
          registeredKeys.add('motion.rot');
          registeredKeys.add('motion.rot_deg_s');
        }
        if (['pitch', 'pitch_deg'].includes(k)) {
          registeredKeys.add('motion.pitch');
          registeredKeys.add('motion.pitch_deg');
        }
        if (['roll', 'roll_deg'].includes(k)) {
          registeredKeys.add('motion.roll');
          registeredKeys.add('motion.roll_deg');
        }
      } else if (ns === 'environment') {
        if (['depth', 'depth_m', 'depth_ft'].includes(k)) {
          registeredKeys.add('environment.depth');
          registeredKeys.add('environment.depth_m');
        }
        if (['wind_speed', 'wind_speed_kn'].includes(k)) {
          registeredKeys.add('environment.wind_speed');
          registeredKeys.add('environment.wind_speed_kn');
        }
        if (['wind_angle', 'wind_angle_deg'].includes(k)) {
          registeredKeys.add('environment.wind_angle');
          registeredKeys.add('environment.wind_angle_deg');
        }
        if (['water_temp', 'water_temp_c'].includes(k)) {
          registeredKeys.add('environment.water_temp');
          registeredKeys.add('environment.water_temp_c');
        }
        if (['air_temp', 'air_temp_c'].includes(k)) {
          registeredKeys.add('environment.air_temp');
          registeredKeys.add('environment.air_temp_c');
        }
        if (['baro_pressure', 'baro_pressure_hpa'].includes(k)) {
          registeredKeys.add('environment.baro_pressure');
          registeredKeys.add('environment.baro_pressure_hpa');
        }
      } else if (ns === 'engine' || ns === 'propulsion' || ns === 'machinery') {
        if (['rpm', 'engine_rpm'].includes(k)) {
          registeredKeys.add('engine.rpm');
          registeredKeys.add('engine.engine_rpm');
          registeredKeys.add('machinery.rpm');
        }
        if (['boost', 'boost_kpa'].includes(k)) {
          registeredKeys.add('engine.boost');
          registeredKeys.add('engine.boost_kpa');
          registeredKeys.add('machinery.boost_kpa');
        }
        if (['fuel_flow_rate', 'flowrate', 'flow_rate'].includes(k)) {
          registeredKeys.add('machinery.fuel_flow_rate');
          registeredKeys.add('custom.fuel_flow_rate');
        }
        if (['fuel_total_volume', 'totalvolume', 'total_volume'].includes(k)) {
          registeredKeys.add('machinery.fuel_total_volume');
          registeredKeys.add('custom.fuel_total_volume');
        }
        if (['fuel_total_mass', 'totalmass', 'total_mass'].includes(k)) {
          registeredKeys.add('machinery.fuel_total_mass');
          registeredKeys.add('custom.fuel_total_mass');
        }
        if (['fuel_density', 'density'].includes(k)) {
          registeredKeys.add('machinery.fuel_density');
          registeredKeys.add('custom.fuel_density');
        }
        if (['fuel_temperature', 'fuel_temp', 'temperature'].includes(k)) {
          registeredKeys.add('machinery.fuel_temperature');
          registeredKeys.add('custom.fuel_temperature');
        }
      } else if (ns === 'electrical') {
        if (['battery_volts', 'voltage'].includes(k)) {
          registeredKeys.add('electrical.battery_volts');
        }
        if (['battery_current', 'battery_amps', 'amps'].includes(k)) {
          registeredKeys.add('electrical.battery_current');
        }
        if (['battery_temp', 'battery_temp_c'].includes(k)) {
          registeredKeys.add('electrical.battery_temp');
        }
      }
    }

    const targetAsset = this.assets.get(assetId);
    if (!targetAsset || !targetAsset.state) {
      return [];
    }

    const state = targetAsset.state;

    // HANYA PINDAI JIKA KAPAL MEMILIKI STREAM DATA LIVE DARI AGENT
    if (!state.lastDataReceivedAt) {
      return [];
    }

    const activePgns = new Set();
    if (state.devices) {
      for (const dev of state.devices.values()) {
        if (dev.pgns) {
          for (const p of dev.pgns) activePgns.add(p);
        }
      }
    }

    const liveSignals = [];

    const addSignalIfLive = (ns, key, displayName, unit, condition, pgnHint, fallbackSource) => {
      if (!condition) return;
      if (registeredKeys.has(`${ns.toLowerCase()}.${key.toLowerCase()}`)) return;

      let pointingSource = fallbackSource;
      if (pgnHint && activePgns.has(pgnHint)) {
        pointingSource = `PGN ${pgnHint} (Live CAN Frame)`;
      }

      liveSignals.push({
        namespace: ns,
        keyName: key,
        displayName: displayName,
        unit: unit,
        pointingSource: pointingSource,
        pgnSource: pointingSource,
      });
    };

    // 1. Navigation: hanya jika ada data nyata di state live kapal
    if (state.latitude !== null && state.longitude !== null && state.latitude !== undefined && state.longitude !== undefined) {
      addSignalIfLive('navigation', 'coordinates', 'GNSS Coordinates', 'lat,lon', true, 129025, 'Live GPS Stream');
    }
    if (state.sog_knots !== null && state.sog_knots !== undefined) {
      addSignalIfLive('navigation', 'sog', 'Speed Over Ground (SOG)', 'kn', true, 129026, 'Live Speed Sensor');
    }
    if (state.cog_deg !== null && state.cog_deg !== undefined) {
      addSignalIfLive('navigation', 'cog', 'Course Over Ground (COG)', 'deg', true, 129026, 'Live Course Sensor');
    }
    if (state.altitude_m !== null && state.altitude_m !== undefined) {
      addSignalIfLive('navigation', 'altitude', 'Antenna Altitude', 'm', true, 129029, 'Live GNSS Fix');
    }
    if (state.satellites !== null && state.satellites !== undefined) {
      addSignalIfLive('navigation', 'satellites', 'Satellites In View', 'sats', true, 129029, 'Live GNSS Fix');
    }
    if (state.hdop !== null && state.hdop !== undefined) {
      addSignalIfLive('navigation', 'hdop', 'Horizontal Dilution of Precision', 'HDOP', true, 129029, 'Live GNSS Fix');
    }
    if (state.stw_knots !== null && state.stw_knots !== undefined) {
      addSignalIfLive('navigation', 'stw', 'Speed Through Water (STW)', 'kn', true, 128259, 'Live DST810 Sensor');
    }
    if (state.log_nm !== null && state.log_nm !== undefined) {
      addSignalIfLive('navigation', 'log_distance', 'Total Distance Log', 'NM', true, 128275, 'Live Distance Log');
    }
    if (state.trip_log_nm !== null && state.trip_log_nm !== undefined) {
      addSignalIfLive('navigation', 'trip_distance', 'Trip Distance Log', 'NM', true, 128275, 'Live Distance Log');
    }

    // 2. Motion: hanya jika ada data nyata di state live kapal
    if (state.heading_deg !== null && state.heading_deg !== undefined) {
      addSignalIfLive('motion', 'heading', 'Magnetic / True Heading', 'deg', true, 127250, 'Live Compass Heading');
    }
    if (state.rot_deg_s !== null && state.rot_deg_s !== undefined) {
      addSignalIfLive('motion', 'rot', 'Rate of Turn (ROT)', 'deg/s', true, 127251, 'Live Gyro Sensor');
    }
    if (state.pitch_deg !== null && state.pitch_deg !== undefined) {
      addSignalIfLive('motion', 'pitch', 'Vessel Pitch / Trim Angle', 'deg', true, 127257, 'Live Attitude Sensor');
    }
    if (state.roll_deg !== null && state.roll_deg !== undefined) {
      addSignalIfLive('motion', 'roll', 'Vessel Roll / Heel Angle', 'deg', true, 127257, 'Live Attitude Sensor');
    }

    // 3. Environment: hanya jika ada data nyata di state live kapal
    if (state.depth_m !== null && state.depth_m !== undefined) {
      addSignalIfLive('environment', 'depth', 'Water Depth Below Keel', 'm', true, 128267, 'Live Depth Sounder');
    }
    if (state.wind_speed_kn !== null && state.wind_speed_kn !== undefined) {
      addSignalIfLive('environment', 'wind_speed', 'Apparent Wind Speed', 'kn', true, 130306, 'Live Anemometer');
    }
    if (state.wind_angle_deg !== null && state.wind_angle_deg !== undefined) {
      addSignalIfLive('environment', 'wind_angle', 'Apparent Wind Angle', 'deg', true, 130306, 'Live Wind Vane');
    }
    if (state.water_temp_c !== null && state.water_temp_c !== undefined) {
      addSignalIfLive('environment', 'water_temp', 'Sea Water Temperature', '°C', true, 130310, 'Live Water Temp Sensor');
    }
    if (state.air_temp_c !== null && state.air_temp_c !== undefined) {
      addSignalIfLive('environment', 'air_temp', 'Ambient Air Temperature', '°C', true, 130310, 'Live Air Temp Sensor');
    }
    if (state.baro_pressure_hpa !== null && state.baro_pressure_hpa !== undefined) {
      addSignalIfLive('environment', 'baro_pressure', 'Barometric Atmospheric Pressure', 'hPa', true, 130311, 'Live Barometer');
    }

    // 4. Engine & Electrical: hanya jika ada data nyata di state live kapal
    if (state.engine_rpm !== null && state.engine_rpm !== undefined) {
      addSignalIfLive('engine', 'rpm', 'Engine Speed', 'RPM', true, 127488, 'Live Dynamic Engine');
    }
    if (state.boost_kpa !== null && state.boost_kpa !== undefined) {
      addSignalIfLive('engine', 'boost_kpa', 'Turbo Boost Pressure', 'kPa', true, 127488, 'Live Dynamic Engine');
    }
    if (state.battery_volts !== null && state.battery_volts !== undefined) {
      addSignalIfLive('electrical', 'battery_volts', 'DC Battery Bank Voltage', 'V', true, 127508, 'Live Battery Monitor');
    }
    if (state.battery_amps !== null && state.battery_amps !== undefined) {
      addSignalIfLive('electrical', 'battery_current', 'DC Battery Bank Current', 'A', true, 127508, 'Live Battery Shunt');
    }
    if (state.battery_temp_c !== null && state.battery_temp_c !== undefined) {
      addSignalIfLive('electrical', 'battery_temp', 'Battery Temperature', '°C', true, 127508, 'Live Battery Monitor');
    }

    // 5. Custom Attributes dari Script Decoder (Hanya yang benar-benar ada nilainya di live payload dan belum terdaftar di namespace apapun)
    if (state.customAttributes && state.customAttributes.size > 0) {
      for (const [cKey, cVal] of state.customAttributes.entries()) {
        const lowerK = cKey.toLowerCase();
        if (
          cVal !== null &&
          cVal !== undefined &&
          !registeredKeys.has(`custom.${lowerK}`) &&
          !registeredKeys.has(`machinery.${lowerK}`) &&
          !registeredKeys.has(`engine.${lowerK}`) &&
          !registeredKeys.has(`navigation.${lowerK}`) &&
          !registeredKeys.has(`environment.${lowerK}`) &&
          !registeredKeys.has(`motion.${lowerK}`)
        ) {
          liveSignals.push({
            namespace: 'custom',
            keyName: cKey,
            displayName: cKey.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
            unit: typeof cVal === 'number' ? 'val' : '',
            pointingSource: 'Custom Decoder Live Stream',
            pgnSource: 'Custom Decoder Live Stream',
          });
        }
      }
    }

    return liveSignals;
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
