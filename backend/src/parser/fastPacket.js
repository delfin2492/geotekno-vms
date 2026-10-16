/**
 * NMEA 2000 Fast Packet Protocol Reassembler
 */

const FAST_PACKET_PGNS = new Set([
  126996, // Product Information
  126998, // Configuration Information
  127489, // Engine Parameters, Dynamic
  128275, // Distance Log
  129029, // GNSS Position Data
  129038, // AIS Class A Position Report
  129039, // AIS Class B Position Report
  129040, // AIS Class B Extended Position Report
  129041, // AIS Aids to Navigation (AtoN) Report
  129540, // GNSS Sats in View
  129793, // AIS UTC and Date Report
  129794, // AIS Class A Static and Voyage Related Data
  129809, // AIS Class B "CS" Static Data Report, Part A
  129810, // AIS Class B "CS" Static Data Report, Part B
  130323, // Meteorological Station Data
  130845, // Proprietary Garmin / Fusion
]);

class FastPacketReassembler {
  constructor(timeoutMs = 1000) {
    this.timeoutMs = timeoutMs;
    // Key: `${source}_${pgn}` -> { seqId, totalBytes, data: Buffer, lastUpdate }
    this.sessions = new Map();
  }

  processFrame(source, pgn, rawData) {
    if (!rawData || rawData.length < 2) return null;

    const key = `${source}_${pgn}`;
    const header = rawData[0];
    const seqId = (header >> 5) & 0x07;
    const frameIndex = header & 0x1f;
    const now = Date.now();

    if (frameIndex === 0) {
      // Frame pertama: byte 1 adalah total panjang
      const totalBytes = rawData[1];
      const initialChunk = rawData.subarray(2);

      this.sessions.set(key, {
        seqId,
        totalBytes,
        data: Buffer.from(initialChunk),
        lastUpdate: now,
      });

      const session = this.sessions.get(key);
      if (session.data.length >= totalBytes) {
        this.sessions.delete(key);
        return session.data.subarray(0, totalBytes);
      }
      return null;
    }

    // Frame lanjutan (frameIndex > 0)
    const session = this.sessions.get(key);
    if (!session) {
      return null; // Kehilangan frame awal
    }

    // Cek timeout atau sequence mismatch
    if (now - session.lastUpdate > this.timeoutMs || session.seqId !== seqId) {
      this.sessions.delete(key);
      return null;
    }

    const chunk = rawData.subarray(1);
    session.data = Buffer.concat([session.data, chunk]);
    session.lastUpdate = now;

    if (session.data.length >= session.totalBytes) {
      this.sessions.delete(key);
      return session.data.subarray(0, session.totalBytes);
    }

    return null;
  }
}

module.exports = {
  FAST_PACKET_PGNS,
  FastPacketReassembler,
};
