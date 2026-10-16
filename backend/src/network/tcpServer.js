const net = require('net');
const { parseUsrFrames } = require('../parser/canFrame');
const { FAST_PACKET_PGNS, FastPacketReassembler } = require('../parser/fastPacket');
const { IsoTpReassembler } = require('../parser/isoTp');
const { decodeNmea2000Payload } = require('../parser/pgnDecoders');

function createTcpServer(config, vesselState) {
  const fastPacket = new FastPacketReassembler();
  const isoTp = new IsoTpReassembler();

  let activeSocket = null;

  const server = net.createServer((socket) => {
    const remote = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[TCP SERVER] Klien terhubung: ${remote}`);
    activeSocket = socket;

    let rxBuffer = Buffer.alloc(0);

    socket.on('data', (chunk) => {
      rxBuffer = Buffer.concat([rxBuffer, chunk]);

      const { frames, remainder } = parseUsrFrames(rxBuffer);
      rxBuffer = remainder;

      for (const frame of frames) {
        if (!frame.isExtended) continue;

        const { pgn, source } = frame.info;
        vesselState.updateFrameStats();
        vesselState.updateDevice(source, pgn);

        let payloadToDecode = null;
        let targetPgn = pgn;

        // ISO Transport Protocol (PGN 60416 & 60160)
        if (pgn === 60416) {
          isoTp.processCm(source, frame.payload);
        } else if (pgn === 60160) {
          const tpRes = isoTp.processDt(source, frame.payload);
          if (tpRes) {
            targetPgn = tpRes.pgn;
            payloadToDecode = tpRes.payload;
          }
        }
        // Fast Packet Protocol
        else if (FAST_PACKET_PGNS.has(pgn)) {
          const reassembled = fastPacket.processFrame(source, pgn, frame.payload);
          if (reassembled !== null) {
            payloadToDecode = reassembled;
          }
        }
        // Single Frame Payload
        else {
          payloadToDecode = frame.payload;
        }

        // Dekode jika payload lengkap
        if (payloadToDecode !== null) {
          const decoded = decodeNmea2000Payload(targetPgn, payloadToDecode);
          if (decoded !== null) {
            vesselState.applyDecoded(targetPgn, source, decoded);
          }
        }
      }
    });

    socket.on('close', () => {
      console.log(`[TCP SERVER] Koneksi dari ${remote} terputus.`);
      if (activeSocket === socket) activeSocket = null;
    });

    socket.on('error', (err) => {
      console.warn(`[TCP SERVER] Error koneksi (${remote}):`, err.message);
    });
  });

  server.on('error', (err) => {
    console.error('[TCP SERVER FATAL]', err.message);
  });

  return {
    server,
    listen: () => {
      server.listen(config.tcp.port, config.tcp.host, () => {
        console.log(`[TCP SERVER] Mendengarkan koneksi USR-CANET200 di ${config.tcp.host}:${config.tcp.port}...`);
      });
    },
    getActiveSocket: () => activeSocket,
  };
}

module.exports = {
  createTcpServer,
};
