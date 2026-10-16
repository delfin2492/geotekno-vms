export interface DecoderTemplateInfo {
  id: string
  name: string
  description: string
  decoders: ("NMEA2000" | "NMEA0183")[]
  samplePayload: string
  code: string
}

export const DECODER_TEMPLATES: Record<string, DecoderTemplateInfo> = {
  HYBRID: {
    id: "HYBRID",
    name: "Hybrid CAN (NMEA 2000) & RS-485 (NMEA 0183) — Rekomendasi",
    description: "Auto-detect frame biner CANET-200 dan kalimat teks NMEA 0183.",
    decoders: ["NMEA2000", "NMEA0183"],
    samplePayload: "$GPRMC,081836,A,3751.65,S,14507.36,E,000.0,360.0,130998,011.3,E*62",
    code: `/**
 * Hybrid Payload Decoder (NMEA 2000 CAN + NMEA 0183 ASCII)
 * @param {string|Buffer} payload - Raw byte / ASCII sentence dari gateway TCP
 * @param {Object} context - { agentId, port }
 * @returns {Object} Decoded telemetry object
 */
function decode(payload, context) {
  const text = String(payload).trim();

  // 1. Deteksi kalimat NMEA 0183 ($ atau !)
  if (text.startsWith('$') || text.startsWith('!')) {
    const parts = text.split(',');
    return {
      protocol: 'NMEA0183',
      sentenceType: parts[0],
      raw: text,
      timestamp: new Date().toISOString()
    };
  }

  // 2. Deteksi frame CAN biner CANET-200
  return {
    protocol: 'NMEA2000',
    mode: 'CANET200_AUTO',
    byteLength: typeof payload === 'string' ? payload.length : payload.byteLength,
    timestamp: new Date().toISOString()
  };
}`,
  },
  NMEA2000: {
    id: "NMEA2000",
    name: "NMEA 2000 / CANET-200 (CAN Bus)",
    description: "Mendekode PGN navigasi, rotasi mesin RPM, kedalaman, dan cuaca.",
    decoders: ["NMEA2000"],
    samplePayload: "08 00 EE FF 00 01 02 03 04 05 06 07 08",
    code: `/**
 * NMEA 2000 CANET-200 Frame Decoder
 * @param {string|Buffer} payload - 13-byte CAN frame
 * @param {Object} context - { agentId, port }
 */
function decode(payload, context) {
  // Format paket CANET-200:
  // Byte 0: Info flag (0x08 = Standard, 0x88 = Extended Frame)
  // Byte 1-4: CAN Identifier (PGN)
  // Byte 5-12: Data Payload (8 bytes)

  return {
    protocol: 'NMEA2000',
    status: 'ACTIVE',
    customScaleMultiplier: 1.0,
    timestamp: new Date().toISOString()
  };
}`,
  },
  NMEA0183: {
    id: "NMEA0183",
    name: "NMEA 0183 / RS-485 (Serial ASCII)",
    description: "Mendekode $GPRMC, $GPGGA, $GPHDT, $SDDBT, $WIMWV, !AIVDM.",
    decoders: ["NMEA0183"],
    samplePayload: "$GPRMC,081836,A,3751.65,S,14507.36,E,012.4,360.0,130998,011.3,E*62",
    code: `/**
 * NMEA 0183 Sentence Decoder
 * @param {string} payload - NMEA sentence string
 * @param {Object} context - { agentId, port }
 */
function decode(payload, context) {
  const line = String(payload).trim();
  const parts = line.split(',');
  const sentence = parts[0];

  const result = {
    protocol: 'NMEA0183',
    sentence: sentence,
    valid: true,
    timestamp: new Date().toISOString()
  };

  // Contoh ekstraksi SOG (Speed) dari $GPRMC:
  if (sentence.endsWith('RMC') && parts.length >= 8) {
    result.status = parts[2] === 'A' ? 'Valid' : 'Warning';
    result.sogKnots = parseFloat(parts[7]) || 0;
  }

  return result;
}`,
  },
  MODBUS: {
    id: "MODBUS",
    name: "Modbus TCP / RTU over TCP (Fuel & Engine)",
    description: "Mendekode register Modbus untuk flowmeter solar dan monitor genset.",
    decoders: ["NMEA0183"],
    samplePayload: "01 03 04 04 B0 03 E8 7B 4A",
    code: `/**
 * Modbus TCP Register Decoder
 * @param {string|Buffer} payload - Modbus Frame
 * @param {Object} context - { agentId, port }
 */
function decode(payload, context) {
  // Contoh decoding register:
  // Register 40001: Fuel Flow Rate (Liter/Jam)
  // Register 40002: Engine Coolant Temp (°C)

  return {
    protocol: 'MODBUS_TCP',
    engineRpm: 1200,
    fuelFlowLph: 45.5,
    coolantTempC: 78.2,
    generatorLoadPercent: 62.0,
    timestamp: new Date().toISOString()
  };
}`,
  },
  CUSTOM: {
    id: "CUSTOM",
    name: "Custom JavaScript Payload Decoder",
    description: "Buat script parsing kustom bebas untuk sensor proprietary.",
    decoders: ["NMEA2000", "NMEA0183"],
    samplePayload: "CUSTOM_SENSOR_DATA#TEMP:28.4#RPM:1450",
    code: `/**
 * Custom Data Decoder
 * @param {any} payload - Incoming raw payload (string atau Buffer)
 * @param {Object} context - { agentId, port, remote }
 * @returns {Object} Parsed telemetry data
 */
function decode(payload, context) {
  const raw = String(payload).trim();

  // Logika parsing kustom Anda:
  return {
    customProtocol: true,
    rawText: raw,
    timestamp: new Date().toISOString()
  };
}`,
  },
}
