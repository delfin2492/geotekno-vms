/**
 * Agent Manager
 * Mengelola instans Agent TCP USR (dan protokol lainnya) secara dinamis
 */

const net = require('net');
const crypto = require('crypto');
const { pool } = require('../db/pool');
const { parseUsrFrames } = require('../parser/canFrame');
const { FAST_PACKET_PGNS, FastPacketReassembler } = require('../parser/fastPacket');
const { IsoTpReassembler } = require('../parser/isoTp');
const { decodeNmea2000Payload } = require('../parser/pgnDecoders');
const { parseNmea0183Sentence } = require('../parser/nmea0183');
const { assetManager } = require('../assets/assetManager');
const { logBuffer } = require('../logs/logBuffer');
const { broadcastLiveTelemetry } = require('../network/wsServer');

/**
 * Menghasilkan ID unik acak terstruktur untuk agent
 * Format: agent_ + 8 karakter hex acak (contoh: agent_c2e2cffb)
 */
function generateAgentId() {
  return `agent_${crypto.randomBytes(4).toString('hex')}`;
}

const vm = require('vm');

function compileDecoder(codeString) {
  if (!codeString || typeof codeString !== 'string' || !codeString.trim()) return null;
  try {
    const wrapped = `(function() {\n${codeString}\nreturn typeof decode === 'function' ? decode : null;\n})()`;
    return vm.runInNewContext(wrapped, {
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
    }, { timeout: 200 });
  } catch (err) {
    console.warn('[AGENT DECODER COMPILE WARN]', err.message);
    return null;
  }
}

/**
 * Checksum CRC16 Modbus RTU
 */
function calcModbusCRC16(buffer) {
  let crc = 0xFFFF;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x0001) !== 0) {
        crc = (crc >> 1) ^ 0xA001;
      } else {
        crc = crc >> 1;
      }
    }
  }
  return [crc & 0xFF, (crc >> 8) & 0xFF];
}

/**
 * Format Buffer ke string HEX spasi
 */
function toHexStr(buf) {
  return buf.toString('hex').match(/.{1,2}/g)?.join(' ').toUpperCase() || '';
}

/**
 * Decode 4-byte buffer (Byte MSB, Word LSB / CDAB) menjadi Float32
 */
function decodeFloat32CDAB(buf) {
  if (!buf || buf.length < 4) return 0;
  // Format CDAB: [b0, b1, b2, b3] -> disusun kembali ke [b2, b3, b0, b1]
  const swapped = Buffer.from([buf[2], buf[3], buf[0], buf[1]]);
  const val = swapped.readFloatBE(0);
  return Number.isFinite(val) ? Number(val.toFixed(4)) : 0;
}

/**
 * Encode Float32 dengan Byte Order MSB, Word Order LSB (CDAB / Word Swap)
 */
function encodeFloat32CDAB(value) {
  const rawBuf = Buffer.alloc(4);
  rawBuf.writeFloatBE(value, 0); // [A, B, C, D]
  // Susun ke format CDAB: [C, D, A, B]
  return Buffer.from([rawBuf[2], rawBuf[3], rawBuf[0], rawBuf[1]]);
}

/**
 * Buat paket Modbus RTU Read Request (Func 0x03)
 */
function buildModbusReadRequest(slaveId, funcCode, startAddr, regCount) {
  const raw = [
    slaveId,
    funcCode,
    (startAddr >> 8) & 0xFF,
    startAddr & 0xFF,
    (regCount >> 8) & 0xFF,
    regCount & 0xFF,
  ];
  const [crcLow, crcHigh] = calcModbusCRC16(Buffer.from(raw));
  return Buffer.from([...raw, crcLow, crcHigh]);
}

/**
 * Buat paket Modbus RTU Write Single Register 16-bit (Func 0x06)
 */
function buildModbusWriteSingleRegister(slaveId, regAddr, value) {
  const raw = [
    slaveId,
    0x06,
    (regAddr >> 8) & 0xFF,
    regAddr & 0xFF,
    (value >> 8) & 0xFF,
    value & 0xFF,
  ];
  const [crcL, crcH] = calcModbusCRC16(Buffer.from(raw));
  return Buffer.from([...raw, crcL, crcH]);
}

/**
 * Buat paket Modbus RTU Write Float32 (Func 0x10 - Write Multiple Registers 2 Regs)
 */
function buildModbusWriteFloat32(slaveId, regAddr, floatValue) {
  const floatBuf = encodeFloat32CDAB(floatValue); // 4 bytes CDAB
  const raw = [
    slaveId,
    0x10,
    (regAddr >> 8) & 0xFF,
    regAddr & 0xFF,
    0x00, 0x02, // 2 register
    0x04,       // 4 byte data
    floatBuf[0], floatBuf[1], floatBuf[2], floatBuf[3],
  ];
  const [crcL, crcH] = calcModbusCRC16(Buffer.from(raw));
  return Buffer.from([...raw, crcL, crcH]);
}

class TcpUsrAgentInstance {
  constructor(agentRow) {
    this.id = agentRow.id;
    this.name = agentRow.name;
    this.protocol = agentRow.protocol || 'TCP_CANET200';
    this.company_id = agentRow.company_id || agentRow.companyId || null;
    this.config = typeof agentRow.config === 'string' ? JSON.parse(agentRow.config) : agentRow.config || {};
    this.port = parseInt(this.config.port || 20005, 10);
    this.host = this.config.host || '0.0.0.0';

    this.server = null;
    this.activeSocket = null;
    this.sockets = new Set();
    this.status = 'OFFLINE';
    this.totalFrames = 0;
    this.frameRate = 0.0;
    this._fpsCounter = 0;
    this._lastFpsTime = Date.now();

    this.fastPacket = new FastPacketReassembler();
    this.isoTp = new IsoTpReassembler();
    this.customDecoderFn = compileDecoder(this.config.decoderCode);

    // Konfigurasi Polling Modbus Coriolis (Default aktif di port 20006 atau jika protokol TCP_MODBUS_CORIOLIS)
    this.modbusPolling = (this.protocol === 'TCP_MODBUS_CORIOLIS' || this.port === 20006 || this.config.modbusPolling === true);
    this.slaveId = this.config.slaveId || 1;
    this.startRegister = this.config.startRegister !== undefined ? this.config.startRegister : 248;
    this.registerCount = this.config.registerCount || 14;
    this.pollIntervalMs = this.config.pollIntervalMs || 2000;
    this.pendingCommandResolver = null;
  }

  start() {
    if (this.server) return;

    this.server = net.createServer((socket) => {
      const remote = `${socket.remoteAddress}:${socket.remotePort}`;
      console.log(`[AGENT ${this.id}] Klien terhubung: ${remote} (Mode: ${this.protocol}, Port: ${this.port})`);
      this.sockets.add(socket);
      this.activeSocket = socket;
      this.status = 'ONLINE';

      let rxBuffer = Buffer.alloc(0);
      let asciiLineBuffer = '';
      let boundAssetId = null;
      let isRegistered = false;
      let modbusPollTimer = null;

      // Start Polling Modbus jika dikonfigurasi (misal: Coriolis Flow Meter)
      if (this.modbusPolling) {
        socket.setKeepAlive(true, 5000);
        modbusPollTimer = setInterval(() => {
          if (!socket.writable) return;
          if (this.pendingCommandResolver) return;
          const req = buildModbusReadRequest(this.slaveId, 0x03, this.startRegister, this.registerCount);
          try { socket.write(req); } catch (e) {}
        }, this.pollIntervalMs);

        setTimeout(() => {
          if (socket.writable && !this.pendingCommandResolver) {
            const req = buildModbusReadRequest(this.slaveId, 0x03, this.startRegister, this.registerCount);
            try { socket.write(req); } catch (e) {}
          }
        }, 500);
      }

      socket.on('data', (chunk) => {
        // Broadcast data mentah ke observer clients lainnya (misal: Node-RED TCP Client)
        for (const obs of this.sockets) {
          if (obs !== socket && !obs.destroyed) {
            try { obs.write(chunk); } catch (e) {}
          }
        }

        if (!chunk || chunk.length === 0) return;

        // ==========================================
        // PIPELINE DECODER MODBUS RTU CORIOLIS FLOW METER
        // ==========================================
        if (chunk.length >= 5) {
          const dataPart = chunk.subarray(0, chunk.length - 2);
          const [crcL, crcH] = calcModbusCRC16(dataPart);
          const isModbusCrcValid = (chunk[chunk.length - 2] === crcL && chunk[chunk.length - 1] === crcH);

          if (isModbusCrcValid) {
            const rxFunc = chunk[1];

            // Respon Write Command (Func 0x06 / 0x10)
            if (rxFunc === 0x06 || rxFunc === 0x10) {
              if (this.pendingCommandResolver) {
                const resolver = this.pendingCommandResolver;
                this.pendingCommandResolver = null;
                resolver(null, { success: true, func: rxFunc, hex: toHexStr(chunk) });
              }
              return;
            }

            // Respon Modbus Exception (0x80 | func)
            if (rxFunc & 0x80) {
              const errCode = chunk[2];
              const desc = `Modbus Exception Code 0x${errCode ? errCode.toString(16) : '??'}`;
              if (this.pendingCommandResolver) {
                const resolver = this.pendingCommandResolver;
                this.pendingCommandResolver = null;
                resolver(new Error(`${desc} [${toHexStr(chunk)}]`));
              }
              return;
            }

            // Respon Read Holding Registers (Func 0x03)
            if (rxFunc === 0x03) {
              const byteCount = chunk[2];
              const payload = chunk.subarray(3, 3 + byteCount);
              if (payload.length >= 28) {
                // Ekstrak 5 parameter Coriolis (Word Swap CDAB Float32)
                const density     = decodeFloat32CDAB(payload.subarray(0, 4));   // Reg 248..249
                const temperature = decodeFloat32CDAB(payload.subarray(4, 8));   // Reg 250..251
                const flowRate    = decodeFloat32CDAB(payload.subarray(8, 12));  // Reg 252..253
                const totalMass   = decodeFloat32CDAB(payload.subarray(20, 24)); // Reg 258..259
                const totalVolume = decodeFloat32CDAB(payload.subarray(24, 28)); // Reg 260..261

                const decoded = {
                  fuel_flow_rate: flowRate,
                  fuel_total_volume: totalVolume,
                  fuel_total_mass: totalMass,
                  fuel_density: density,
                  fuel_temperature: temperature,
                };

                this.updateFps();
                this.dispatchCustomToAssets(decoded, boundAssetId);

                logBuffer.addLog({
                  agent_id: this.id,
                  port: this.port,
                  protocol: 'MODBUS',
                  type: 'CORIOLIS_TELEMETRY',
                  raw: `[SLAVE ${this.slaveId}] Flow: ${flowRate} L/h | TotVol: ${totalVolume} L | TotMass: ${totalMass} kg | Density: ${density} g/cm³ | Temp: ${temperature} °C`,
                  decoded: decoded,
                  vessel_id: boundAssetId || null,
                  category: 'MACHINERY',
                });

                if (this.totalFrames % 10 === 1) {
                  console.log(`[AGENT ${this.id}] CORIOLIS RX: Flow=${flowRate} L/h | TotVol=${totalVolume} L | TotMass=${totalMass} kg | Density=${density} g/cm³ | Temp=${temperature} °C`);
                }
                return;
              }
            }
          }
        }

        // Custom Decoder Hook jika dikonfigurasi oleh user (Alternatif Dinamis)
        if (this.customDecoderFn) {
          try {
            const customDecoded = this.customDecoderFn(chunk.toString('utf-8'), {
              agentId: this.id,
              port: this.port,
              remote: remote,
              vesselId: boundAssetId,
              rawBytes: chunk,
            });
            if (customDecoded && typeof customDecoded === 'object') {
              logBuffer.pushLog({
                agent_id: this.id,
                vessel_id: boundAssetId || 'vessel_c2e2cffb',
                protocol: 'CUSTOM_DECODER',
                type: 'CUSTOM_DATA',
                raw: chunk.toString('utf-8').slice(0, 100),
                decoded: customDecoded,
              });

              // INJEKSI LANGSUNG KE STATE KAPAL TERKAIT (ALTERNATIF DINAMIS)
              const targetAsset = boundAssetId
                ? assetManager.getAsset(boundAssetId)
                : (assetManager.getAsset('vessel_c2e2cffb') || assetManager.getAllAssets()[0]);
              if (targetAsset && targetAsset.state && typeof targetAsset.state.applyCustomData === 'function') {
                targetAsset.state.applyCustomData(customDecoded);
              }
            }
          } catch (e) {
            logBuffer.pushLog({
              agent_id: this.id,
              vessel_id: boundAssetId || 'vessel_c2e2cffb',
              protocol: 'CUSTOM_DECODER',
              type: 'ERROR',
              raw: chunk.toString('utf-8').slice(0, 100),
              decoded: { error: e.message },
            });
          }
        }

        // 1. Handshake: Deteksi Registration Packet USR di awal koneksi
        if (!isRegistered) {
          const firstByte = chunk[0];
          // Karakter ASCII printable: 0x20 s/d 0x7e (' ' s/d '~'), bukan flag CAN standard (0x08, 0x88, 0x83) atau NMEA ($ / !)
          if (
            firstByte >= 0x20 &&
            firstByte <= 0x7e &&
            firstByte !== 0x24 && // '$'
            firstByte !== 0x21 && // '!'
            firstByte !== 0x08
          ) {
            let textEnd = 0;
            while (textEnd < chunk.length && chunk[textEnd] >= 0x20 && chunk[textEnd] <= 0x7e) {
              textEnd++;
            }
            const regStr = chunk.subarray(0, textEnd).toString('ascii').trim();
            if (regStr.length > 0) {
              console.log(`[AGENT ${this.id}] Menerima Registration Packet dari ${remote}: "${regStr}"`);
              const isSharedGateway = (this.port === 20005 || this.port === 20006 || this.id === 'agent_7a3d9b1e' || this.id === 'agent_f4a8b2c6');
              const matched = assetManager.findAssetByCodeOrName(regStr);

              if (matched) {
                if (isSharedGateway) {
                  // MODEL HYBRID SHARED GATEWAY (Default Ports 20005 CAN & 20006 NMEA):
                  // Setiap kapal dari tenant manapun dapat mengirim data ke shared port ini dengan Register Content yang cocok
                  boundAssetId = matched.info.id;
                  console.log(`[AGENT ${this.id}] [SHARED GATEWAY] Koneksi ${remote} BERHASIL DIHUBUNGKAN ke kapal: "${matched.info.name}" (ID: ${boundAssetId}, Tenant: ${matched.info.company_id})`);
                } else {
                  // MODEL DEDICATED GATEWAY (Port khusus yang dibuat Superadmin untuk kapal/tenant spesifik)
                  const assignedAgents = Array.isArray(matched.info.metadata?.agentIds)
                    ? matched.info.metadata.agentIds
                    : (matched.info.agent_id ? [matched.info.agent_id] : []);
                  
                  const isAssigned = assignedAgents.includes(this.id);
                  const isCompanyMatch = !this.company_id || (matched.info.company_id === this.company_id);

                  if (isAssigned && isCompanyMatch) {
                    boundAssetId = matched.info.id;
                    console.log(`[AGENT ${this.id}] [DEDICATED GATEWAY] Koneksi ${remote} BERHASIL DIHUBUNGKAN ke kapal: "${matched.info.name}" (ID: ${boundAssetId})`);
                  } else {
                    console.warn(`[AGENT ${this.id}] Registrasi "${regStr}" (Kapal: "${matched.info.name}") DIABAIKAN karena kapal belum menghubungkan Dedicated Agent (${this.id}) atau beda tenant.`);
                  }
                }
              } else {
                console.warn(`[AGENT ${this.id}] Registrasi "${regStr}" tidak cocok dengan kapal manapun di sistem.`);
              }
              // Buang string registrasi dan delimiter trailing seperti \r, \n, \0
              while (textEnd < chunk.length && (chunk[textEnd] < 0x20 || chunk[textEnd] === 0x00)) {
                textEnd++;
              }
              chunk = chunk.subarray(textEnd);
              isRegistered = true;
              if (chunk.length === 0) return;
            }
          } else {
            isRegistered = true;
          }
        }

        // 2. Dual-Decoder Auto-Detect (NMEA-0183 ASCII vs CAN NMEA-2000 Biner)
        // Deteksi jika paket diawali '$' atau '!' atau ada buffer string NMEA yang tertunda
        const isNmeaSentence =
          asciiLineBuffer.length > 0 ||
          chunk[0] === 0x24 || // '$'
          chunk[0] === 0x21;   // '!'

        const processAsNmea = (this.protocol === 'TCP_NMEA0183') || isNmeaSentence;

        if (processAsNmea && !(rxBuffer.length > 0 && (chunk[0] & 0x80))) {
          // ==========================================
          // PIPELINE DECODER NMEA 0183 (RS-485 SERIAL ASCII)
          // ==========================================
          asciiLineBuffer += chunk.toString('utf-8');
          const lines = asciiLineBuffer.split(/\r?\n/);
          asciiLineBuffer = lines.pop(); // Sisakan baris parsial yang belum ada newline

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (trimmed.startsWith('$') || trimmed.startsWith('!')) {
              const decoded = parseNmea0183Sentence(trimmed);
              if (decoded) {
                this.updateFps();
                this.dispatchNmeaToAssets(decoded, boundAssetId);

                // Catat ke buffer log live
                logBuffer.addLog({
                  agent_id: this.id,
                  port: this.port,
                  protocol: 'NMEA0183',
                  type: decoded.type,
                  raw: trimmed,
                  decoded: decoded,
                  vessel_id: boundAssetId || null,
                  category: ['RMC', 'GGA', 'GLL', 'VTG'].includes(decoded.type)
                    ? 'GPS'
                    : ['HDT', 'HDG', 'ROT'].includes(decoded.type)
                    ? 'MOTION'
                    : ['DPT', 'DBT', 'MWV', 'MTW'].includes(decoded.type)
                    ? 'ENVIRONMENT'
                    : ['AIVDM', 'VDM'].includes(decoded.type)
                    ? 'AIS'
                    : 'NAV',
                });

                if (this.totalFrames % 50 === 1 || ['RMC', 'GGA', 'DPT', 'HDT'].includes(decoded.type)) {
                  console.log(`[AGENT ${this.id}] NMEA0183 RX [${decoded.type}]: lat=${decoded.latitude ?? '-'} lon=${decoded.longitude ?? '-'} sog=${decoded.sog_knots ?? '-'} depth=${decoded.depth_m ?? '-'} hdg=${decoded.heading_deg ?? '-'}`);
                }
              }
            }
          }
          return;
        }

        // ==========================================
        // PIPELINE DECODER CAN NMEA-2000 (CANET-200 BINER 13-BYTE)
        // ==========================================
        rxBuffer = Buffer.concat([rxBuffer, chunk]);
        const { frames, remainder } = parseUsrFrames(rxBuffer);
        rxBuffer = remainder;

        for (const frame of frames) {
          if (!frame.isExtended) continue;

          this.updateFps();
          const { pgn, source } = frame.info;

          let payloadToDecode = null;
          let targetPgn = pgn;

          if (pgn === 60416) {
            this.isoTp.processCm(source, frame.payload);
          } else if (pgn === 60160) {
            const tpRes = this.isoTp.processDt(source, frame.payload);
            if (tpRes) {
              targetPgn = tpRes.pgn;
              payloadToDecode = tpRes.payload;
            }
          } else if (FAST_PACKET_PGNS.has(pgn)) {
            const reassembled = this.fastPacket.processFrame(source, pgn, frame.payload);
            if (reassembled !== null) {
              payloadToDecode = reassembled;
            }
          } else {
            payloadToDecode = frame.payload;
          }

          if (payloadToDecode !== null) {
            const decoded = decodeNmea2000Payload(targetPgn, payloadToDecode);
            if (decoded !== null) {
              this.dispatchToAssets(targetPgn, source, decoded, boundAssetId);

              // Catat sampling frame CAN penting ke Live Data Logs
              const importantPgns = [129025, 129026, 127250, 128267, 130306, 130310, 130311, 129038, 129039];
              if (importantPgns.includes(targetPgn) || this.totalFrames % 10 === 0) {
                let pgnLabel = `PGN ${targetPgn}`;
                if (targetPgn === 129025) pgnLabel = 'PGN 129025 (Position)';
                else if (targetPgn === 129026) pgnLabel = 'PGN 129026 (COG/SOG)';
                else if (targetPgn === 127250) pgnLabel = 'PGN 127250 (Heading)';
                else if (targetPgn === 128267) pgnLabel = 'PGN 128267 (Water Depth)';
                else if (targetPgn === 130306) pgnLabel = 'PGN 130306 (Wind)';
                else if (targetPgn === 130310) pgnLabel = 'PGN 130310 (Water Temp)';
                else if (targetPgn === 130311) pgnLabel = 'PGN 130311 (Environmental)';
                else if (targetPgn === 129038) pgnLabel = `PGN 129038 (AIS ${decoded.mmsi || ''})`;
                else if (targetPgn === 129039) pgnLabel = `PGN 129039 (AIS ${decoded.mmsi || ''})`;

                const hexStr = payloadToDecode.toString('hex').toUpperCase().match(/.{1,2}/g)?.join(' ') || '';
                logBuffer.addLog({
                  agent_id: this.id,
                  port: this.port,
                  protocol: 'NMEA2000',
                  type: pgnLabel,
                  raw: `[SRC: ${source}] ${hexStr}`,
                  decoded: decoded,
                  vessel_id: boundAssetId || null,
                  category: [129038, 129039].includes(targetPgn)
                    ? 'AIS'
                    : [129025, 129026].includes(targetPgn)
                    ? 'GPS'
                    : targetPgn === 127250
                    ? 'MOTION'
                    : [128267, 130310, 130311, 130306].includes(targetPgn)
                    ? 'ENVIRONMENT'
                    : 'N2K',
                });
              }
            }
          }
        }
      });

      socket.on('close', () => {
        console.log(`[AGENT ${this.id}] Koneksi dari ${remote} terputus.`);
        if (modbusPollTimer) {
          clearInterval(modbusPollTimer);
          modbusPollTimer = null;
        }
        if (this.pendingCommandResolver) {
          this.pendingCommandResolver(new Error('Koneksi terputus saat menunggu balasan Modbus.'));
          this.pendingCommandResolver = null;
        }
        this.sockets.delete(socket);
        if (this.activeSocket === socket) {
          this.activeSocket = this.sockets.size > 0 ? Array.from(this.sockets)[0] : null;
        }
        if (this.sockets.size === 0) {
          this.status = 'WAITING';
        }
      });

      socket.on('error', (err) => {
        console.warn(`[AGENT ${this.id}] Socket error:`, err.message);
      });
    });

    this.server.on('error', (err) => {
      console.error(`[AGENT ${this.id} ERROR]`, err.message);
      this.status = 'ERROR';
    });

    try {
      this.server.listen(this.port, this.host, () => {
        this.status = 'WAITING';
        console.log(`[AGENT ${this.id}] Siap mendengarkan koneksi di port ${this.port} (Host: ${this.host}, Protokol: ${this.protocol})...`);
      });
    } catch (err) {
      console.error(`[AGENT ${this.id}] Gagal listen di port ${this.port}:`, err.message);
      this.status = 'ERROR';
    }
  }

  updateFps() {
    this.totalFrames += 1;
    this._fpsCounter += 1;
    const now = Date.now();
    const elapsed = (now - this._lastFpsTime) / 1000.0;
    if (elapsed >= 1.0) {
      this.frameRate = parseFloat((this._fpsCounter / elapsed).toFixed(1));
      this._fpsCounter = 0;
      this._lastFpsTime = now;
    }
  }

  dispatchToAssets(pgn, source, decodedData, targetAssetId = null) {
    const shouldAcceptCan = (assetItem) => {
      const mode = assetItem.info?.metadata?.ingestion_mode;
      return !mode || mode === 'HYBRID' || mode === 'CAN_ONLY';
    };

    if (targetAssetId) {
      const assetItem = assetManager.getAsset(targetAssetId);
      if (assetItem && shouldAcceptCan(assetItem)) {
        assetItem.state.updateFrameStats();
        assetItem.state.updateDevice(source, pgn);
        assetItem.state.applyDecoded(pgn, source, decodedData);
        // Loss Mode: Broadcast seketika per frame tanpa delay 1 detik
        broadcastLiveTelemetry(targetAssetId, assetItem.state.getSnapshot());
        return;
      }
    }

    const isSharedGateway = (this.port === 20005 || this.port === 20006 || this.id === 'agent_7a3d9b1e' || this.id === 'agent_f4a8b2c6');
    if (isSharedGateway) {
      // Pada Shared Gateway, jika socket tidak terikat (boundAssetId === null),
      // JANGAN fallback ke KM Geo Tekno ataupun broadcast ke kapal lain.
      return;
    }

    // Cari semua asset yang terhubung ke agent ini (Primary maupun Secondary)
    for (const [assetId, assetItem] of assetManager.assets.entries()) {
      const assigned = Array.isArray(assetItem.info.metadata?.agentIds)
        ? assetItem.info.metadata.agentIds.includes(this.id)
        : (assetItem.info.agent_id === this.id);
      const isSecondary = assetItem.info.metadata?.secondary_agent_id === this.id;
      if ((assigned || isSecondary) && shouldAcceptCan(assetItem)) {
        assetItem.state.updateFrameStats();
        assetItem.state.updateDevice(source, pgn);
        assetItem.state.applyDecoded(pgn, source, decodedData);
        // Loss Mode: Broadcast seketika per frame tanpa delay 1 detik
        broadcastLiveTelemetry(assetId, assetItem.state.getSnapshot());
      }
    }
  }

  dispatchNmeaToAssets(decodedData, targetAssetId = null) {
    const shouldAcceptNmea = (assetItem) => {
      const mode = assetItem.info?.metadata?.ingestion_mode;
      return !mode || mode === 'HYBRID' || mode === 'RS485_ONLY';
    };

    if (targetAssetId) {
      const assetItem = assetManager.getAsset(targetAssetId);
      if (assetItem && shouldAcceptNmea(assetItem)) {
        assetItem.state.updateFrameStats();
        assetItem.state.applyNmea0183(decodedData);
        // Loss Mode: Broadcast seketika per frame tanpa delay 1 detik
        broadcastLiveTelemetry(targetAssetId, assetItem.state.getSnapshot());

        // Auto-update MMSI, Callsign, IMO, dan Destination HANYA dari NMEA !AIVDO (Own Vessel VHF Transponder)
        // JANGAN pernah mengupdate dari !AIVDM karena AIVDM adalah target kapal lain di sekitar
        if (decodedData && (decodedData.is_own_vessel === true || decodedData.type === 'VDO')) {
          if (decodedData.mmsi || decodedData.callsign || decodedData.imo || decodedData.destination) {
            assetManager.updateOwnShipIdentifiers(targetAssetId, {
              mmsi: decodedData.mmsi,
              callsign: decodedData.callsign,
              imo: decodedData.imo,
              destination: decodedData.destination,
            });
          }
        }
        return;
      }
    }

    const isSharedGateway = (this.port === 20005 || this.port === 20006 || this.id === 'agent_7a3d9b1e' || this.id === 'agent_f4a8b2c6');
    if (isSharedGateway) {
      // Pada Shared Gateway, jika socket tidak terikat (boundAssetId === null),
      // JANGAN fallback ke KM Geo Tekno ataupun broadcast ke kapal lain.
      return;
    }

    // Cari asset yang terhubung langsung ke agent ini (Primary maupun Secondary)
    for (const [assetId, assetItem] of assetManager.assets.entries()) {
      const assigned = Array.isArray(assetItem.info.metadata?.agentIds)
        ? assetItem.info.metadata.agentIds.includes(this.id)
        : (assetItem.info.agent_id === this.id);
      const isSecondary = assetItem.info.metadata?.secondary_agent_id === this.id;
      if ((assigned || isSecondary) && shouldAcceptNmea(assetItem)) {
        assetItem.state.updateFrameStats();
        assetItem.state.applyNmea0183(decodedData);
        // Loss Mode: Broadcast seketika per frame tanpa delay 1 detik
        broadcastLiveTelemetry(assetId, assetItem.state.getSnapshot());
      }
    }
  }

  dispatchCustomToAssets(decodedData, targetAssetId = null) {
    if (targetAssetId) {
      const assetItem = assetManager.getAsset(targetAssetId);
      if (assetItem && assetItem.state) {
        assetItem.state.updateFrameStats();
        assetItem.state.applyCustomData(decodedData);
        broadcastLiveTelemetry(targetAssetId, assetItem.state.getSnapshot());
        return;
      }
    }

    let dispatched = false;
    for (const [assetId, assetItem] of assetManager.assets.entries()) {
      const assigned = Array.isArray(assetItem.info.metadata?.agentIds)
        ? assetItem.info.metadata.agentIds.includes(this.id)
        : (assetItem.info.agent_id === this.id);
      const isSecondary = assetItem.info.metadata?.secondary_agent_id === this.id;
      if (assigned || isSecondary) {
        dispatched = true;
        assetItem.state.updateFrameStats();
        assetItem.state.applyCustomData(decodedData);
        broadcastLiveTelemetry(assetId, assetItem.state.getSnapshot());
      }
    }

    // Fallback: Jika port shared (20006) dan belum spesifik terikat, suntikkan ke kapal utama
    if (!dispatched) {
      const all = assetManager.getAllAssets();
      const primary = all.find((a) => a.id === 'vessel_c2e2cffb') || all[0];
      if (primary && primary.state) {
        primary.state.updateFrameStats();
        primary.state.applyCustomData(decodedData);
        broadcastLiveTelemetry(primary.id, primary.state.getSnapshot());
      }
    }
  }

  sendCoriolisCommand(packetBuffer, timeoutMs = 2500) {
    return new Promise((resolve, reject) => {
      if (!this.activeSocket || !this.activeSocket.writable) {
        return reject(new Error('Koneksi flow meter USR-CANET200 tidak aktif atau terputus!'));
      }

      const timeout = setTimeout(() => {
        this.pendingCommandResolver = null;
        reject(new Error(`Timeout: Tidak ada balasan dari flow meter (2.5 detik). Paket: [${toHexStr(packetBuffer)}]`));
      }, timeoutMs);

      this.pendingCommandResolver = (err, res) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve(res);
      };

      try {
        this.activeSocket.write(packetBuffer);
      } catch (err) {
        clearTimeout(timeout);
        this.pendingCommandResolver = null;
        reject(err);
      }
    });
  }

  stop() {
    if (this.activeSocket) {
      try { this.activeSocket.destroy(); } catch (e) {}
      this.activeSocket = null;
    }
    if (this.server) {
      try { this.server.close(); } catch (e) {}
      this.server = null;
    }
    this.status = 'OFFLINE';
  }

  getStatus() {
    const cfg = this.config || {};
    return {
      id: this.id,
      name: this.name,
      protocol: this.protocol,
      company_id: this.company_id,
      companyId: this.company_id,
      config: this.config,
      port: this.port,
      host: this.host || cfg.host || '0.0.0.0',
      decoders: cfg.decoders || ['NMEA2000', 'NMEA0183'],
      decoderTemplate: cfg.decoderTemplate || 'HYBRID',
      decoderCode: cfg.decoderCode || '',
      packetsPerMinute: Math.round((this.frameRate || 0) * 60) || 0,
      status: this.status === 'ONLINE' ? 'connected' : (this.status === 'WAITING' ? 'disconnected' : 'error'),
      connected_client: this.activeSocket ? `${this.activeSocket.remoteAddress}:${this.activeSocket.remotePort}` : null,
      total_frames: this.totalFrames,
      frame_rate: this.frameRate,
    };
  }
}

class AgentManager {
  constructor() {
    // Map: agentId -> TcpUsrAgentInstance
    this.agents = new Map();
  }

  async init() {
    try {
      // Pastikan Agent Coriolis Flow Meter di port 20006 terdaftar
      await pool.query(`
        INSERT INTO core_agents (id, name, protocol, config, status, company_id)
        VALUES ('agent_f4a8b2c6', 'Agent Coriolis Flow Meter (Port 20006)', 'TCP_MODBUS_CORIOLIS', '{"host": "0.0.0.0", "port": 20006, "modbusPolling": true, "slaveId": 1, "startRegister": 248, "registerCount": 14, "pollIntervalMs": 2000}', 'WAITING', 'comp_geotekno')
        ON CONFLICT (id) DO UPDATE SET 
          config = '{"host": "0.0.0.0", "port": 20006, "modbusPolling": true, "slaveId": 1, "startRegister": 248, "registerCount": 14, "pollIntervalMs": 2000}',
          name = 'Agent Coriolis Flow Meter (Port 20006)',
          protocol = 'TCP_MODBUS_CORIOLIS',
          company_id = 'comp_geotekno'
      `);

      const res = await pool.query('SELECT * FROM core_agents ORDER BY created_at ASC');
      for (const row of res.rows) {
        this.registerAndStartAgent(row);
      }
      console.log(`[AGENT MANAGER] Memuat dan menjalankan ${this.agents.size} agent dari database.`);
    } catch (err) {
      console.warn('[AGENT MANAGER WARN] Gagal memuat agent awal:', err.message);
      // Fallback agent port 20005 & 20006
      this.registerAndStartAgent({
        id: 'agent_7a3d9b1e',
        name: 'Agent TCP USR-CANET200 (Default)',
        protocol: 'TCP_CANET200',
        company_id: 'comp_geotekno',
        config: { port: 20005, host: '0.0.0.0' },
      });
      this.registerAndStartAgent({
        id: 'agent_f4a8b2c6',
        name: 'Agent Coriolis Flow Meter (Port 20006)',
        protocol: 'TCP_MODBUS_CORIOLIS',
        company_id: 'comp_geotekno',
        config: { port: 20006, host: '0.0.0.0', modbusPolling: true, slaveId: 1, startRegister: 248, registerCount: 14, pollIntervalMs: 2000 },
      });
    }
  }

  registerAndStartAgent(agentRow) {
    let existing = this.agents.get(agentRow.id);
    if (existing) {
      existing.stop();
    }
    const instance = new TcpUsrAgentInstance(agentRow);
    this.agents.set(agentRow.id, instance);
    instance.start();
    return instance;
  }

  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  getAllAgents() {
    const list = [];
    for (const [id, agent] of this.agents.entries()) {
      list.push(agent.getStatus());
    }
    return list;
  }

  async createAgent({ id, name, protocol = 'TCP_CANET200', company_id, config = {} }) {
    const agentId = id || generateAgentId();
    const configObj = typeof config === 'string' ? JSON.parse(config) : config;
    const targetPort = configObj && configObj.port ? parseInt(configObj.port, 10) : null;
    const compId = company_id !== undefined ? company_id : 'comp_geotekno';

    if (targetPort) {
      if ([8080, 5432, 3000, 80].includes(targetPort)) {
        throw new Error(`Port ${targetPort} adalah port sistem inti dan tidak boleh digunakan!`);
      }
      for (const [aid, agent] of this.agents.entries()) {
        if (agent.port === targetPort && aid !== agentId) {
          throw new Error(`Port ${targetPort} sudah digunakan oleh Agent "${agent.name}"!`);
        }
      }
    }

    const configJson = JSON.stringify(configObj);

    await pool.query(
      `INSERT INTO core_agents (id, name, protocol, config, company_id, status)
       VALUES ($1, $2, $3, $4, $5, 'WAITING')
       ON CONFLICT (id) DO UPDATE SET name = $2, config = $4, company_id = $5`,
      [agentId, name, protocol, configJson, compId]
    );

    const agentRow = { id: agentId, name, protocol, company_id: compId, config: configObj };
    return this.registerAndStartAgent(agentRow);
  }

  async updateAgent(agentId, { name, protocol, company_id, config }) {
    const existing = this.agents.get(agentId);
    if (!existing) {
      throw new Error(`Agent ${agentId} tidak ditemukan`);
    }

    const newName = name !== undefined ? name : existing.name;
    const newProtocol = protocol !== undefined ? protocol : existing.protocol;
    const newCompanyId = company_id !== undefined ? company_id : existing.company_id;
    const newConfig = config !== undefined ? (typeof config === 'string' ? JSON.parse(config) : config) : existing.config;
    const targetPort = newConfig && newConfig.port ? parseInt(newConfig.port, 10) : null;

    if (targetPort) {
      if ([8080, 5432, 3000, 80].includes(targetPort)) {
        throw new Error(`Port ${targetPort} adalah port sistem inti dan tidak boleh digunakan!`);
      }
      for (const [aid, agent] of this.agents.entries()) {
        if (agent.port === targetPort && aid !== agentId) {
          throw new Error(`Port ${targetPort} sudah digunakan oleh Agent "${agent.name}"!`);
        }
      }
    }

    const configJson = JSON.stringify(newConfig);

    await pool.query(
      `UPDATE core_agents 
       SET name = $1, protocol = $2, config = $3, company_id = $4 
       WHERE id = $5`,
      [newName, newProtocol, configJson, newCompanyId, agentId]
    );

    const agentRow = {
      id: agentId,
      name: newName,
      protocol: newProtocol,
      company_id: newCompanyId,
      config: newConfig,
    };
    return this.registerAndStartAgent(agentRow);
  }

  async deleteAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.stop();
      this.agents.delete(agentId);
    }
    await pool.query('DELETE FROM core_agents WHERE id = $1', [agentId]);
    return true;
  }
}

const agentManager = new AgentManager();

module.exports = {
  agentManager,
  buildModbusWriteFloat32,
  buildModbusWriteSingleRegister,
};
