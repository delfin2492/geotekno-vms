/**
 * Vessel State Store
 * Menyimpan kondisi navigasi kapal secara in-memory dan melacak target AIS
 */

class VesselState {
  constructor() {
    this.reset();
  }

  reset() {
    this.latitude = null;
    this.longitude = null;
    this.altitude_m = null;
    this.gnss_method = 'No Fix';
    this.satellites = null;
    this.hdop = null;
    this.pdop = null;

    this.sog_knots = null;
    this.sog_kmh = null;
    this.cog_deg = null;
    this.cog_ref = 'True';

    this.heading_deg = null;
    this.heading_ref = 'True';
    this.rot_deg_s = null;
    this.pitch_deg = null;
    this.roll_deg = null;

    this.wind_speed_kn = null;
    this.wind_speed_ms = null;
    this.wind_angle_deg = null;
    this.wind_ref = 'Apparent';

    this.depth_m = null;
    this.depth_ft = null;
    this.water_temp_c = null;
    this.air_temp_c = null;
    this.baro_pressure_hpa = null;
    this.stw_knots = null;

    this.engine_rpm = null;
    this.boost_kpa = null;
    this.battery_volts = null;

    // Map: sourceAddress -> { source, pgns: Set, frameCount, lastSeen }
    this.devices = new Map();

    // Map: mmsi -> { mmsi, name, lat, lon, sog, cog, hdg, lastSeen }
    this.aisTargets = new Map();

    // Timestamp penerimaan data telemetri kapal sendiri (own ship) terakhir
    this.lastDataReceivedAt = null;
    this._lastSavedDataAt = null;

    // Statistik Bus
    this.totalFrames = 0;
    this.frameRate = 0.0;
    this._fpsCounter = 0;
    this._lastFpsTime = Date.now();
  }

  hydrateFromSnapshot(snap) {
    if (!snap) return;
    if (snap.timestamp_utc) {
      const parsedTime = new Date(snap.timestamp_utc).getTime();
      if (!isNaN(parsedTime)) {
        this.lastDataReceivedAt = parsedTime;
      }
    }
    if (snap.navigation) {
      const nav = snap.navigation;
      if (nav.latitude !== null && nav.latitude !== undefined) this.latitude = nav.latitude;
      if (nav.longitude !== null && nav.longitude !== undefined) this.longitude = nav.longitude;
      if (nav.altitude_m !== null && nav.altitude_m !== undefined) this.altitude_m = nav.altitude_m;
      if (nav.sog_knots !== null && nav.sog_knots !== undefined) this.sog_knots = nav.sog_knots;
      if (nav.sog_kmh !== null && nav.sog_kmh !== undefined) this.sog_kmh = nav.sog_kmh;
      if (nav.cog_deg !== null && nav.cog_deg !== undefined) this.cog_deg = nav.cog_deg;
      if (nav.cog_ref) this.cog_ref = nav.cog_ref;
      if (nav.satellites !== null && nav.satellites !== undefined) this.satellites = nav.satellites;
      if (nav.hdop !== null && nav.hdop !== undefined) this.hdop = nav.hdop;
      if (nav.pdop !== null && nav.pdop !== undefined) this.pdop = nav.pdop;
      if (nav.gnss_fix) this.gnss_method = nav.gnss_fix;
    }
    if (snap.motion) {
      const mot = snap.motion;
      if (mot.heading_deg !== null && mot.heading_deg !== undefined) this.heading_deg = mot.heading_deg;
      if (mot.heading_ref) this.heading_ref = mot.heading_ref;
      if (mot.rot_deg_s !== null && mot.rot_deg_s !== undefined) this.rot_deg_s = mot.rot_deg_s;
      if (mot.pitch_deg !== null && mot.pitch_deg !== undefined) this.pitch_deg = mot.pitch_deg;
      if (mot.roll_deg !== null && mot.roll_deg !== undefined) this.roll_deg = mot.roll_deg;
    }
    if (snap.environment) {
      const env = snap.environment;
      if (env.wind_speed_kn !== null && env.wind_speed_kn !== undefined) this.wind_speed_kn = env.wind_speed_kn;
      if (env.wind_speed_ms !== null && env.wind_speed_ms !== undefined) this.wind_speed_ms = env.wind_speed_ms;
      if (env.wind_angle_deg !== null && env.wind_angle_deg !== undefined) this.wind_angle_deg = env.wind_angle_deg;
      if (env.wind_ref) this.wind_ref = env.wind_ref;
      if (env.depth_m !== null && env.depth_m !== undefined) this.depth_m = env.depth_m;
      if (env.depth_ft !== null && env.depth_ft !== undefined) this.depth_ft = env.depth_ft;
      if (env.water_temp_c !== null && env.water_temp_c !== undefined) this.water_temp_c = env.water_temp_c;
      if (env.air_temp_c !== null && env.air_temp_c !== undefined) this.air_temp_c = env.air_temp_c;
      if (env.baro_pressure_hpa !== null && env.baro_pressure_hpa !== undefined) this.baro_pressure_hpa = env.baro_pressure_hpa;
    }
  }

  applyNmea0183(data) {
    if (!data) return;

    if (data.is_ais && data.mmsi) {
      let tgt = this.aisTargets.get(data.mmsi) || { mmsi: data.mmsi, name: `MMSI-${data.mmsi}` };
      if (data.latitude !== undefined && data.latitude !== null) tgt.latitude = data.latitude;
      if (data.longitude !== undefined && data.longitude !== null) tgt.longitude = data.longitude;
      if (data.cog_deg !== undefined && data.cog_deg !== null) tgt.cog = data.cog_deg;
      if (data.sog_knots !== undefined && data.sog_knots !== null) tgt.sog = data.sog_knots;
      if (data.heading_deg !== undefined && data.heading_deg !== null) tgt.heading = data.heading_deg;
      if (data.vessel_name) tgt.name = data.vessel_name;
      if (data.callsign) tgt.callsign = data.callsign;
      if (data.imo) tgt.imo = data.imo;
      if (data.ship_type) tgt.type = data.ship_type;
      if (data.length_m) tgt.length_m = data.length_m;
      if (data.beam_m) tgt.beam_m = data.beam_m;
      if (data.draught_m) tgt.draught_m = data.draught_m;
      if (data.destination) tgt.destination = data.destination;
      if (data.nav_status_code !== undefined && data.nav_status_code !== null) tgt.nav_status_code = data.nav_status_code;
      if (data.rot !== undefined && data.rot !== null) tgt.rot = data.rot;
      if (data.ais_class) tgt.ais_class = data.ais_class;
      tgt.lastSeen = Date.now();
      this.aisTargets.set(data.mmsi, tgt);
      return;
    }

    // Telemetri kapal sendiri (own ship) - catat waktu data masuk
    this.lastDataReceivedAt = Date.now();

    if (data.latitude !== undefined && data.latitude !== null) this.latitude = data.latitude;
    if (data.longitude !== undefined && data.longitude !== null) this.longitude = data.longitude;
    if (data.altitude_m !== undefined && data.altitude_m !== null) this.altitude_m = data.altitude_m;
    if (data.sog_knots !== undefined && data.sog_knots !== null) this.sog_knots = data.sog_knots;
    if (data.sog_kmh !== undefined && data.sog_kmh !== null) this.sog_kmh = data.sog_kmh;
    if (data.cog_deg !== undefined && data.cog_deg !== null) this.cog_deg = data.cog_deg;
    if (data.satellites !== undefined && data.satellites !== null) this.satellites = data.satellites;
    if (data.hdop !== undefined && data.hdop !== null) this.hdop = data.hdop;
    if (data.gnss_fix) this.gnss_method = data.gnss_fix;

    if (data.heading_deg !== undefined && data.heading_deg !== null) this.heading_deg = data.heading_deg;
    if (data.heading_ref) this.heading_ref = data.heading_ref;

    if (data.depth_m !== undefined && data.depth_m !== null) this.depth_m = data.depth_m;
    if (data.depth_ft !== undefined && data.depth_ft !== null) this.depth_ft = data.depth_ft;

    if (data.wind_speed_kn !== undefined && data.wind_speed_kn !== null) this.wind_speed_kn = data.wind_speed_kn;
    if (data.wind_speed_ms !== undefined && data.wind_speed_ms !== null) this.wind_speed_ms = data.wind_speed_ms;
    if (data.wind_angle_deg !== undefined && data.wind_angle_deg !== null) this.wind_angle_deg = data.wind_angle_deg;
    if (data.wind_ref) this.wind_ref = data.wind_ref;

    if (data.water_temp_c !== undefined && data.water_temp_c !== null) this.water_temp_c = data.water_temp_c;
  }

  updateFrameStats() {
    this.totalFrames += 1;
    this._fpsCounter += 1;
    const now = Date.now();
    const elapsed = (now - this._lastFpsTime) / 1000.0;
    if (elapsed >= 1.0) {
      this.frameRate = this._fpsCounter / elapsed;
      this._fpsCounter = 0;
      this._lastFpsTime = now;
    }
  }

  updateDevice(source, pgn) {
    let dev = this.devices.get(source);
    if (!dev) {
      dev = {
        source,
        pgns: new Set(),
        frameCount: 0,
        lastSeen: Date.now(),
      };
      this.devices.set(source, dev);
    }
    dev.pgns.add(pgn);
    dev.frameCount += 1;
    dev.lastSeen = Date.now();
  }

  applyDecoded(pgn, source, data) {
    if (!data) return;

    if (pgn === 129038 || pgn === 129039) {
      if (data.mmsi) {
        let tgt = this.aisTargets.get(data.mmsi) || { mmsi: data.mmsi, name: `MMSI-${data.mmsi}` };
        tgt.latitude = data.latitude;
        tgt.longitude = data.longitude;
        tgt.cog = data.cog_deg;
        tgt.sog = data.sog_knots;
        tgt.heading = data.heading_deg;
        if (data.nav_status_code !== undefined && data.nav_status_code !== null) tgt.nav_status_code = data.nav_status_code;
        if (data.rot !== undefined && data.rot !== null) tgt.rot = data.rot;
        if (data.ais_class) tgt.ais_class = data.ais_class;
        tgt.lastSeen = Date.now();
        this.aisTargets.set(data.mmsi, tgt);
      }
      return;
    } else if (pgn === 129794 || pgn === 129809 || pgn === 129810) {
      if (data.mmsi) {
        let tgt = this.aisTargets.get(data.mmsi) || { mmsi: data.mmsi };
        if (data.vessel_name) tgt.name = data.vessel_name;
        if (data.callsign) tgt.callsign = data.callsign;
        if (data.imo) tgt.imo = data.imo;
        if (data.ship_type) tgt.type = data.ship_type;
        if (data.ais_class) tgt.ais_class = data.ais_class;
        tgt.lastSeen = Date.now();
        this.aisTargets.set(data.mmsi, tgt);
      }
      return;
    }

    // Telemetri kapal sendiri (own ship) - catat waktu data masuk
    this.lastDataReceivedAt = Date.now();

    if (pgn === 129025) {
      if (data.latitude !== undefined) this.latitude = data.latitude;
      if (data.longitude !== undefined) this.longitude = data.longitude;
    } else if (pgn === 129026) {
      if (data.sog_knots !== undefined) this.sog_knots = data.sog_knots;
      if (data.sog_kmh !== undefined) this.sog_kmh = data.sog_kmh;
      if (data.cog_deg !== undefined) this.cog_deg = data.cog_deg;
      if (data.cog_ref !== undefined) this.cog_ref = data.cog_ref;
    } else if (pgn === 129029) {
      if (data.latitude !== undefined && data.latitude !== null) this.latitude = data.latitude;
      if (data.longitude !== undefined && data.longitude !== null) this.longitude = data.longitude;
      if (data.altitude_m !== undefined) this.altitude_m = data.altitude_m;
      if (data.gnss_method !== undefined) this.gnss_method = data.gnss_method;
      if (data.satellites !== undefined) this.satellites = data.satellites;
      if (data.hdop !== undefined) this.hdop = data.hdop;
      if (data.pdop !== undefined) this.pdop = data.pdop;
    } else if (pgn === 127250) {
      if (data.heading_deg !== undefined) this.heading_deg = data.heading_deg;
      if (data.heading_ref !== undefined) this.heading_ref = data.heading_ref;
    } else if (pgn === 127251) {
      if (data.rot_deg_s !== undefined) this.rot_deg_s = data.rot_deg_s;
    } else if (pgn === 127257) {
      if (data.pitch_deg !== undefined) this.pitch_deg = data.pitch_deg;
      if (data.roll_deg !== undefined) this.roll_deg = data.roll_deg;
    } else if (pgn === 128267) {
      if (data.depth_m !== undefined) this.depth_m = data.depth_m;
      if (data.depth_ft !== undefined) this.depth_ft = data.depth_ft;
    } else if (pgn === 128259) {
      if (data.stw_knots !== undefined) this.stw_knots = data.stw_knots;
    } else if (pgn === 130306) {
      if (data.wind_speed_kn !== undefined) this.wind_speed_kn = data.wind_speed_kn;
      if (data.wind_speed_ms !== undefined) this.wind_speed_ms = data.wind_speed_ms;
      if (data.wind_angle_deg !== undefined) this.wind_angle_deg = data.wind_angle_deg;
      if (data.wind_ref !== undefined) this.wind_ref = data.wind_ref;
    } else if (pgn === 130310 || pgn === 130311) {
      if (data.water_temp_c !== undefined) this.water_temp_c = data.water_temp_c;
      if (data.air_temp_c !== undefined) this.air_temp_c = data.air_temp_c;
      if (data.baro_pressure_hpa !== undefined) this.baro_pressure_hpa = data.baro_pressure_hpa;
    } else if (pgn === 127488) {
      if (data.rpm !== undefined) this.engine_rpm = data.rpm;
      if (data.boost_kpa !== undefined) this.boost_kpa = data.boost_kpa;
    } else if (pgn === 127508) {
      if (data.battery_volts !== undefined) this.battery_volts = data.battery_volts;
    }
  }

  /**
   * Snapshot data untuk broadcast WebSocket dan penyimpanan database
   */
  getSnapshot() {
    // Prune AIS targets older than 10 minutes
    const tenMinAgo = Date.now() - 600000;
    const activeAis = [];
    for (const [mmsi, target] of this.aisTargets.entries()) {
      if (target.lastSeen >= tenMinAgo) {
        activeAis.push(target);
      } else {
        this.aisTargets.delete(mmsi);
      }
    }

    const timestampUtc = this.lastDataReceivedAt ? new Date(this.lastDataReceivedAt).toISOString() : null;
    const timestampLocal = this.lastDataReceivedAt ? new Date(this.lastDataReceivedAt).toLocaleString('sv-SE').replace('T', ' ') : null;

    return {
      timestamp_utc: timestampUtc,
      timestamp_local: timestampLocal,
      navigation: {
        latitude: this.latitude,
        longitude: this.longitude,
        altitude_m: this.altitude_m,
        sog_knots: this.sog_knots,
        sog_kmh: this.sog_kmh,
        cog_deg: this.cog_deg,
        cog_ref: this.cog_ref,
        satellites: this.satellites,
        hdop: this.hdop,
        pdop: this.pdop,
        gnss_fix: this.gnss_method,
      },
      motion: {
        heading_deg: this.heading_deg,
        heading_ref: this.heading_ref,
        rot_deg_s: this.rot_deg_s,
        pitch_deg: this.pitch_deg,
        roll_deg: this.roll_deg,
      },
      environment: {
        wind_speed_kn: this.wind_speed_kn,
        wind_speed_ms: this.wind_speed_ms,
        wind_angle_deg: this.wind_angle_deg,
        wind_ref: this.wind_ref,
        depth_m: this.depth_m,
        depth_ft: this.depth_ft,
        water_temp_c: this.water_temp_c,
        air_temp_c: this.air_temp_c,
        baro_pressure_hpa: this.baro_pressure_hpa,
        stw_knots: this.stw_knots,
      },
      engine: {
        engine_rpm: this.engine_rpm,
        boost_kpa: this.boost_kpa,
        battery_volts: this.battery_volts,
      },
      ais: {
        total_targets: activeAis.length,
        targets: activeAis.slice(0, 50), // Kirim 50 target terdekat/teraktif
      },
      bus: {
        fps: parseFloat(this.frameRate.toFixed(1)),
        total_frames: this.totalFrames,
        devices_count: this.devices.size,
      },
    };
  }
}

module.exports = {
  VesselState,
};
