import { describe, it, expect } from 'vitest';
import {
  encodeLevels,
  decodeLevels,
  encodeStreamHealth,
  decodeStreamHealth,
  getMessageType,
  type BinaryLevels,
  type BinaryStreamHealth,
} from './binary-metering';

describe('binary levels protocol', () => {
  const sampleLevels: BinaryLevels = {
    inputLevel: 0.72,
    inputPeak: 0.95,
    outputLevel: 0.65,
    outputPeak: 0.88,
    remoteLevels: [
      ['user-abc-123', 0.45],
      ['user-xyz-789', 0.82],
    ],
  };

  it('roundtrips levels data correctly', () => {
    const encoded = encodeLevels(sampleLevels);
    const decoded = decodeLevels(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded!.inputLevel).toBeCloseTo(sampleLevels.inputLevel, 4);
    expect(decoded!.inputPeak).toBeCloseTo(sampleLevels.inputPeak, 4);
    expect(decoded!.outputLevel).toBeCloseTo(sampleLevels.outputLevel, 4);
    expect(decoded!.outputPeak).toBeCloseTo(sampleLevels.outputPeak, 4);
    expect(decoded!.remoteLevels.length).toBe(2);
    expect(decoded!.remoteLevels[0][0]).toBe('user-abc-123');
    expect(decoded!.remoteLevels[0][1]).toBeCloseTo(0.45, 4);
    expect(decoded!.remoteLevels[1][0]).toBe('user-xyz-789');
    expect(decoded!.remoteLevels[1][1]).toBeCloseTo(0.82, 4);
  });

  it('handles empty remote levels', () => {
    const data: BinaryLevels = {
      inputLevel: 0.5,
      inputPeak: 0.6,
      outputLevel: 0.3,
      outputPeak: 0.4,
      remoteLevels: [],
    };

    const decoded = decodeLevels(encodeLevels(data));
    expect(decoded!.remoteLevels).toEqual([]);
  });

  it('is significantly smaller than JSON', () => {
    const binary = encodeLevels(sampleLevels);
    const json = JSON.stringify({
      type: 'levels',
      ...sampleLevels,
    });

    // Binary should be at least 2x smaller than JSON
    expect(binary.byteLength).toBeLessThan(json.length / 2);
  });

  it('handles zero levels', () => {
    const data: BinaryLevels = {
      inputLevel: 0,
      inputPeak: 0,
      outputLevel: 0,
      outputPeak: 0,
      remoteLevels: [],
    };

    const decoded = decodeLevels(encodeLevels(data));
    expect(decoded!.inputLevel).toBe(0);
    expect(decoded!.outputLevel).toBe(0);
  });

  it('handles max levels (clipping)', () => {
    const data: BinaryLevels = {
      inputLevel: 1.0,
      inputPeak: 1.0,
      outputLevel: 1.0,
      outputPeak: 1.0,
      remoteLevels: [['user1', 1.0]],
    };

    const decoded = decodeLevels(encodeLevels(data));
    expect(decoded!.inputLevel).toBeCloseTo(1.0, 4);
    expect(decoded!.remoteLevels[0][1]).toBeCloseTo(1.0, 4);
  });

  it('returns null for non-levels buffers', () => {
    const healthBuffer = encodeStreamHealth({
      bufferOccupancy: 0.5,
      overflowCount: 0,
      overflowSamples: 0,
      isHealthy: true,
      msSinceLastRead: 10,
    });

    expect(decodeLevels(healthBuffer)).toBeNull();
  });
});

describe('binary stream health protocol', () => {
  const sampleHealth: BinaryStreamHealth = {
    bufferOccupancy: 0.75,
    overflowCount: 3,
    overflowSamples: 1024,
    isHealthy: true,
    msSinceLastRead: 12.5,
  };

  it('roundtrips stream health data', () => {
    const decoded = decodeStreamHealth(encodeStreamHealth(sampleHealth));

    expect(decoded).not.toBeNull();
    expect(decoded!.bufferOccupancy).toBeCloseTo(0.75, 4);
    expect(decoded!.overflowCount).toBe(3);
    expect(decoded!.overflowSamples).toBe(1024);
    expect(decoded!.isHealthy).toBe(true);
    expect(decoded!.msSinceLastRead).toBeCloseTo(12.5, 1);
  });

  it('handles unhealthy state', () => {
    const unhealthy: BinaryStreamHealth = {
      ...sampleHealth,
      isHealthy: false,
      overflowCount: 100,
    };

    const decoded = decodeStreamHealth(encodeStreamHealth(unhealthy));
    expect(decoded!.isHealthy).toBe(false);
    expect(decoded!.overflowCount).toBe(100);
  });

  it('is exactly 18 bytes', () => {
    const buffer = encodeStreamHealth(sampleHealth);
    expect(buffer.byteLength).toBe(18);
  });

  it('returns null for non-health buffers', () => {
    const levelsBuffer = encodeLevels({
      inputLevel: 0.5, inputPeak: 0.5,
      outputLevel: 0.5, outputPeak: 0.5,
      remoteLevels: [],
    });

    expect(decodeStreamHealth(levelsBuffer)).toBeNull();
  });
});

describe('getMessageType()', () => {
  it('identifies levels messages', () => {
    const buf = encodeLevels({
      inputLevel: 0, inputPeak: 0,
      outputLevel: 0, outputPeak: 0,
      remoteLevels: [],
    });
    expect(getMessageType(buf)).toBe('levels');
  });

  it('identifies streamHealth messages', () => {
    const buf = encodeStreamHealth({
      bufferOccupancy: 0, overflowCount: 0,
      overflowSamples: 0, isHealthy: true, msSinceLastRead: 0,
    });
    expect(getMessageType(buf)).toBe('streamHealth');
  });

  it('returns unknown for empty buffer', () => {
    expect(getMessageType(new ArrayBuffer(0))).toBe('unknown');
  });

  it('returns unknown for unrecognized type', () => {
    const buf = new ArrayBuffer(1);
    new DataView(buf).setUint8(0, 0xFF);
    expect(getMessageType(buf)).toBe('unknown');
  });
});
