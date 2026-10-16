/**
 * Log Buffer Manager
 * Menyimpan buffer sirkular dari paket telemetri live (NMEA 0183 & NMEA 2000)
 * dan menyiarkannya via WebSocket ke UI Live Logs
 */

class LogBuffer {
  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    this.logs = [];
    this.counter = 0;
    this.listeners = new Set();
    this.pendingQueue = [];
    this.totalNmeaCount = 0;
    this.totalCanCount = 0;
  }

  addLog({
    agent_id = 'agent_unknown',
    port = 20006,
    protocol = 'NMEA0183',
    type = 'DATA',
    raw = '',
    decoded = null,
    vessel_id = 'vessel_c2e2cffb',
    category = 'GENERAL',
  }) {
    this.counter += 1;
    if (protocol === 'NMEA0183') this.totalNmeaCount += 1;
    else if (protocol === 'NMEA2000') this.totalCanCount += 1;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });

    const item = {
      id: this.counter,
      timestamp: Date.now(),
      timeStr,
      agent_id,
      port,
      protocol,
      type,
      raw: typeof raw === 'string' ? raw : JSON.stringify(raw),
      decoded,
      vessel_id,
      category,
    };

    this.logs.push(item);
    if (this.logs.length > this.maxSize) {
      this.logs.shift();
    }

    this.pendingQueue.push(item);

    // Notifikasi listener langsung jika ada
    for (const listener of this.listeners) {
      try {
        listener(item);
      } catch (e) {}
    }

    return item;
  }

  onLog(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getLogs({ limit = 100, protocol = null, type = null, search = null } = {}) {
    let result = this.logs;

    if (protocol) {
      const pUpper = protocol.toUpperCase();
      result = result.filter((l) => l.protocol.toUpperCase().includes(pUpper));
    }

    if (type) {
      const tUpper = type.toUpperCase();
      result = result.filter((l) => l.type.toUpperCase().includes(tUpper));
    }

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.raw.toLowerCase().includes(s) ||
          l.type.toLowerCase().includes(s) ||
          (l.decoded && JSON.stringify(l.decoded).toLowerCase().includes(s))
      );
    }

    const lim = Math.min(parseInt(limit, 10) || 100, this.maxSize);
    return result.slice(-lim);
  }

  flushPending() {
    const batch = this.pendingQueue;
    this.pendingQueue = [];
    return batch;
  }

  clear() {
    this.logs = [];
    this.pendingQueue = [];
    return true;
  }

  getStats() {
    return {
      total_logs_stored: this.logs.length,
      total_nmea0183_received: this.totalNmeaCount,
      total_nmea2000_received: this.totalCanCount,
      buffer_capacity: this.maxSize,
    };
  }
}

const logBuffer = new LogBuffer(600);

module.exports = {
  logBuffer,
};
