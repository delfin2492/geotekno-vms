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

class TcpUsrAgentInstance {
  constructor(agentRow) {
    this.id = agentRow.id;
    this.name = agentRow.name;
    this.protocol = agentRow.protocol || 'TCP_CANET200';
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

      socket.on('data', (chunk) => {
        // Broadcast data mentah ke observer clients lainnya (misal: Node-RED TCP Client)
        for (const obs of this.sockets) {
          if (obs !== socket && !obs.destroyed) {
            try { obs.write(chunk); } catch (e) {}
          }
        }

        if (!chunk || chunk.length === 0) return;

        // Custom Decoder Hook jika dikonfigurasi oleh user
        if (this.customDecoderFn) {
          try {
            const customDecoded = this.customDecoderFn(chunk.toString('utf-8'), {
              agentId: this.id,
              port: this.port,
              remote: remote,
            });
            if (customDecoded) {
              logBuffer.pushLog({
                agent_id: this.id,
                vessel_id: boundAssetId || 'vessel_c2e2cffb',
                protocol: 'CUSTOM_DECODER',
                type: 'INFO',
                raw: chunk.toString('utf-8').slice(0, 100),
                decoded: customDecoded,
              });
            }
          } catch (e) {}
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
              const matched = assetManager.findAssetByCodeOrName(regStr);
              if (matched) {
                boundAssetId = matched.info.id;
                console.log(`[AGENT ${this.id}] Koneksi ${remote} BERHASIL DIHUBUNGKAN ke kapal: "${matched.info.name}" (ID: ${boundAssetId})`);
              } else {
                console.warn(`[AGENT ${this.id}] Registrasi "${regStr}" tidak cocok dengan kapal manapun.`);
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
                  vessel_id: boundAssetId || 'vessel_c2e2cffb',
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
              const importantPgns = [129025, 129026, 127250, 128267, 130306, 129038, 129039];
              if (importantPgns.includes(targetPgn) || this.totalFrames % 10 === 0) {
                let pgnLabel = `PGN ${targetPgn}`;
                if (targetPgn === 129025) pgnLabel = 'PGN 129025 (Position)';
                else if (targetPgn === 129026) pgnLabel = 'PGN 129026 (COG/SOG)';
                else if (targetPgn === 127250) pgnLabel = 'PGN 127250 (Heading)';
                else if (targetPgn === 128267) pgnLabel = 'PGN 128267 (Depth)';
                else if (targetPgn === 130306) pgnLabel = 'PGN 130306 (Wind)';
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
                  vessel_id: boundAssetId || 'vessel_c2e2cffb',
                  category: [129038, 129039].includes(targetPgn)
                    ? 'AIS'
                    : [129025, 129026].includes(targetPgn)
                    ? 'GPS'
                    : targetPgn === 127250
                    ? 'MOTION'
                    : 'N2K',
                });
              }
            }
          }
        }
      });

      socket.on('close', () => {
        console.log(`[AGENT ${this.id}] Koneksi dari ${remote} terputus.`);
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
        return;
      }
    }

    // Cari semua asset yang terhubung ke agent ini (Primary maupun Secondary)
    let dispatched = false;
    for (const [assetId, assetItem] of assetManager.assets.entries()) {
      const isPrimary = assetItem.info.agent_id === this.id;
      const isSecondary = assetItem.info.metadata?.secondary_agent_id === this.id;
      if ((isPrimary || isSecondary) && shouldAcceptCan(assetItem)) {
        assetItem.state.updateFrameStats();
        assetItem.state.updateDevice(source, pgn);
        assetItem.state.applyDecoded(pgn, source, decodedData);
        dispatched = true;
      }
    }

    if (!dispatched && assetManager.assets.size > 0) {
      const defaultAsset = assetManager.getAsset('vessel_c2e2cffb') || Array.from(assetManager.assets.values())[0];
      if (defaultAsset && shouldAcceptCan(defaultAsset)) {
        defaultAsset.state.updateFrameStats();
        defaultAsset.state.updateDevice(source, pgn);
        defaultAsset.state.applyDecoded(pgn, source, decodedData);
      }
    }

    // Auto-update MMSI dan Callsign dari PGN AIS Static
    if ((pgn === 129794 || pgn === 129809) && decodedData && (decodedData.mmsi || decodedData.callsign)) {
      const targetId = targetAssetId || 'vessel_c2e2cffb';
      assetManager.updateOwnShipIdentifiers(targetId, {
        mmsi: decodedData.mmsi,
        callsign: decodedData.callsign,
      });
    }
  }

  dispatchNmeaToAssets(decodedData, targetAssetId = null) {
    const shouldAcceptNmea = (assetItem) => {
      const mode = assetItem.info?.metadata?.ingestion_mode;
      return !mode || mode === 'HYBRID' || mode === 'RS485_ONLY';
    };

    // Auto-update MMSI, Callsign, dan IMO dari NMEA !AIVDO (Own Vessel) atau AIS Type 5
    if (decodedData && (decodedData.is_own_vessel || decodedData.type === 'VDO' || decodedData.callsign || decodedData.imo)) {
      const targetId = targetAssetId || 'vessel_c2e2cffb';
      if (decodedData.mmsi || decodedData.callsign || decodedData.imo) {
        assetManager.updateOwnShipIdentifiers(targetId, {
          mmsi: decodedData.mmsi,
          callsign: decodedData.callsign,
          imo: decodedData.imo,
        });
      }
    }

    if (targetAssetId) {
      const assetItem = assetManager.getAsset(targetAssetId);
      if (assetItem && shouldAcceptNmea(assetItem)) {
        assetItem.state.updateFrameStats();
        assetItem.state.applyNmea0183(decodedData);
        return;
      }
    }

    // Cari asset yang terhubung langsung ke agent ini (Primary maupun Secondary)
    let dispatched = false;
    for (const [assetId, assetItem] of assetManager.assets.entries()) {
      const isPrimary = assetItem.info.agent_id === this.id;
      const isSecondary = assetItem.info.metadata?.secondary_agent_id === this.id;
      if ((isPrimary || isSecondary) && shouldAcceptNmea(assetItem)) {
        assetItem.state.updateFrameStats();
        assetItem.state.applyNmea0183(decodedData);
        dispatched = true;
      }
    }

    // Fallback: teruskan ke default jika agent belum di-assign spesifik
    if (!dispatched && assetManager.assets.size > 0) {
      const defaultAsset = assetManager.getAsset('vessel_c2e2cffb') || Array.from(assetManager.assets.values())[0];
      if (defaultAsset && shouldAcceptNmea(defaultAsset)) {
        defaultAsset.state.updateFrameStats();
        defaultAsset.state.applyNmea0183(decodedData);
      }
    }
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
    return {
      id: this.id,
      name: this.name,
      protocol: this.protocol,
      config: this.config,
      port: this.port,
      status: this.status,
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
      // Pastikan Agent RS485 NMEA 0183 di port 20006 terdaftar
      await pool.query(`
        INSERT INTO core_agents (id, name, protocol, config, status)
        VALUES ('agent_f4a8b2c6', 'Agent RS485 NMEA 0183 (Port 20006)', 'TCP_NMEA0183', '{"host": "0.0.0.0", "port": 20006}', 'WAITING')
        ON CONFLICT (id) DO UPDATE SET config = '{"host": "0.0.0.0", "port": 20006}', name = 'Agent RS485 NMEA 0183 (Port 20006)'
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
        config: { port: 20005, host: '0.0.0.0' },
      });
      this.registerAndStartAgent({
        id: 'agent_f4a8b2c6',
        name: 'Agent RS485 NMEA 0183 (Port 20006)',
        protocol: 'TCP_NMEA0183',
        config: { port: 20006, host: '0.0.0.0' },
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

  async createAgent({ id, name, protocol = 'TCP_CANET200', config = {} }) {
    const agentId = id || generateAgentId();
    const configObj = typeof config === 'string' ? JSON.parse(config) : config;
    const targetPort = configObj && configObj.port ? parseInt(configObj.port, 10) : null;

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
      `INSERT INTO core_agents (id, name, protocol, config, status)
       VALUES ($1, $2, $3, $4, 'WAITING')
       ON CONFLICT (id) DO UPDATE SET name = $2, config = $4`,
      [agentId, name, protocol, configJson]
    );

    const agentRow = { id: agentId, name, protocol, config: configObj };
    return this.registerAndStartAgent(agentRow);
  }

  async updateAgent(agentId, { name, protocol, config }) {
    const existing = this.agents.get(agentId);
    if (!existing) {
      throw new Error(`Agent ${agentId} tidak ditemukan`);
    }

    const newName = name !== undefined ? name : existing.name;
    const newProtocol = protocol !== undefined ? protocol : existing.protocol;
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
       SET name = $1, protocol = $2, config = $3 
       WHERE id = $4`,
      [newName, newProtocol, configJson, agentId]
    );

    const agentRow = {
      id: agentId,
      name: newName,
      protocol: newProtocol,
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
};
