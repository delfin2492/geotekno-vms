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
 * @param {Object} context - { agentId, port, vesselId, rawBytes }
 * @returns {Object} Setiap key dalam objek ini OTOMATIS menjadi atribut live kapal & widget dashboard!
 */
function decode(payload, context) {
  const text = String(payload).trim();

  // 1. Contoh: Tangkap dan ekstrak kalimat NMEA 0183 baru / custom (misal: Flowmeter BBM $PFLW)
  if (text.startsWith('$PFLW')) {
    const parts = text.split(',');
    return {
      fuel_flow_lph: parseFloat(parts[2]) || 0, // Otomatis muncul di Monitoring Dashboard!
      fuel_temp_c: parseFloat(parts[3]) || 0
    };
  }

  // 2. Deteksi kalimat NMEA 0183 umum
  if (text.startsWith('$') || text.startsWith('!')) {
    const parts = text.split(',');
    return {
      sentenceType: parts[0],
      rawSentence: text
    };
  }

  // 3. Frame CAN biner
  return {
    protocol: 'NMEA2000',
    status: 'ACTIVE'
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
 * @param {Object} context - { agentId, port, vesselId }
 * @returns {Object} Nilai yang dikembalikan otomatis terinjeksi ke kapal
 */
function decode(payload, context) {
  // Setiap property dalam objek ini langsung ter-pointing ke atribut kapal
  return {
    can_active: true,
    last_processed: Date.now()
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
 * @param {Object} context - { agentId, port, vesselId }
 * @returns {Object} Property yang dikembalikan langsung masuk ke dashboard & widget
 */
function decode(payload, context) {
  const line = String(payload).trim();
  const parts = line.split(',');
  const sentence = parts[0];

  // Contoh: Ekstrak sensor kustom atau tangkap data baru
  if (sentence.includes('RMC') && parts.length >= 8) {
    return {
      sog: parseFloat(parts[7]) || 0,
      cog: parseFloat(parts[8]) || 0
    };
  }

  // Menambahkan sensor baru (misal: flowmeter $PFLW,24.5,LPH)
  if (sentence.startsWith('$PFLW') && parts.length >= 2) {
    return {
      fuel_flow_lph: parseFloat(parts[1]) || 0
    };
  }

  return {
    sentenceType: sentence
  };
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
