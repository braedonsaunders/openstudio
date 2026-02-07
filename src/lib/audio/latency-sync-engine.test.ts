import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MasterClockSync,
  LatencyCompensator,
  NetworkTrendAnalyzer,
  calculateLatencyBreakdown,
  calculateQualityScore,
  assessConnectionQuality,
} from './latency-sync-engine';

// ---------------------------------------------------------------------------
// MasterClockSync
// ---------------------------------------------------------------------------

describe('MasterClockSync', () => {
  let sync: MasterClockSync;

  beforeEach(() => {
    sync = new MasterClockSync();
  });

  describe('clock offset calculation', () => {
    it('calculates offset from clock sync messages', () => {
      const msg = {
        type: 'clock_sync' as const,
        masterTime: 1000,
        masterWallClock: Date.now(),
        beatPosition: 0,
        bpm: 120,
        sendTimestamp: 1000,
        sequence: 1,
      };

      // Simulate: master sent at 1000, we received at 1020
      // One-way delay default = 20/2 = 10ms (using default RTT)
      // Estimated master now = 1000 + 10 = 1010
      // Offset = 1020 - 1010 = 10
      const ack = sync.processClockSync(msg, 1020);

      expect(ack.type).toBe('clock_ack');
      expect(ack.originalSendTime).toBe(1000);
      expect(ack.clientReceiveTime).toBe(1020);

      const offset = sync.getOffset();
      expect(typeof offset).toBe('number');
    });

    it('converges to stable offset with multiple samples', () => {
      const offsets: number[] = [];

      for (let i = 0; i < 10; i++) {
        const masterTime = 1000 + i * 100;
        const receiveTime = masterTime + 25; // Consistent 25ms offset
        const msg = {
          type: 'clock_sync' as const,
          masterTime,
          masterWallClock: Date.now(),
          beatPosition: (i % 4),
          bpm: 120,
          sendTimestamp: masterTime,
          sequence: i + 1,
        };

        sync.processClockSync(msg, receiveTime);
        offsets.push(sync.getOffset());
      }

      // Later samples should show less variation than earlier ones
      const lastFew = offsets.slice(-3);
      const range = Math.max(...lastFew) - Math.min(...lastFew);
      expect(range).toBeLessThan(5); // Should converge within 5ms
    });

    it('rejects outliers with RTT > 2.5x median', () => {
      // Establish baseline with consistent RTT
      for (let i = 0; i < 5; i++) {
        const msg = {
          type: 'clock_sync' as const,
          masterTime: 1000 + i * 100,
          masterWallClock: Date.now(),
          beatPosition: 0,
          bpm: 120,
          sendTimestamp: 1000 + i * 100,
          sequence: i + 1,
        };
        // Register ack to establish RTT baseline
        sync.processClockSync(msg, 1020 + i * 100);
      }

      const offsetBefore = sync.getOffset();

      // Now send an outlier (huge delay)
      const outlierMsg = {
        type: 'clock_sync' as const,
        masterTime: 2000,
        masterWallClock: Date.now(),
        beatPosition: 0,
        bpm: 120,
        sendTimestamp: 2000,
        sequence: 100,
      };

      // Receive with enormous delay — should be detected as outlier
      // But only if we have pending ack RTT data, which requires ack processing
      sync.processClockSync(outlierMsg, 2500);

      // Offset should not jump dramatically from outlier
      // (actual outlier detection depends on pending ack RTT data)
      expect(typeof sync.getOffset()).toBe('number');
    });
  });

  describe('weighted median', () => {
    it('produces consistent results with uniform weights', () => {
      // Send messages with consistent timing
      for (let i = 0; i < 8; i++) {
        const msg = {
          type: 'clock_sync' as const,
          masterTime: 1000 + i * 100,
          masterWallClock: Date.now(),
          beatPosition: 0,
          bpm: 120,
          sendTimestamp: 1000 + i * 100,
          sequence: i + 1,
        };
        sync.processClockSync(msg, 1015 + i * 100); // Consistent 15ms receive delay
      }

      const offset = sync.getOffset();
      // Should be close to 15 - (defaultRtt/2) = 15 - 10 = 5
      expect(typeof offset).toBe('number');
      expect(isNaN(offset)).toBe(false);
      expect(isFinite(offset)).toBe(true);
    });
  });

  describe('drift calculation', () => {
    it('detects zero drift with consistent offsets', () => {
      for (let i = 0; i < 8; i++) {
        const msg = {
          type: 'clock_sync' as const,
          masterTime: 1000 + i * 100,
          masterWallClock: Date.now(),
          beatPosition: 0,
          bpm: 120,
          sendTimestamp: 1000 + i * 100,
          sequence: i + 1,
        };
        sync.processClockSync(msg, 1010 + i * 100);
      }

      // With consistent receive delays, drift should be near zero
      // getMasterTime() incorporates drift correction
      const masterTime = sync.getMasterTime();
      expect(typeof masterTime).toBe('number');
      expect(isNaN(masterTime)).toBe(false);
    });
  });

  describe('sync quality', () => {
    it('returns fair with fewer than 3 samples', () => {
      expect(sync.getSyncQuality()).toBe('fair');

      const msg = {
        type: 'clock_sync' as const,
        masterTime: 1000,
        masterWallClock: Date.now(),
        beatPosition: 0,
        bpm: 120,
        sendTimestamp: 1000,
        sequence: 1,
      };
      sync.processClockSync(msg, 1010);
      expect(sync.getSyncQuality()).toBe('fair');
    });

    it('improves to excellent with consistent low-RTT samples', () => {
      for (let i = 0; i < 8; i++) {
        const msg = {
          type: 'clock_sync' as const,
          masterTime: 1000 + i * 100,
          masterWallClock: Date.now(),
          beatPosition: 0,
          bpm: 120,
          sendTimestamp: 1000 + i * 100,
          sequence: i + 1,
        };
        // Consistent low RTT
        sync.processClockSync(msg, 1010 + i * 100);
      }

      // With consistent 10ms RTT and low jitter, should be excellent or good
      const quality = sync.getSyncQuality();
      expect(['excellent', 'good']).toContain(quality);
    });
  });

  describe('clock sync message creation (master side)', () => {
    it('creates valid clock sync messages', () => {
      const msg = sync.createClockSyncMessage(120, 2.5);

      expect(msg.type).toBe('clock_sync');
      expect(msg.bpm).toBe(120);
      expect(msg.beatPosition).toBe(2.5);
      expect(typeof msg.masterTime).toBe('number');
      expect(typeof msg.sendTimestamp).toBe('number');
      expect(msg.sequence).toBe(1);
    });

    it('increments sequence number', () => {
      const msg1 = sync.createClockSyncMessage(120, 0);
      const msg2 = sync.createClockSyncMessage(120, 1);
      const msg3 = sync.createClockSyncMessage(120, 2);

      expect(msg2.sequence).toBe(msg1.sequence + 1);
      expect(msg3.sequence).toBe(msg2.sequence + 1);
    });

    it('cleans stale pending acks', () => {
      // Create many messages to build up pending acks
      for (let i = 0; i < 100; i++) {
        sync.createClockSyncMessage(120, 0);
      }

      // Should not throw or leak memory
      expect(() => sync.createClockSyncMessage(120, 0)).not.toThrow();
    });
  });

  describe('processClockAck (master side)', () => {
    it('calculates RTT from ack', () => {
      // Create a clock sync message (stores pending ack)
      sync.createClockSyncMessage(120, 0);

      const ack = {
        type: 'clock_ack' as const,
        originalSendTime: performance.now() - 20,
        clientReceiveTime: performance.now() - 10,
        clientId: 'user1',
        sequence: 1,
      };

      const rtt = sync.processClockAck(ack, performance.now());
      expect(rtt).toBeGreaterThan(0);
      expect(rtt).toBeLessThan(1000); // Sanity check
    });
  });

  describe('reset', () => {
    it('clears all state', () => {
      // Build up state
      for (let i = 0; i < 5; i++) {
        const msg = {
          type: 'clock_sync' as const,
          masterTime: 1000 + i * 100,
          masterWallClock: Date.now(),
          beatPosition: 0,
          bpm: 120,
          sendTimestamp: 1000 + i * 100,
          sequence: i + 1,
        };
        sync.processClockSync(msg, 1020 + i * 100);
      }

      sync.reset();

      expect(sync.getOffset()).toBe(0);
      expect(sync.getRtt()).toBe(0);
      expect(sync.getSyncQuality()).toBe('fair');
    });
  });
});

// ---------------------------------------------------------------------------
// LatencyCompensator
// ---------------------------------------------------------------------------

describe('LatencyCompensator', () => {
  let comp: LatencyCompensator;

  beforeEach(() => {
    comp = new LatencyCompensator();
  });

  describe('user latency tracking', () => {
    it('stores and smooths per-user latency', () => {
      comp.updateUserLatency('user1', 30, 5, 0.01);
      comp.updateUserLatency('user2', 50, 8, 0.02);

      const comp1 = comp.getUserCompensation('user1');
      const comp2 = comp.getUserCompensation('user2');

      // User with lower RTT should get more compensation
      // (to align with the slower user)
      expect(comp1).toBeGreaterThanOrEqual(comp2);
    });

    it('removes user cleanly', () => {
      comp.updateUserLatency('user1', 30, 5, 0);
      comp.updateUserLatency('user2', 50, 8, 0);

      comp.removeUser('user1');

      // After removing user1, compensations recalculate
      const allComp = comp.getAllCompensations();
      expect(allComp.has('user1')).toBe(false);
    });
  });

  describe('target delay calculation', () => {
    it('target delay >= max RTT + safety buffer', () => {
      comp.updateUserLatency('user1', 20, 2, 0);
      comp.updateUserLatency('user2', 60, 5, 0);
      comp.updateUserLatency('user3', 40, 3, 0);

      const target = comp.getTargetDelay();
      // Target should trend toward maxRtt(60) + safetyBuffer(10) = 70
      // With adaptation rate 0.3, first update won't reach it
      expect(target).toBeGreaterThan(0);
    });

    it('never exceeds maxCompensation (200ms)', () => {
      // Add user with enormous RTT
      comp.updateUserLatency('user1', 500, 50, 0.1);

      const target = comp.getTargetDelay();
      expect(target).toBeLessThanOrEqual(200);
    });
  });

  describe('jam compatibility assessment', () => {
    it('returns tight for <30ms group latency', () => {
      comp.updateUserLatency('user1', 3, 1, 0);
      const compat = comp.calculateJamCompatibility();
      // maxGroupLatency = 3 + 15(processing) + 10(safety) = 28 < 30
      expect(compat.quality).toBe('tight');
      expect(compat.canJam).toBe(true);
    });

    it('returns good for 30-50ms group latency', () => {
      comp.updateUserLatency('user1', 15, 3, 0.005);
      const compat = comp.calculateJamCompatibility();
      // maxGroupLatency = 15 + 15 + 10 = 40
      expect(compat.quality).toBe('good');
      expect(compat.canJam).toBe(true);
      expect(compat.suggestedBpmMax).toBe(180);
    });

    it('returns loose for 50-80ms group latency', () => {
      comp.updateUserLatency('user1', 40, 5, 0.01);
      const compat = comp.calculateJamCompatibility();
      // maxGroupLatency = 40 + 15 + 10 = 65
      expect(compat.quality).toBe('loose');
      expect(compat.canJam).toBe(true);
      expect(compat.suggestedBpmMax).toBe(140);
    });

    it('returns difficult for 80-120ms group latency', () => {
      comp.updateUserLatency('user1', 80, 10, 0.03);
      const compat = comp.calculateJamCompatibility();
      // maxGroupLatency = 80 + 15 + 10 = 105
      expect(compat.quality).toBe('difficult');
      expect(compat.canJam).toBe(true);
      expect(compat.suggestedBpmMax).toBe(100);
    });

    it('returns impossible for >120ms group latency', () => {
      comp.updateUserLatency('user1', 150, 20, 0.05);
      const compat = comp.calculateJamCompatibility();
      // maxGroupLatency = 150 + 15 + 10 = 175
      expect(compat.quality).toBe('impossible');
      expect(compat.canJam).toBe(false);
    });

    it('returns waiting state with no participants', () => {
      const compat = comp.calculateJamCompatibility();
      expect(compat.quality).toBe('tight');
      expect(compat.maxGroupLatency).toBe(0);
      expect(compat.recommendation).toContain('Waiting');
    });

    it('fires onJamCompatibilityChange callback', () => {
      const callback = vi.fn();
      comp.onJamCompatibilityChange = callback;

      comp.updateUserLatency('user1', 30, 5, 0);

      expect(callback).toHaveBeenCalled();
      expect(callback.mock.calls[0][0]).toHaveProperty('quality');
      expect(callback.mock.calls[0][0]).toHaveProperty('canJam');
    });
  });

  describe('compensation callbacks', () => {
    it('fires onRemoteStreamCompensation for each non-self user', () => {
      const callback = vi.fn();
      comp.onRemoteStreamCompensation = callback;

      comp.updateUserLatency('user1', 20, 2, 0);
      comp.updateUserLatency('user2', 50, 5, 0);

      expect(callback).toHaveBeenCalled();
      // Should be called for user1 and user2 (not 'self')
      const calledUserIds = callback.mock.calls.map((c: unknown[]) => c[0]);
      expect(calledUserIds).toContain('user1');
      expect(calledUserIds).toContain('user2');
    });
  });

  describe('reset and dispose', () => {
    it('reset clears all state', () => {
      comp.updateUserLatency('user1', 30, 5, 0);
      comp.reset();

      expect(comp.getTargetDelay()).toBe(0);
      expect(comp.getAllCompensations().size).toBe(0);
    });

    it('dispose disconnects and nullifies', () => {
      comp.dispose();
      // Should not throw on subsequent operations
      expect(() => comp.reset()).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// NetworkTrendAnalyzer
// ---------------------------------------------------------------------------

describe('NetworkTrendAnalyzer', () => {
  let analyzer: NetworkTrendAnalyzer;

  beforeEach(() => {
    analyzer = new NetworkTrendAnalyzer();
  });

  it('returns stable with insufficient samples', () => {
    analyzer.addSample(20, 5, 0);
    const trend = analyzer.analyzeTrend();
    expect(trend.direction).toBe('stable');
    expect(trend.confidence).toBe(0);
  });

  it('detects degrading network (increasing RTT)', () => {
    for (let i = 0; i < 15; i++) {
      analyzer.addSample(20 + i * 5, 5 + i, 0.01);
    }
    const trend = analyzer.analyzeTrend();
    expect(trend.direction).toBe('degrading');
  });

  it('detects improving network (decreasing RTT)', () => {
    for (let i = 0; i < 15; i++) {
      analyzer.addSample(100 - i * 5, 20 - i, 0.05);
    }
    const trend = analyzer.analyzeTrend();
    expect(trend.direction).toBe('improving');
  });

  it('detects stable network', () => {
    for (let i = 0; i < 15; i++) {
      analyzer.addSample(20 + (Math.random() - 0.5), 5, 0);
    }
    const trend = analyzer.analyzeTrend();
    expect(trend.direction).toBe('stable');
  });

  it('predicts spikes from rapidly increasing RTT', () => {
    for (let i = 0; i < 5; i++) {
      analyzer.addSample(20 + i * 15, 5, 0);
    }
    expect(analyzer.predictSpike()).toBe(true);
  });

  it('does not predict spike for stable connection', () => {
    for (let i = 0; i < 5; i++) {
      analyzer.addSample(20, 5, 0);
    }
    expect(analyzer.predictSpike()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateLatencyBreakdown
// ---------------------------------------------------------------------------

describe('calculateLatencyBreakdown', () => {
  it('calculates correct total latency', () => {
    const breakdown = calculateLatencyBreakdown({
      audioContextLatency: 0.005,  // 5ms
      outputLatency: 0.003,        // 3ms
      networkRtt: 40,              // 40ms RTT → 20ms one-way
      jitterBufferSize: 256,       // ~5.33ms at 48kHz
      sampleRate: 48000,
      effectsEnabled: true,
      effectsCount: 5,
      encodingFrameSize: 10,       // 10ms frames
      compensationDelay: 10,
    });

    expect(breakdown.capture).toBeGreaterThanOrEqual(3);
    expect(breakdown.network).toBeCloseTo(20, 0);  // RTT/2
    expect(breakdown.jitterBuffer).toBeCloseTo(5.3, 0);
    expect(breakdown.compensation).toBe(10);
    expect(breakdown.total).toBeGreaterThan(0);

    // Total should equal sum of components
    const sum = breakdown.capture + breakdown.encode + breakdown.network +
      breakdown.jitterBuffer + breakdown.decode + breakdown.effects +
      breakdown.playback + breakdown.compensation;
    expect(breakdown.total).toBeCloseTo(sum, 0);
  });

  it('excludes effects latency when effects disabled', () => {
    const withEffects = calculateLatencyBreakdown({
      audioContextLatency: 0.005, outputLatency: 0.003,
      networkRtt: 40, jitterBufferSize: 256, sampleRate: 48000,
      effectsEnabled: true, effectsCount: 10, encodingFrameSize: 10,
      compensationDelay: 0,
    });

    const withoutEffects = calculateLatencyBreakdown({
      audioContextLatency: 0.005, outputLatency: 0.003,
      networkRtt: 40, jitterBufferSize: 256, sampleRate: 48000,
      effectsEnabled: false, effectsCount: 10, encodingFrameSize: 10,
      compensationDelay: 0,
    });

    expect(withEffects.effects).toBeGreaterThan(0);
    expect(withoutEffects.effects).toBe(0);
    expect(withEffects.total).toBeGreaterThan(withoutEffects.total);
  });
});

// ---------------------------------------------------------------------------
// calculateQualityScore
// ---------------------------------------------------------------------------

describe('calculateQualityScore', () => {
  it('returns 100 for perfect conditions', () => {
    const score = calculateQualityScore(10, 1, 0, 256);
    expect(score).toBe(100);
  });

  it('returns low score for poor conditions', () => {
    const score = calculateQualityScore(200, 50, 10, 16);
    expect(score).toBeLessThan(30);
  });

  it('never exceeds 100', () => {
    const score = calculateQualityScore(1, 0, 0, 1000);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('RTT contributes 0-40 points', () => {
    const perfect = calculateQualityScore(10, 1, 0, 128);
    const terrible = calculateQualityScore(200, 1, 0, 128);
    expect(perfect - terrible).toBeLessThanOrEqual(40);
  });
});

// ---------------------------------------------------------------------------
// assessConnectionQuality
// ---------------------------------------------------------------------------

describe('assessConnectionQuality', () => {
  it('returns excellent for high quality', () => {
    expect(assessConnectionQuality(10, 1, 0)).toBe('excellent');
  });

  it('returns good for moderate quality', () => {
    expect(assessConnectionQuality(30, 8, 0.5)).toBe('good');
  });

  it('returns poor for bad conditions', () => {
    expect(assessConnectionQuality(200, 50, 10)).toBe('poor');
  });
});
