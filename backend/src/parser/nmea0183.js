/**
 * Parser NMEA 0183 untuk Garmin AquaMap & Sensor Maritim Serial RS485
 * Mendekode kalimat: RMC, GGA, DPT, DBT, HDT, HDG, MWV, VTG, MTW
 */

function parseNmeaLat(raw, dir) {
  if (!raw || !dir) return null;
  const deg = parseInt(raw.slice(0, 2), 10);
  const min = parseFloat(raw.slice(2));
  if (isNaN(deg) || isNaN(min)) return null;
  let dec = deg + (min / 60.0);
  if (dir.toUpperCase() === 'S') dec = -dec;
  return parseFloat(dec.toFixed(7));
}

function parseNmeaLon(raw, dir) {
  if (!raw || !dir) return null;
  const deg = parseInt(raw.slice(0, 3), 10);
  const min = parseFloat(raw.slice(3));
  if (isNaN(deg) || isNaN(min)) return null;
  let dec = deg + (min / 60.0);
  if (dir.toUpperCase() === 'W') dec = -dec;
  return parseFloat(dec.toFixed(7));
}

function parseNmea0183Sentence(sentence) {
  if (!sentence) return null;
  const line = sentence.trim();
  if (!line.startsWith('$') && !line.startsWith('!')) return null;

  // Pisahkan checksum jika ada
  const starIdx = line.indexOf('*');
  const payload = starIdx !== -1 ? line.slice(1, starIdx) : line.slice(1);
  const parts = payload.split(',');
  if (parts.length < 2) return null;

  const sentenceType = parts[0].slice(-3); // e.g. RMC, GGA, DPT, DBT, HDT, HDG, MWV, VTG, MTW
  const res = { type: sentenceType, raw: line };

  if (sentenceType === 'RMC') {
    // $GPRMC,045200.000,A,0610.128,S,10653.976,E,0.0,96.99,081026,,,A
    const status = parts[2];
    if (status === 'A') {
      res.latitude = parseNmeaLat(parts[3], parts[4]);
      res.longitude = parseNmeaLon(parts[5], parts[6]);
      res.sog_knots = parts[7] && parts[7].length > 0 ? parseFloat(parts[7]) : null;
      res.sog_kmh = res.sog_knots !== null ? parseFloat((res.sog_knots * 1.852).toFixed(1)) : null;
      res.cog_deg = parts[8] && parts[8].length > 0 ? parseFloat(parts[8]) : null;
      res.gnss_fix = 'GNSS Fix (GPS)';
    }
  } else if (sentenceType === 'GGA') {
    // $GPGGA,hhmmss.ss,llll.ll,a,yyyyy.yy,a,x,xx,x.x,x.x,M,x.x,M,x.x,xxxx
    const fixQuality = parseInt(parts[6] || '0', 10);
    if (fixQuality > 0) {
      res.latitude = parseNmeaLat(parts[2], parts[3]);
      res.longitude = parseNmeaLon(parts[4], parts[5]);
      res.satellites = parts[7] && parts[7].length > 0 ? parseInt(parts[7], 10) : null;
      res.hdop = parts[8] && parts[8].length > 0 ? parseFloat(parts[8]) : null;
      res.altitude_m = parts[9] && parts[9].length > 0 ? parseFloat(parts[9]) : null;
      res.gnss_fix = fixQuality === 2 ? 'DGNSS (Differential)' : 'GNSS Fix (GPS)';
    }
  } else if (sentenceType === 'DPT') {
    // $SDDPT,depth_m,offset_m
    res.depth_m = parts[1] && parts[1].length > 0 ? parseFloat(parts[1]) : null;
    res.depth_ft = res.depth_m !== null ? parseFloat((res.depth_m * 3.28084).toFixed(1)) : null;
  } else if (sentenceType === 'DBT') {
    // $SDDBT,feet,f,meters,M,fathoms,F
    res.depth_m = parts[3] && parts[3].length > 0 ? parseFloat(parts[3]) : null;
    res.depth_ft = parts[1] && parts[1].length > 0 ? parseFloat(parts[1]) : (res.depth_m !== null ? parseFloat((res.depth_m * 3.28084).toFixed(1)) : null);
  } else if (sentenceType === 'HDT') {
    // $HCHDT,heading,T
    res.heading_deg = parts[1] && parts[1].length > 0 ? parseFloat(parts[1]) : null;
    res.heading_ref = 'True';
  } else if (sentenceType === 'HDG') {
    // $HCHDG,heading_mag,dev,dev_dir,var,var_dir
    res.heading_deg = parts[1] && parts[1].length > 0 ? parseFloat(parts[1]) : null;
    res.heading_ref = 'Magnetic';
  } else if (sentenceType === 'MWV') {
    // $WIMWV,angle,R,speed,N,A
    res.wind_angle_deg = parts[1] && parts[1].length > 0 ? parseFloat(parts[1]) : null;
    res.wind_ref = parts[2] === 'R' ? 'Apparent' : 'True';
    let spd = parts[3] && parts[3].length > 0 ? parseFloat(parts[3]) : null;
    const unit = (parts[4] || 'N').toUpperCase();
    if (spd !== null) {
      if (unit === 'K') spd = spd / 1.852;
      else if (unit === 'M') spd = spd * 1.94384;
      res.wind_speed_kn = parseFloat(spd.toFixed(1));
      res.wind_speed_ms = parseFloat((spd * 0.514444).toFixed(1));
    }
  } else if (sentenceType === 'VTG') {
    // $GPVTG,track_true,T,track_mag,M,sog_knots,N,sog_kmh,K
    res.cog_deg = parts[1] && parts[1].length > 0 ? parseFloat(parts[1]) : null;
    res.sog_knots = parts[5] && parts[5].length > 0 ? parseFloat(parts[5]) : null;
    res.sog_kmh = parts[7] && parts[7].length > 0 ? parseFloat(parts[7]) : null;
  } else if (sentenceType === 'MTW') {
    // $SDMTW,temp_c,C
    res.water_temp_c = parts[1] && parts[1].length > 0 ? parseFloat(parts[1]) : null;
  } else if (sentenceType === 'VDM' || sentenceType === 'VDO') {
    // !AIVDM,1,1,,A,13u?etPv2;0n:nvK>QTransient,0*21
    const payloadStr = parts[5];
    if (payloadStr) {
      const ais = decodeAisPayload(payloadStr);
      if (ais) {
        Object.assign(res, ais);
        res.is_ais = true;
        res.is_own_vessel = (sentenceType === 'VDO');
      }
    }
  }

  return res;
}

function decodeAis6Bit(str) {
  let bitStr = '';
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i) - 48;
    if (c > 40) c -= 8;
    let b = c.toString(2);
    while (b.length < 6) b = '0' + b;
    bitStr += b;
  }
  return bitStr;
}

function parseSignedBits(bitStr) {
  if (bitStr[0] === '1') {
    const inv = bitStr.split('').map(b => b === '1' ? '0' : '1').join('');
    return -(parseInt(inv, 2) + 1);
  }
  return parseInt(bitStr, 2);
}

function decodeAisAscii(bits) {
  let str = '';
  for (let i = 0; i < bits.length; i += 6) {
    const chunk = bits.slice(i, i + 6);
    if (chunk.length < 6) break;
    let code = parseInt(chunk, 2);
    if (code === 0) continue;
    if (code < 32) code += 64;
    str += String.fromCharCode(code);
  }
  return str.replace(/[@_]/g, ' ').trim();
}

function decodeAisPayload(payloadStr) {
  if (!payloadStr || payloadStr.length < 10) return null;
  try {
    const bits = decodeAis6Bit(payloadStr);
    const msgType = parseInt(bits.slice(0, 6), 2);
    const mmsi = parseInt(bits.slice(8, 38), 2);

    if (msgType >= 1 && msgType <= 3) {
      const navStatusRaw = parseInt(bits.slice(38, 42), 2);
      const rotRaw = parseSignedBits(bits.slice(42, 50));
      const sogRaw = parseInt(bits.slice(50, 60), 2);
      const sog = sogRaw < 1023 ? parseFloat((sogRaw / 10).toFixed(1)) : null;
      const lonRaw = parseSignedBits(bits.slice(61, 89));
      const lon = lonRaw !== 0x6791AC0 ? parseFloat((lonRaw / 600000).toFixed(6)) : null;
      const latRaw = parseSignedBits(bits.slice(89, 116));
      const lat = latRaw !== 0x3412140 ? parseFloat((latRaw / 600000).toFixed(6)) : null;
      const cogRaw = parseInt(bits.slice(116, 128), 2);
      const cog = cogRaw < 3600 ? parseFloat((cogRaw / 10).toFixed(1)) : null;
      const hdgRaw = parseInt(bits.slice(128, 137), 2);
      const heading = hdgRaw < 511 ? hdgRaw : null;
      return {
        mmsi,
        sog_knots: sog,
        latitude: lat,
        longitude: lon,
        cog_deg: cog,
        heading_deg: heading,
        nav_status_code: navStatusRaw,
        rot: rotRaw,
        ais_class: 'A',
      };
    } else if (msgType === 5 && bits.length >= 240) {
      // Message Type 5: Class A Static & Voyage Data
      const imoRaw = parseInt(bits.slice(40, 70), 2);
      const imo = (imoRaw > 0 && imoRaw <= 9999999) ? String(imoRaw) : '';
      const callsign = decodeAisAscii(bits.slice(70, 112));
      const vesselName = bits.length >= 312 ? decodeAisAscii(bits.slice(112, 312)) : '';
      let shipType = null;
      let lengthM = null;
      let beamM = null;
      let draughtM = null;
      let destination = '';

      if (bits.length >= 320) {
        const typeCode = parseInt(bits.slice(312, 320), 2);
        if (typeCode === 52 || typeCode === 31 || typeCode === 32) shipType = 'Tug';
        else if (typeCode >= 80 && typeCode <= 89) shipType = 'Tanker';
        else if (typeCode >= 70 && typeCode <= 79) shipType = 'Cargo';
        else if (typeCode >= 60 && typeCode <= 69) shipType = 'Passenger';
        else if (typeCode === 30) shipType = 'Fishing';
        else if (typeCode > 0) shipType = 'Special';
      }

      if (bits.length >= 350) {
        const dimA = parseInt(bits.slice(320, 329), 2);
        const dimB = parseInt(bits.slice(329, 338), 2);
        const dimC = parseInt(bits.slice(338, 344), 2);
        const dimD = parseInt(bits.slice(344, 350), 2);
        if (dimA + dimB > 0) lengthM = dimA + dimB;
        if (dimC + dimD > 0) beamM = dimC + dimD;
      }

      if (bits.length >= 382) {
        const draughtRaw = parseInt(bits.slice(374, 382), 2);
        if (draughtRaw > 0) draughtM = parseFloat((draughtRaw / 10).toFixed(1));
      }

      if (bits.length >= 502) {
        destination = decodeAisAscii(bits.slice(382, 502));
      }

      return {
        mmsi,
        imo,
        callsign,
        vessel_name: vesselName,
        ship_type: shipType,
        length_m: lengthM,
        beam_m: beamM,
        draught_m: draughtM,
        destination,
        ais_class: 'A',
      };
    } else if (msgType === 18 || msgType === 19) {
      // Message Type 18 & 19: Class B Position Report
      const sogRaw = parseInt(bits.slice(46, 56), 2);
      const sog = sogRaw < 1023 ? parseFloat((sogRaw / 10).toFixed(1)) : null;
      const lonRaw = parseSignedBits(bits.slice(57, 85));
      const lon = lonRaw !== 0x6791AC0 ? parseFloat((lonRaw / 600000).toFixed(6)) : null;
      const latRaw = parseSignedBits(bits.slice(85, 112));
      const lat = latRaw !== 0x3412140 ? parseFloat((latRaw / 600000).toFixed(6)) : null;
      const cogRaw = parseInt(bits.slice(112, 124), 2);
      const cog = cogRaw < 3600 ? parseFloat((cogRaw / 10).toFixed(1)) : null;
      const hdgRaw = parseInt(bits.slice(124, 133), 2);
      const heading = hdgRaw < 511 ? hdgRaw : null;
      const res = {
        mmsi,
        sog_knots: sog,
        latitude: lat,
        longitude: lon,
        cog_deg: cog,
        heading_deg: heading,
        ais_class: 'B',
      };
      if (msgType === 19 && bits.length >= 300) {
        res.vessel_name = decodeAisAscii(bits.slice(143, 303));
      }
      return res;
    } else if (msgType === 24) {
      // Message Type 24: Class B Static Data
      const partNum = parseInt(bits.slice(38, 40), 2);
      if (partNum === 0 && bits.length >= 160) {
        return {
          mmsi,
          vessel_name: decodeAisAscii(bits.slice(40, 160)),
          ais_class: 'B',
        };
      } else if (partNum === 1 && bits.length >= 168) {
        const callsign = bits.length >= 132 ? decodeAisAscii(bits.slice(90, 132)) : '';
        return {
          mmsi,
          callsign,
          ais_class: 'B',
        };
      }
      return { mmsi, ais_class: 'B' };
    }
    return { mmsi };
  } catch (e) {
    return null;
  }
}

module.exports = {
  parseNmea0183Sentence,
  parseNmeaLat,
  parseNmeaLon,
  decodeAisPayload,
};
