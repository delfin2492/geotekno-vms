const { pool } = require('./pool');

/**
 * Menyimpan snapshot telemetri kapal ke tabel-tabel ternormalisasi di PostgreSQL
 * @param {Object} snap - Snapshot dari vesselState.getSnapshot()
 */
async function saveTelemetrySnapshot(snap, assetId = 'vessel_primary') {
  const nav = snap.navigation;
  const mot = snap.motion;
  const env = snap.environment;

  if (nav.latitude === null && mot.heading_deg === null && env.wind_speed_kn === null) {
    return;
  }

  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    return;
  }

  try {
    await client.query('BEGIN');

    // 1. Simpan GPS
    if (nav.latitude !== null && nav.longitude !== null) {
      const geomSql = 'ST_SetSRID(ST_MakePoint($5, $4), 4326)';
      await client.query(
        `INSERT INTO tbl_telemetry_gps (
          asset_id, timestamp_utc, timestamp_local, latitude, longitude, geom,
          altitude_m, sog_knots, sog_kmh, cog_deg, satellites, hdop, pdop, gnss_fix
        ) VALUES (
          $1, $2, $3, $4, $5, ${geomSql}, $6, $7, $8, $9, $10, $11, $12, $13
        )`,
        [
          assetId,
          snap.timestamp_utc,
          snap.timestamp_local,
          nav.latitude,
          nav.longitude,
          nav.altitude_m,
          nav.sog_knots,
          nav.sog_kmh,
          nav.cog_deg,
          nav.satellites,
          nav.hdop,
          nav.pdop,
          nav.gnss_fix,
        ]
      );
    }

    // 2. Simpan Motion
    if (mot.heading_deg !== null || mot.pitch_deg !== null || mot.roll_deg !== null) {
      await client.query(
        `INSERT INTO tbl_telemetry_motion (
          asset_id, timestamp_utc, timestamp_local, heading_deg, heading_ref, rot_deg_s, pitch_deg, roll_deg
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          assetId,
          snap.timestamp_utc,
          snap.timestamp_local,
          mot.heading_deg,
          mot.heading_ref,
          mot.rot_deg_s,
          mot.pitch_deg,
          mot.roll_deg,
        ]
      );
    }

    // 3. Simpan Environment
    if (env.wind_speed_kn !== null || env.depth_m !== null || env.water_temp_c !== null) {
      await client.query(
        `INSERT INTO tbl_telemetry_environment (
          asset_id, timestamp_utc, timestamp_local, wind_speed_kn, wind_angle_deg, wind_ref,
          depth_m, water_temp_c, air_temp_c, baro_pressure_hpa
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          assetId,
          snap.timestamp_utc,
          snap.timestamp_local,
          env.wind_speed_kn,
          env.wind_angle_deg,
          env.wind_ref,
          env.depth_m,
          env.water_temp_c,
          env.air_temp_c,
          env.baro_pressure_hpa,
        ]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    // Silently log or ignore intermittent db lock
  } finally {
    client.release();
  }
}

/**
 * Mengambil histori titik track kapal untuk digambar di peta
 * @param {number} limit - Jumlah titik terakhir (default: 500)
 * @param {string|null} assetId - ID Asset kapal (opsional)
 */
async function getRecentTrack(limit = 500, assetId = null) {
  try {
    let query;
    let params;
    if (assetId) {
      query = `SELECT
        timestamp_utc,
        latitude,
        longitude,
        sog_knots,
        cog_deg
      FROM tbl_telemetry_gps
      WHERE asset_id = $1 AND latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY timestamp_utc DESC
      LIMIT $2`;
      params = [assetId, limit];
    } else {
      query = `SELECT
        timestamp_utc,
        latitude,
        longitude,
        sog_knots,
        cog_deg
      FROM tbl_telemetry_gps
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY timestamp_utc DESC
      LIMIT $1`;
      params = [limit];
    }
    const res = await pool.query(query, params);
    // Kembalikan dalam urutan kronologis ascending untuk garis polyline
    return res.rows.reverse();
  } catch (err) {
    return [];
  }
}

/**
 * Mengambil data telemetri terakhir yang tersimpan di PostgreSQL untuk sebuah asset
 * @param {string} assetId
 */
async function getLatestTelemetry(assetId = null) {
  try {
    const gpsRes = await pool.query(
      `SELECT latitude, longitude, altitude_m, sog_knots, sog_kmh, cog_deg, satellites, hdop, pdop, gnss_fix, timestamp_utc, timestamp_local
       FROM tbl_telemetry_gps
       WHERE (asset_id = $1 OR $1 IS NULL) AND latitude IS NOT NULL
       ORDER BY timestamp_utc DESC LIMIT 1`,
      [assetId]
    );

    const motRes = await pool.query(
      `SELECT heading_deg, heading_ref, rot_deg_s, pitch_deg, roll_deg, timestamp_utc
       FROM tbl_telemetry_motion
       WHERE (asset_id = $1 OR $1 IS NULL)
       ORDER BY timestamp_utc DESC LIMIT 1`,
      [assetId]
    );

    const envRes = await pool.query(
      `SELECT wind_speed_kn, wind_angle_deg, wind_ref, depth_m, water_temp_c, air_temp_c, baro_pressure_hpa, timestamp_utc
       FROM tbl_telemetry_environment
       WHERE (asset_id = $1 OR $1 IS NULL)
       ORDER BY timestamp_utc DESC LIMIT 1`,
      [assetId]
    );

    // Dapatkan data kedalaman laut (depth_m) terakhir jika envRes bernilai null
    let latestDepth = envRes.rows[0]?.depth_m;
    if (latestDepth === null || latestDepth === undefined) {
      const depthRes = await pool.query(
        `SELECT depth_m FROM tbl_telemetry_environment 
         WHERE (asset_id = $1 OR $1 IS NULL) AND depth_m IS NOT NULL 
         ORDER BY timestamp_utc DESC LIMIT 1`,
        [assetId]
      );
      if (depthRes.rows.length > 0) {
        latestDepth = depthRes.rows[0].depth_m;
      }
    }

    const gps = gpsRes.rows[0] || {};
    const mot = motRes.rows[0] || {};
    const env = envRes.rows[0] || {};

    const latestTs = gps.timestamp_utc || mot.timestamp_utc || env.timestamp_utc || new Date().toISOString();

    return {
      timestamp_utc: latestTs,
      timestamp_local: gps.timestamp_local || new Date(latestTs).toLocaleString('sv-SE').replace('T', ' '),
      navigation: {
        latitude: gps.latitude !== undefined && gps.latitude !== null ? parseFloat(gps.latitude) : null,
        longitude: gps.longitude !== undefined && gps.longitude !== null ? parseFloat(gps.longitude) : null,
        altitude_m: gps.altitude_m !== undefined && gps.altitude_m !== null ? parseFloat(gps.altitude_m) : null,
        sog_knots: gps.sog_knots !== undefined && gps.sog_knots !== null ? parseFloat(gps.sog_knots) : null,
        sog_kmh: gps.sog_kmh !== undefined && gps.sog_kmh !== null ? parseFloat(gps.sog_kmh) : null,
        cog_deg: gps.cog_deg !== undefined && gps.cog_deg !== null ? parseFloat(gps.cog_deg) : null,
        cog_ref: 'True',
        satellites: gps.satellites || null,
        hdop: gps.hdop !== undefined && gps.hdop !== null ? parseFloat(gps.hdop) : null,
        pdop: gps.pdop !== undefined && gps.pdop !== null ? parseFloat(gps.pdop) : null,
        gnss_fix: gps.gnss_fix || 'GNSS Fix (GPS)',
      },
      motion: {
        heading_deg: mot.heading_deg !== undefined && mot.heading_deg !== null ? parseFloat(mot.heading_deg) : null,
        heading_ref: mot.heading_ref || 'True',
        rot_deg_s: mot.rot_deg_s !== undefined && mot.rot_deg_s !== null ? parseFloat(mot.rot_deg_s) : null,
        pitch_deg: mot.pitch_deg !== undefined && mot.pitch_deg !== null ? parseFloat(mot.pitch_deg) : null,
        roll_deg: mot.roll_deg !== undefined && mot.roll_deg !== null ? parseFloat(mot.roll_deg) : null,
      },
      environment: {
        wind_speed_kn: env.wind_speed_kn !== undefined && env.wind_speed_kn !== null ? parseFloat(env.wind_speed_kn) : null,
        wind_speed_ms: env.wind_speed_kn !== undefined && env.wind_speed_kn !== null ? parseFloat((env.wind_speed_kn * 0.514444).toFixed(1)) : null,
        wind_angle_deg: env.wind_angle_deg !== undefined && env.wind_angle_deg !== null ? parseFloat(env.wind_angle_deg) : null,
        wind_ref: env.wind_ref || 'Apparent',
        depth_m: latestDepth !== undefined && latestDepth !== null ? parseFloat(latestDepth) : null,
        depth_ft: latestDepth !== undefined && latestDepth !== null ? parseFloat((latestDepth * 3.28084).toFixed(1)) : null,
        water_temp_c: env.water_temp_c !== undefined && env.water_temp_c !== null ? parseFloat(env.water_temp_c) : null,
        air_temp_c: env.air_temp_c !== undefined && env.air_temp_c !== null ? parseFloat(env.air_temp_c) : null,
        baro_pressure_hpa: env.baro_pressure_hpa !== undefined && env.baro_pressure_hpa !== null ? parseFloat(env.baro_pressure_hpa) : null,
        stw_knots: null,
      },
      engine: {
        engine_rpm: null,
        boost_kpa: null,
        battery_volts: null,
      },
      ais: {
        total_targets: 0,
        targets: [],
      },
      bus_stats: {
        fps: 0.0,
        total_frames: 0,
        devices_count: 0,
      },
    };
  } catch (err) {
    console.error('[DB REPO] Gagal mengambil latest telemetry:', err.message);
    return null;
  }
}

async function getHistoricalTelemetryLogs(options = {}) {
  // Support both legacy signature (limit, offset, assetId) and modern options object
  let limit = 100;
  let offset = 0;
  let assetId = null;
  let from = null;
  let to = null;

  if (typeof options === 'number') {
    limit = options;
    offset = arguments[1] || 0;
    assetId = arguments[2] || null;
  } else if (typeof options === 'object') {
    limit = options.limit ? Math.min(parseInt(options.limit, 10), 5000) : 100;
    offset = options.offset ? parseInt(options.offset, 10) : 0;
    assetId = options.assetId || null;
    from = options.from || null;
    to = options.to || null;
  }

  try {
    const conditions = [];
    const params = [];

    if (assetId && assetId !== 'all') {
      params.push(assetId);
      conditions.push(`g.asset_id = $${params.length}`);
    }

    if (from) {
      params.push(new Date(from).toISOString());
      conditions.push(`g.timestamp_utc >= $${params.length}`);
    }

    if (to) {
      params.push(new Date(to).toISOString());
      conditions.push(`g.timestamp_utc <= $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const query = `
      SELECT g.id, g.asset_id, g.timestamp_utc, g.timestamp_local, g.latitude, g.longitude, g.altitude_m,
             g.sog_knots, g.sog_kmh, g.cog_deg, g.satellites, g.hdop, g.gnss_fix,
             m.heading_deg, m.rot_deg_s, m.pitch_deg, m.roll_deg,
             e.depth_m, e.water_temp_c, e.air_temp_c, e.wind_speed_kn, e.wind_angle_deg, e.baro_pressure_hpa
      FROM tbl_telemetry_gps g
      LEFT JOIN tbl_telemetry_motion m 
        ON g.asset_id = m.asset_id AND ABS(EXTRACT(EPOCH FROM (g.timestamp_utc - m.timestamp_utc))) < 1.5
      LEFT JOIN tbl_telemetry_environment e 
        ON g.asset_id = e.asset_id AND ABS(EXTRACT(EPOCH FROM (g.timestamp_utc - e.timestamp_utc))) < 1.5
      ${whereClause}
      ORDER BY g.timestamp_utc DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const res = await pool.query(query, params);
    return res.rows;
  } catch (err) {
    console.error('[DB REPO] Gagal mengambil histori telemetry logs:', err.message);
    return [];
  }
}

module.exports = {
  saveTelemetrySnapshot,
  getRecentTrack,
  getLatestTelemetry,
  getHistoricalTelemetryLogs,
};

