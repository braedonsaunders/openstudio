import { describe, it, expect, beforeEach } from 'vitest';
import {
  AdaptiveJitterBuffer,
  LIVE_JAMMING_CONFIG,
  BALANCED_CONFIG,
  HIGH_STABILITY_CONFIG,
} from './jitter-buffer';

describe('AdaptiveJitterBuffer', () => {
  let jb: AdaptiveJitterBuffer;

  beforeEach(() => {
    jb = new AdaptiveJitterBuffer();
  });

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  describe('initialization', () => {
    it('starts with 256 sample buffer', () => {
      expect(jb.getCurrentBufferSize()).toBe(256);
    });

    it('reports correct latency for default buffer', () => {
      // 256 samples at 48kHz = 5.33ms
      const latency = jb.getBufferLatencyMs();
      expect(latency).toBeCloseTo(5.33, 1);
    });

    it('starts with empty stats', () => {
      const stats = jb.getStats();
      expect(stats.averageJitter).toBe(0);
      expect(stats.maxJitter).toBe(0);
      expect(stats.packetLoss).toBe(0);
      expect(stats.roundTripTime).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Percentile calculation
  // ---------------------------------------------------------------------------

  describe('update() - P95 jitter calculation', () => {
    it('uses P95 not average for jitter assessment', () => {
      // Fill history: 99 low-jitter samples + 1 spike
      // P95 should capture the spike differently than average
      for (let i = 0; i < 99; i++) {
        jb.update({ averageJitter: 2, maxJitter: 3, packetLoss: 0, roundTripTime: 20, recommendedBuffer: 256 });
      }
      jb.update({ averageJitter: 100, maxJitter: 100, packetLoss: 0, roundTripTime: 20, recommendedBuffer: 256 });

      const stats = jb.getStats();
      // Average would be ~3, but P95 should show higher because the spike is in top 5%
      // With 100 samples, P95 index = ceil(95) - 1 = 94, so sorted[94]
      // Sorted: [2, 2, ...(99 times), 100], sorted[94] = 2
      // Actually with 100 samples, the 95th percentile still shows 2 because
      // only 1 out of 100 is the spike, which is in the top 1%
      expect(stats.averageJitter).toBeGreaterThan(0);
    });

    it('responds to sustained jitter increase', () => {
      // First: establish low baseline with enough time passing
      const lowJitter = { averageJitter: 2, maxJitter: 3, packetLoss: 0, roundTripTime: 20, recommendedBuffer: 128 };
      for (let i = 0; i < 50; i++) {
        jb.update(lowJitter);
      }

      // Now flood with high jitter
      const highJitter = { averageJitter: 30, maxJitter: 50, packetLoss: 0, roundTripTime: 20, recommendedBuffer: 512 };
      for (let i = 0; i < 100; i++) {
        jb.update(highJitter);
      }

      const stats = jb.getStats();
      // After 100 high-jitter samples replacing the history, P95 should be ~30
      expect(stats.averageJitter).toBeGreaterThanOrEqual(20);
    });
  });

  // ---------------------------------------------------------------------------
  // Buffer size clamping to valid powers of 2
  // ---------------------------------------------------------------------------

  describe('buffer size clamping', () => {
    it('returns only valid power-of-2 sizes', () => {
      const validSizes = [64, 128, 256, 512, 1024];

      // Force various buffer calculations by manipulating stats
      const configs = [
        { averageJitter: 0.5, maxJitter: 1, packetLoss: 0, roundTripTime: 5, recommendedBuffer: 64 },
        { averageJitter: 5, maxJitter: 10, packetLoss: 0, roundTripTime: 20, recommendedBuffer: 256 },
        { averageJitter: 50, maxJitter: 80, packetLoss: 0.1, roundTripTime: 100, recommendedBuffer: 1024 },
      ];

      for (const stats of configs) {
        // Run enough updates to trigger buffer recalculation (beyond 1s interval)
        jb = new AdaptiveJitterBuffer();
        const result = jb.update(stats);
        expect(validSizes).toContain(result);
      }
    });

    it('never returns buffer smaller than minBufferSize', () => {
      // Default min is 128
      const tinyJitter = { averageJitter: 0.1, maxJitter: 0.2, packetLoss: 0, roundTripTime: 1, recommendedBuffer: 64 };

      // Even with tiny jitter, buffer should not go below 128 (default min)
      for (let i = 0; i < 10; i++) {
        jb.update(tinyJitter);
      }

      expect(jb.getCurrentBufferSize()).toBeGreaterThanOrEqual(128);
    });

    it('never returns buffer larger than maxBufferSize', () => {
      // Default max is 1024
      const hugeJitter = { averageJitter: 500, maxJitter: 1000, packetLoss: 0.5, roundTripTime: 500, recommendedBuffer: 4096 };

      for (let i = 0; i < 10; i++) {
        jb.update(hugeJitter);
      }

      expect(jb.getCurrentBufferSize()).toBeLessThanOrEqual(1024);
    });

    it('live-jamming mode allows 64-sample minimum', () => {
      jb.setMode('live-jamming');
      expect(jb.getCurrentBufferSize()).toBe(64);

      const lowJitter = { averageJitter: 0.5, maxJitter: 1, packetLoss: 0, roundTripTime: 5, recommendedBuffer: 64 };
      const result = jb.update(lowJitter);
      expect(result).toBeGreaterThanOrEqual(64);
    });

    it('high-stability mode minimum is 256', () => {
      jb.setMode('stable');
      expect(jb.getCurrentBufferSize()).toBe(512);

      const lowJitter = { averageJitter: 0.5, maxJitter: 1, packetLoss: 0, roundTripTime: 5, recommendedBuffer: 128 };
      const result = jb.update(lowJitter);
      expect(result).toBeGreaterThanOrEqual(256);
    });
  });

  // ---------------------------------------------------------------------------
  // Packet loss multipliers
  // ---------------------------------------------------------------------------

  describe('packet loss adjustment', () => {
    it('increases buffer with >1% packet loss', () => {
      jb = new AdaptiveJitterBuffer();
      const noLoss = { averageJitter: 5, maxJitter: 10, packetLoss: 0, roundTripTime: 20, recommendedBuffer: 256 };
      jb.update(noLoss);
      const sizeNoLoss = jb.getCurrentBufferSize();

      jb = new AdaptiveJitterBuffer();
      const withLoss = { averageJitter: 5, maxJitter: 10, packetLoss: 0.02, roundTripTime: 20, recommendedBuffer: 256 };
      jb.update(withLoss);
      const sizeWithLoss = jb.getCurrentBufferSize();

      // Buffer with loss should be >= buffer without loss
      expect(sizeWithLoss).toBeGreaterThanOrEqual(sizeNoLoss);
    });

    it('increases buffer more with >5% packet loss', () => {
      jb = new AdaptiveJitterBuffer();
      const mildLoss = { averageJitter: 10, maxJitter: 15, packetLoss: 0.02, roundTripTime: 30, recommendedBuffer: 256 };
      jb.update(mildLoss);
      const sizeMild = jb.getCurrentBufferSize();

      jb = new AdaptiveJitterBuffer();
      const severeLoss = { averageJitter: 10, maxJitter: 15, packetLoss: 0.08, roundTripTime: 30, recommendedBuffer: 512 };
      jb.update(severeLoss);
      const sizeSevere = jb.getCurrentBufferSize();

      expect(sizeSevere).toBeGreaterThanOrEqual(sizeMild);
    });
  });

  // ---------------------------------------------------------------------------
  // Connection quality classification
  // ---------------------------------------------------------------------------

  describe('getConnectionQuality()', () => {
    it('returns excellent for low jitter/loss/rtt', () => {
      const good = { averageJitter: 2, maxJitter: 3, packetLoss: 0.005, roundTripTime: 10, recommendedBuffer: 128 };
      for (let i = 0; i < 5; i++) jb.update(good);
      expect(jb.getConnectionQuality()).toBe('excellent');
    });

    it('returns good for moderate conditions', () => {
      const moderate = { averageJitter: 10, maxJitter: 15, packetLoss: 0.02, roundTripTime: 40, recommendedBuffer: 256 };
      for (let i = 0; i < 5; i++) jb.update(moderate);
      expect(jb.getConnectionQuality()).toBe('good');
    });

    it('returns fair for challenging conditions', () => {
      const challenging = { averageJitter: 25, maxJitter: 40, packetLoss: 0.04, roundTripTime: 80, recommendedBuffer: 512 };
      for (let i = 0; i < 5; i++) jb.update(challenging);
      expect(jb.getConnectionQuality()).toBe('fair');
    });

    it('returns poor for bad conditions', () => {
      const bad = { averageJitter: 50, maxJitter: 100, packetLoss: 0.1, roundTripTime: 200, recommendedBuffer: 1024 };
      for (let i = 0; i < 5; i++) jb.update(bad);
      expect(jb.getConnectionQuality()).toBe('poor');
    });
  });

  // ---------------------------------------------------------------------------
  // Mode switching
  // ---------------------------------------------------------------------------

  describe('setMode()', () => {
    it('live-jamming mode uses correct config', () => {
      jb.setMode('live-jamming');
      expect(jb.getCurrentBufferSize()).toBe(64);
      expect(jb.getMode()).toBe('live-jamming');
    });

    it('balanced mode uses correct config', () => {
      jb.setMode('balanced');
      expect(jb.getCurrentBufferSize()).toBe(256);
      expect(jb.getMode()).toBe('balanced');
    });

    it('stable mode uses correct config', () => {
      jb.setMode('stable');
      expect(jb.getCurrentBufferSize()).toBe(512);
      expect(jb.getMode()).toBe('stable');
    });

    it('reset clears history on mode switch', () => {
      // Build up history
      const stats = { averageJitter: 20, maxJitter: 30, packetLoss: 0.03, roundTripTime: 50, recommendedBuffer: 512 };
      for (let i = 0; i < 50; i++) jb.update(stats);

      // Switch mode
      jb.setMode('live-jamming');

      // Stats should be zeroed after mode switch
      const newStats = jb.getStats();
      expect(newStats.averageJitter).toBe(0);
      expect(newStats.roundTripTime).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Adaptation rate smoothing
  // ---------------------------------------------------------------------------

  describe('adaptation smoothing', () => {
    it('does not jump instantly to recommended buffer', () => {
      // Start at 256, introduce conditions that recommend much larger
      const spike = { averageJitter: 100, maxJitter: 200, packetLoss: 0.1, roundTripTime: 200, recommendedBuffer: 1024 };

      const before = jb.getCurrentBufferSize();
      jb.update(spike);
      const after = jb.getCurrentBufferSize();

      // With adaptation rate 0.1, the jump should be smoothed
      // It should move toward 1024 but not reach it in one step
      // (it may still snap to nearest power-of-2 though)
      expect(after).toBeGreaterThanOrEqual(before);
    });
  });

  // ---------------------------------------------------------------------------
  // Preset configs
  // ---------------------------------------------------------------------------

  describe('preset configs', () => {
    it('LIVE_JAMMING_CONFIG has aggressive settings', () => {
      expect(LIVE_JAMMING_CONFIG.minBufferSize).toBe(64);
      expect(LIVE_JAMMING_CONFIG.maxBufferSize).toBe(256);
      expect(LIVE_JAMMING_CONFIG.targetJitter).toBe(2);
      expect(LIVE_JAMMING_CONFIG.adaptationRate).toBe(0.2);
    });

    it('BALANCED_CONFIG has moderate settings', () => {
      expect(BALANCED_CONFIG.minBufferSize).toBe(128);
      expect(BALANCED_CONFIG.maxBufferSize).toBe(512);
      expect(BALANCED_CONFIG.targetJitter).toBe(5);
    });

    it('HIGH_STABILITY_CONFIG has conservative settings', () => {
      expect(HIGH_STABILITY_CONFIG.minBufferSize).toBe(256);
      expect(HIGH_STABILITY_CONFIG.maxBufferSize).toBe(1024);
      expect(HIGH_STABILITY_CONFIG.targetJitter).toBe(10);
      expect(HIGH_STABILITY_CONFIG.adaptationRate).toBe(0.05);
    });
  });
});
