/**
 * Binary metering protocol for bridge ↔ browser level data.
 *
 * Replaces JSON.parse/stringify for the high-frequency `levels` message
 * sent 20x/sec (every 50ms) from the native bridge. Binary encoding
 * eliminates ~0.5ms of JSON overhead per message and reduces payload
 * size from ~200 bytes (JSON) to ~30-50 bytes (binary).
 *
 * Wire format (little-endian):
 *   [0]     u8   message type (0x01 = levels, 0x02 = streamHealth)
 *   [1-4]   f32  inputLevel
 *   [5-8]   f32  inputPeak
 *   [9-12]  f32  outputLevel
 *   [13-16] f32  outputPeak
 *   [17]    u8   remoteLevelsCount (N)
 *   [18..]  N × { u8 userIdLength, utf8 userId, f32 level }
 *
 * Stream health format:
 *   [0]     u8   message type (0x02)
 *   [1-4]   f32  bufferOccupancy
 *   [5-8]   u32  overflowCount
 *   [9-12]  u32  overflowSamples
 *   [13]    u8   isHealthy (0 or 1)
 *   [14-17] f32  msSinceLastRead
 */

// Message type constants
const MSG_LEVELS = 0x01;
const MSG_STREAM_HEALTH = 0x02;

// ---------------------------------------------------------------------------
// Levels message
// ---------------------------------------------------------------------------

export interface BinaryLevels {
  inputLevel: number;
  inputPeak: number;
  outputLevel: number;
  outputPeak: number;
  remoteLevels: [string, number][];
}

/** Encode levels data to binary ArrayBuffer. */
export function encodeLevels(data: BinaryLevels): ArrayBuffer {
  // Calculate size
  let remoteSize = 0;
  for (const [userId] of data.remoteLevels) {
    remoteSize += 1 + new TextEncoder().encode(userId).length + 4; // u8 len + utf8 + f32
  }
  const totalSize = 1 + 16 + 1 + remoteSize; // type + 4 floats + count + remotes

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const encoder = new TextEncoder();
  let offset = 0;

  // Header
  view.setUint8(offset, MSG_LEVELS); offset += 1;

  // Core levels
  view.setFloat32(offset, data.inputLevel, true); offset += 4;
  view.setFloat32(offset, data.inputPeak, true); offset += 4;
  view.setFloat32(offset, data.outputLevel, true); offset += 4;
  view.setFloat32(offset, data.outputPeak, true); offset += 4;

  // Remote levels count
  view.setUint8(offset, data.remoteLevels.length); offset += 1;

  // Remote levels
  for (const [userId, level] of data.remoteLevels) {
    const encoded = encoder.encode(userId);
    view.setUint8(offset, encoded.length); offset += 1;
    new Uint8Array(buffer, offset, encoded.length).set(encoded); offset += encoded.length;
    view.setFloat32(offset, level, true); offset += 4;
  }

  return buffer;
}

/** Decode levels from binary ArrayBuffer. Returns null if not a levels message. */
export function decodeLevels(buffer: ArrayBuffer): BinaryLevels | null {
  const view = new DataView(buffer);
  const decoder = new TextDecoder();
  let offset = 0;

  const msgType = view.getUint8(offset); offset += 1;
  if (msgType !== MSG_LEVELS) return null;

  const inputLevel = view.getFloat32(offset, true); offset += 4;
  const inputPeak = view.getFloat32(offset, true); offset += 4;
  const outputLevel = view.getFloat32(offset, true); offset += 4;
  const outputPeak = view.getFloat32(offset, true); offset += 4;

  const remoteCount = view.getUint8(offset); offset += 1;
  const remoteLevels: [string, number][] = [];

  for (let i = 0; i < remoteCount; i++) {
    const idLen = view.getUint8(offset); offset += 1;
    const userId = decoder.decode(new Uint8Array(buffer, offset, idLen)); offset += idLen;
    const level = view.getFloat32(offset, true); offset += 4;
    remoteLevels.push([userId, level]);
  }

  return { inputLevel, inputPeak, outputLevel, outputPeak, remoteLevels };
}

// ---------------------------------------------------------------------------
// Stream health message
// ---------------------------------------------------------------------------

export interface BinaryStreamHealth {
  bufferOccupancy: number;
  overflowCount: number;
  overflowSamples: number;
  isHealthy: boolean;
  msSinceLastRead: number;
}

/** Encode stream health to binary. */
export function encodeStreamHealth(data: BinaryStreamHealth): ArrayBuffer {
  const buffer = new ArrayBuffer(18); // 1 + 4 + 4 + 4 + 1 + 4
  const view = new DataView(buffer);

  view.setUint8(0, MSG_STREAM_HEALTH);
  view.setFloat32(1, data.bufferOccupancy, true);
  view.setUint32(5, data.overflowCount, true);
  view.setUint32(9, data.overflowSamples, true);
  view.setUint8(13, data.isHealthy ? 1 : 0);
  view.setFloat32(14, data.msSinceLastRead, true);

  return buffer;
}

/** Decode stream health from binary. Returns null if not a health message. */
export function decodeStreamHealth(buffer: ArrayBuffer): BinaryStreamHealth | null {
  const view = new DataView(buffer);

  if (view.getUint8(0) !== MSG_STREAM_HEALTH) return null;

  return {
    bufferOccupancy: view.getFloat32(1, true),
    overflowCount: view.getUint32(5, true),
    overflowSamples: view.getUint32(9, true),
    isHealthy: view.getUint8(13) === 1,
    msSinceLastRead: view.getFloat32(14, true),
  };
}

// ---------------------------------------------------------------------------
// Dispatcher — determine message type from first byte
// ---------------------------------------------------------------------------

/** Get message type from a binary buffer. */
export function getMessageType(buffer: ArrayBuffer): 'levels' | 'streamHealth' | 'unknown' {
  if (buffer.byteLength < 1) return 'unknown';
  const type = new DataView(buffer).getUint8(0);
  switch (type) {
    case MSG_LEVELS: return 'levels';
    case MSG_STREAM_HEALTH: return 'streamHealth';
    default: return 'unknown';
  }
}
