/**
 * ISO Transport Protocol (ISO-TP) Reassembler (PGN 60416 TP.CM & PGN 60160 TP.DT)
 */

class IsoTpReassembler {
  constructor(timeoutMs = 2500) {
    this.timeoutMs = timeoutMs;
    // Key: source -> { pgn, totalBytes, totalPackets, receivedPackets: Map, lastUpdate }
    this.sessions = new Map();
  }

  processCm(source, rawData) {
    if (!rawData || rawData.length < 8) return null;

    const control = rawData[0];
    // 0x20 = BAM (Broadcast Announce Message), 0x10 = RTS (Request To Send)
    if (control !== 0x20 && control !== 0x10) return null;

    const totalBytes = rawData.readUInt16LE(1);
    const totalPackets = rawData[3];
    const pgn = (rawData[7] << 16) | (rawData[6] << 8) | rawData[5];

    this.sessions.set(source, {
      pgn,
      totalBytes,
      totalPackets,
      packets: new Map(),
      lastUpdate: Date.now(),
    });

    return null;
  }

  processDt(source, rawData) {
    if (!rawData || rawData.length < 2) return null;

    const session = this.sessions.get(source);
    if (!session) return null;

    const now = Date.now();
    if (now - session.lastUpdate > this.timeoutMs) {
      this.sessions.delete(source);
      return null;
    }

    const seq = rawData[0];
    const chunk = rawData.subarray(1);
    session.packets.set(seq, chunk);
    session.lastUpdate = now;

    if (session.packets.size >= session.totalPackets) {
      const chunks = [];
      for (let i = 1; i <= session.totalPackets; i++) {
        const c = session.packets.get(i);
        if (c) chunks.push(c);
      }
      const fullBuffer = Buffer.concat(chunks).subarray(0, session.totalBytes);
      const resPgn = session.pgn;
      this.sessions.delete(source);
      return { pgn: resPgn, payload: fullBuffer };
    }

    return null;
  }
}

module.exports = {
  IsoTpReassembler,
};
