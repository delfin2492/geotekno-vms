/**
 * Modul Parser CAN Frame USR-CANET200 & NMEA 2000 29-bit CAN ID
 */

const FRAME_SIZE = 13;

/**
 * Dekode CAN ID 29-bit NMEA 2000
 * @param {number} canId - Unsigned 32-bit CAN ID
 */
function decodeCanId(canId) {
  const priority = (canId >>> 26) & 0x07;
  const reserved = (canId >>> 25) & 0x01;
  const dataPage = (canId >>> 24) & 0x01;
  const pduFormat = (canId >>> 16) & 0xff;
  const pduSpecific = (canId >>> 8) & 0xff;
  const source = canId & 0xff;

  let pgn;
  let destination;

  if (pduFormat < 240) {
    // PDU1 format (Addressable message)
    pgn = (dataPage << 16) | (pduFormat << 8);
    destination = pduSpecific;
  } else {
    // PDU2 format (Broadcast message)
    pgn = (dataPage << 16) | (pduFormat << 8) | pduSpecific;
    destination = 0xff;
  }

  return {
    canId,
    priority,
    reserved,
    dataPage,
    pduFormat,
    pduSpecific,
    pgn,
    source,
    destination,
  };
}

/**
 * Parse raw byte stream dari USR-CANET200 menjadi list CAN Frames
 * @param {Buffer} buffer - Buffer akumulasi
 * @returns {{ frames: Array<{canId: number, data: Buffer, isExtended: boolean, info: Object}>, remainder: Buffer }}
 */
function parseUsrFrames(buffer) {
  const frames = [];
  let offset = 0;

  while (buffer.length - offset >= FRAME_SIZE) {
    const frameInfo = buffer[offset];
    const isExtended = (frameInfo & 0x80) !== 0;
    const isRtr = (frameInfo & 0x40) !== 0;
    const dlc = frameInfo & 0x0f;

    // Baca CAN ID (4 byte big-endian)
    const canId = buffer.readUInt32BE(offset + 1);
    // Baca payload 8 byte sesuai DLC
    const payload = buffer.subarray(offset + 5, offset + 5 + Math.min(dlc, 8));

    if (!isRtr) {
      const decodedInfo = decodeCanId(canId);
      frames.push({
        canId,
        isExtended,
        dlc,
        payload,
        info: decodedInfo,
      });
    }

    offset += FRAME_SIZE;
  }

  const remainder = buffer.subarray(offset);
  return { frames, remainder };
}

module.exports = {
  FRAME_SIZE,
  decodeCanId,
  parseUsrFrames,
};
