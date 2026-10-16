/**
 * NMEA 2000 PGN Decoders
 * Menerjemahkan buffer biner PGN menjadi objek data terstruktur
 */

const RAD_TO_DEG = 180.0 / Math.PI;
const MS_TO_KNOTS = 1.9438444924406;
const MS_TO_KMH = 3.6;
const KELVIN_OFFSET = 273.15;

function decodeNmea2000Payload(pgn, payload) {
  if (!payload || payload.length === 0) return null;

  try {
    switch (pgn) {
      // ----------------------------------------------------
      // PGN 126992: System Time
      // ----------------------------------------------------
      case 126992: {
        if (payload.length < 8) return null;
        const sid = payload[0];
        const timeSource = payload[1] & 0x0f;
        const days = payload.readUInt16LE(2);
        const timeRaw = payload.readUInt32LE(4);

        if (timeRaw === 0xffffffff || days === 0xffff) return null;

        const seconds = timeRaw * 0.0001;
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = (seconds % 60).toFixed(2);

        return {
          sid,
          time_source: timeSource,
          days_since_1970: days,
          utc_time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${secs.padStart(5, '0')}`,
        };
      }

      // ----------------------------------------------------
      // PGN 127250: Vessel Heading
      // ----------------------------------------------------
      case 127250: {
        if (payload.length < 8) return null;
        const sid = payload[0];
        const headingRaw = payload.readUInt16LE(1);
        const devRaw = payload.readInt16LE(3);
        const varRaw = payload.readInt16LE(5);
        const refType = payload[7] & 0x03;

        const headingDeg = headingRaw !== 0xffff ? (headingRaw * 0.0001 * RAD_TO_DEG) % 360.0 : null;
        const deviationDeg = devRaw !== -32768 && devRaw !== 0x7fff ? devRaw * 0.0001 * RAD_TO_DEG : null;
        const variationDeg = varRaw !== -32768 && varRaw !== 0x7fff ? varRaw * 0.0001 * RAD_TO_DEG : null;

        return {
          sid,
          heading_deg: headingDeg !== null ? parseFloat(headingDeg.toFixed(2)) : null,
          heading_ref: refType === 0 ? 'True' : refType === 1 ? 'Magnetic' : 'Unknown',
          deviation_deg: deviationDeg !== null ? parseFloat(deviationDeg.toFixed(2)) : null,
          variation_deg: variationDeg !== null ? parseFloat(variationDeg.toFixed(2)) : null,
        };
      }

      // ----------------------------------------------------
      // PGN 127251: Rate of Turn
      // ----------------------------------------------------
      case 127251: {
        if (payload.length < 5) return null;
        const sid = payload[0];
        const rotRaw = payload.readInt32LE(1);
        if (rotRaw === 0x7fffffff || rotRaw === -2147483648) return null;
        const rotDegS = rotRaw * 1e-6 * RAD_TO_DEG;
        return {
          sid,
          rot_deg_s: parseFloat(rotDegS.toFixed(2)),
        };
      }

      // ----------------------------------------------------
      // PGN 127257: Attitude (Pitch & Roll)
      // ----------------------------------------------------
      case 127257: {
        if (payload.length < 7) return null;
        const sid = payload[0];
        const yawRaw = payload.readInt16LE(1);
        const pitchRaw = payload.readInt16LE(3);
        const rollRaw = payload.readInt16LE(5);

        const pitchDeg = pitchRaw !== -32768 && pitchRaw !== 0x7fff ? pitchRaw * 0.0001 * RAD_TO_DEG : null;
        const rollDeg = rollRaw !== -32768 && rollRaw !== 0x7fff ? rollRaw * 0.0001 * RAD_TO_DEG : null;
        const yawDeg = yawRaw !== -32768 && yawRaw !== 0x7fff ? yawRaw * 0.0001 * RAD_TO_DEG : null;

        return {
          sid,
          yaw_deg: yawDeg !== null ? parseFloat(yawDeg.toFixed(2)) : null,
          pitch_deg: pitchDeg !== null ? parseFloat(pitchDeg.toFixed(2)) : null,
          roll_deg: rollDeg !== null ? parseFloat(rollDeg.toFixed(2)) : null,
        };
      }

      // ----------------------------------------------------
      // PGN 128259: Speed, Water referenced
      // ----------------------------------------------------
      case 128259: {
        if (payload.length < 5) return null;
        const sid = payload[0];
        const stwRaw = payload.readUInt16LE(1);
        if (stwRaw === 0xffff) return null;
        const stwMs = stwRaw * 0.01;
        return {
          sid,
          stw_knots: parseFloat((stwMs * MS_TO_KNOTS).toFixed(2)),
          stw_kmh: parseFloat((stwMs * MS_TO_KMH).toFixed(2)),
        };
      }

      // ----------------------------------------------------
      // PGN 128267: Water Depth
      // ----------------------------------------------------
      case 128267: {
        if (payload.length < 8) return null;
        const sid = payload[0];
        const depthRaw = payload.readUInt32LE(1);
        const offsetRaw = payload.readInt16LE(5);

        const depthM = depthRaw !== 0xffffffff ? depthRaw * 0.01 : null;
        const offsetM = offsetRaw !== -32768 && offsetRaw !== 0x7fff ? offsetRaw * 0.001 : 0.0;

        return {
          sid,
          depth_m: depthM !== null ? parseFloat(depthM.toFixed(2)) : null,
          depth_ft: depthM !== null ? parseFloat((depthM * 3.28084).toFixed(2)) : null,
          offset_m: parseFloat(offsetM.toFixed(2)),
        };
      }

      // ----------------------------------------------------
      // PGN 129025: Position, Rapid Update
      // ----------------------------------------------------
      case 129025: {
        if (payload.length < 8) return null;
        const latRaw = payload.readInt32LE(0);
        const lonRaw = payload.readInt32LE(4);

        if (latRaw === 0x7fffffff || lonRaw === 0x7fffffff) return null;

        const lat = latRaw * 1e-7;
        const lon = lonRaw * 1e-7;

        if (lat < -90.0 || lat > 90.0 || lon < -180.0 || lon > 180.0) return null;

        return {
          latitude: parseFloat(lat.toFixed(7)),
          longitude: parseFloat(lon.toFixed(7)),
        };
      }

      // ----------------------------------------------------
      // PGN 129026: COG & SOG, Rapid Update
      // ----------------------------------------------------
      case 129026: {
        if (payload.length < 8) return null;
        const sid = payload[0];
        const cogRef = (payload[1] & 0x03) === 0 ? 'True' : 'Magnetic';
        const cogRaw = payload.readUInt16LE(2);
        const sogRaw = payload.readUInt16LE(4);

        const cogDeg = cogRaw !== 0xffff ? (cogRaw * 0.0001 * RAD_TO_DEG) % 360.0 : null;
        const sogMs = sogRaw !== 0xffff ? sogRaw * 0.01 : null;
        const sogKnots = sogMs !== null ? sogMs * MS_TO_KNOTS : null;
        const sogKmh = sogMs !== null ? sogMs * MS_TO_KMH : null;

        return {
          sid,
          cog_ref: cogRef,
          cog_deg: cogDeg !== null ? parseFloat(cogDeg.toFixed(2)) : null,
          sog_knots: sogKnots !== null ? parseFloat(sogKnots.toFixed(2)) : null,
          sog_kmh: sogKmh !== null ? parseFloat(sogKmh.toFixed(2)) : null,
        };
      }

      // ----------------------------------------------------
      // PGN 129029: GNSS Position Data (Fast Packet)
      // ----------------------------------------------------
      case 129029: {
        if (payload.length < 43) return null;
        const sid = payload[0];
        const days = payload.readUInt16LE(1);
        const timeRaw = payload.readUInt32LE(3);
        const latRaw = Number(payload.readBigInt64LE(7));
        const lonRaw = Number(payload.readBigInt64LE(15));
        const altRaw = Number(payload.readBigInt64LE(23));

        const methodCode = (payload[31] >> 4) & 0x0f;
        const numSats = payload[33];
        const hdopRaw = payload.readInt16LE(34);
        const pdopRaw = payload.readInt16LE(36);

        const METHODS = {
          0: 'No Fix',
          1: 'GNSS Fix (GPS)',
          2: 'DGNSS (Differential)',
          3: 'Precise GNSS',
          4: 'RTK Fixed',
          5: 'RTK Float',
          8: 'Simulated',
        };

        const latVal = latRaw !== 0x7fffffffffffffffn ? latRaw * 1e-16 : null;
        const lonVal = lonRaw !== 0x7fffffffffffffffn ? lonRaw * 1e-16 : null;
        const lat = (latVal !== null && Math.abs(latVal) <= 90.0) ? parseFloat(latVal.toFixed(7)) : null;
        const lon = (lonVal !== null && Math.abs(lonVal) <= 180.0) ? parseFloat(lonVal.toFixed(7)) : null;
        const alt = (altRaw !== 0x7fffffffffffffffn && Math.abs(altRaw) < 1e12) ? altRaw * 1e-6 : null;
        const hdop = hdopRaw !== -32768 && hdopRaw !== 0x7fff ? hdopRaw * 0.01 : null;
        const pdop = pdopRaw !== -32768 && pdopRaw !== 0x7fff ? pdopRaw * 0.01 : null;

        return {
          sid,
          latitude: lat,
          longitude: lon,
          altitude_m: alt !== null ? parseFloat(alt.toFixed(2)) : null,
          gnss_method: METHODS[methodCode] || `Code ${methodCode}`,
          satellites: numSats !== 0xff ? numSats : null,
          hdop: hdop !== null ? parseFloat(hdop.toFixed(2)) : null,
          pdop: pdop !== null ? parseFloat(pdop.toFixed(2)) : null,
        };
      }

      // ----------------------------------------------------
      // PGN 130306: Wind Data
      // ----------------------------------------------------
      case 130306: {
        if (payload.length < 6) return null;
        const sid = payload[0];
        const speedRaw = payload.readUInt16LE(1);
        const angleRaw = payload.readUInt16LE(3);
        const refCode = payload[5] & 0x07;

        const speedMs = speedRaw !== 0xffff ? speedRaw * 0.01 : null;
        const angleDeg = angleRaw !== 0xffff ? (angleRaw * 0.0001 * RAD_TO_DEG) % 360.0 : null;

        const WIND_REFS = {
          0: 'Apparent',
          1: 'True (boat)',
          2: 'True (ground)',
        };

        return {
          sid,
          wind_speed_ms: speedMs !== null ? parseFloat(speedMs.toFixed(2)) : null,
          wind_speed_kn: speedMs !== null ? parseFloat((speedMs * MS_TO_KNOTS).toFixed(2)) : null,
          wind_angle_deg: angleDeg !== null ? parseFloat(angleDeg.toFixed(2)) : null,
          wind_ref: WIND_REFS[refCode] || 'Apparent',
        };
      }

      // ----------------------------------------------------
      // PGN 130310: Environmental Parameters
      // ----------------------------------------------------
      case 130310: {
        if (payload.length < 7) return null;
        const sid = payload[0];
        const waterTempRaw = payload.readUInt16LE(1);
        const outsideTempRaw = payload.readUInt16LE(3);
        const pressureRaw = payload.readUInt16LE(5);

        const waterTemp = waterTempRaw !== 0xffff ? waterTempRaw * 0.01 - KELVIN_OFFSET : null;
        const airTemp = outsideTempRaw !== 0xffff ? outsideTempRaw * 0.01 - KELVIN_OFFSET : null;
        const pressure = pressureRaw !== 0xffff ? pressureRaw * 100 * 0.01 : null; // hPa

        return {
          sid,
          water_temp_c: waterTemp !== null ? parseFloat(waterTemp.toFixed(1)) : null,
          air_temp_c: airTemp !== null ? parseFloat(airTemp.toFixed(1)) : null,
          baro_pressure_hpa: pressure !== null ? parseFloat(pressure.toFixed(1)) : null,
        };
      }

      // ----------------------------------------------------
      // PGN 127488: Engine Parameters, Rapid Update
      // ----------------------------------------------------
      case 127488: {
        if (payload.length < 8) return null;
        const engineInstance = payload[0];
        const rpmRaw = payload.readUInt16LE(1);
        const boostRaw = payload.readUInt16LE(3);
        const tiltRaw = payload.readInt8(5);

        return {
          engine_instance: engineInstance,
          rpm: rpmRaw !== 0xffff ? rpmRaw * 0.25 : null,
          boost_kpa: boostRaw !== 0xffff ? boostRaw * 1.0 : null,
          tilt_trim_pct: tiltRaw !== -128 ? tiltRaw : null,
        };
      }

      // ----------------------------------------------------
      // PGN 127508: Battery Status
      // ----------------------------------------------------
      case 127508: {
        if (payload.length < 8) return null;
        const batteryInstance = payload[0];
        const voltageRaw = payload.readUInt16LE(1);
        const currentRaw = payload.readInt16LE(3);
        const tempRaw = payload.readUInt16LE(5);

        const voltage = voltageRaw !== 0xffff ? voltageRaw * 0.01 : null;
        const current = currentRaw !== -32768 && currentRaw !== 0x7fff ? currentRaw * 0.1 : null;
        const temp = tempRaw !== 0xffff ? tempRaw * 0.01 - KELVIN_OFFSET : null;

        return {
          battery_instance: batteryInstance,
          battery_volts: voltage !== null ? parseFloat(voltage.toFixed(2)) : null,
          battery_amps: current !== null ? parseFloat(current.toFixed(1)) : null,
          battery_temp_c: temp !== null ? parseFloat(temp.toFixed(1)) : null,
        };
      }

      // ----------------------------------------------------
      // PGN 129038 / 129039: AIS Class A / B Position Report
      // ----------------------------------------------------
      case 129038:
      case 129039: {
        if (payload.length < 24) return null;
        const mmsi = payload.readUInt32LE(1);
        const lonRaw = payload.readInt32LE(5);
        const latRaw = payload.readInt32LE(9);
        const cogRaw = payload.readUInt16LE(14);
        const sogRaw = payload.readUInt16LE(16);
        const hdgRaw = payload.readUInt16LE(21);

        const lon = lonRaw !== 0x7fffffff ? lonRaw * 1e-7 : null;
        const lat = latRaw !== 0x7fffffff ? latRaw * 1e-7 : null;
        const cog = cogRaw !== 0xffff ? (cogRaw * 0.0001 * RAD_TO_DEG) % 360.0 : null;
        const sog = sogRaw !== 0xffff ? sogRaw * 0.01 * MS_TO_KNOTS : null;
        const hdg = hdgRaw !== 0xffff ? (hdgRaw * 0.0001 * RAD_TO_DEG) % 360.0 : null;

        let rot = null;
        let navStatusCode = null;
        if (pgn === 129038 && payload.length >= 26) {
          const rotRaw = payload.readInt16LE(23);
          if (rotRaw !== -32768 && rotRaw !== 0x7fff) rot = parseFloat((rotRaw * 0.0001 * RAD_TO_DEG).toFixed(1));
          navStatusCode = payload[25] & 0x0F;
        }

        return {
          ais_type: pgn === 129038 ? 'Class A' : 'Class B',
          ais_class: pgn === 129038 ? 'A' : 'B',
          mmsi,
          latitude: lat !== null ? parseFloat(lat.toFixed(6)) : null,
          longitude: lon !== null ? parseFloat(lon.toFixed(6)) : null,
          cog_deg: cog !== null ? parseFloat(cog.toFixed(1)) : null,
          sog_knots: sog !== null ? parseFloat(sog.toFixed(1)) : null,
          heading_deg: hdg !== null ? parseFloat(hdg.toFixed(1)) : null,
          rot,
          nav_status_code: navStatusCode,
        };
      }

      // ----------------------------------------------------
      // PGN 129794 / 129809 / 129810: AIS Static Data & Vessel Name
      // ----------------------------------------------------
      case 129794: {
        if (payload.length < 10) return null;
        const mmsi = payload.readUInt32LE(1);
        let imo = '';
        let callsign = '';
        let name = '';
        if (payload.length >= 36) {
          const rawImo = payload.readUInt32LE(5);
          if (rawImo > 0 && rawImo <= 9999999) imo = String(rawImo);
          callsign = payload.subarray(9, 16).toString('ascii').replace(/[^\x20-\x7E]/g, '').replace(/[@_]/g, '').trim();
          name = payload.subarray(16, 36).toString('ascii').replace(/[^\x20-\x7E]/g, '').replace(/[@_]/g, ' ').trim();
        } else if (payload.length >= 32) {
          callsign = payload.subarray(5, 12).toString('ascii').replace(/[^\x20-\x7E]/g, '').replace(/[@_]/g, '').trim();
          name = payload.subarray(12, 32).toString('ascii').replace(/[^\x20-\x7E]/g, '').replace(/[@_]/g, ' ').trim();
        }
        let shipType = null;
        if (payload.length > 36) {
          const typeCode = payload[36];
          if (typeCode === 52 || typeCode === 31 || typeCode === 32) shipType = 'Tug';
          else if (typeCode >= 80 && typeCode <= 89) shipType = 'Tanker';
          else if (typeCode >= 70 && typeCode <= 79) shipType = 'Cargo';
          else if (typeCode >= 60 && typeCode <= 69) shipType = 'Passenger';
          else if (typeCode === 30) shipType = 'Fishing';
        }
        return {
          mmsi,
          imo,
          callsign,
          vessel_name: name || `MMSI-${mmsi}`,
          ship_type: shipType,
          ais_class: 'A',
        };
      }
      case 129809: {
        if (payload.length < 10) return null;
        const mmsi = payload.readUInt32LE(1);
        const name = payload.subarray(5, Math.min(payload.length, 25)).toString('ascii').replace(/[^\x20-\x7E]/g, '').replace(/[@_]/g, ' ').trim();
        return {
          mmsi,
          vessel_name: name || `MMSI-${mmsi}`,
          ais_class: 'B',
        };
      }
      case 129810: {
        if (payload.length < 10) return null;
        const mmsi = payload.readUInt32LE(1);
        const callsign = payload.length >= 16 ? payload.subarray(9, 16).toString('ascii').replace(/[^\x20-\x7E]/g, '').replace(/[@_]/g, '').trim() : '';
        return {
          mmsi,
          callsign,
          ais_class: 'B',
        };
      }

      default:
        return null;
    }
  } catch (err) {
    return null;
  }
}

module.exports = {
  decodeNmea2000Payload,
};
