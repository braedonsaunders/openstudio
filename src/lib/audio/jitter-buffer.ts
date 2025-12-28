// Adaptive Jitter Buffer implementation
// Automatically adjusts buffer size based on network conditions

import type { JitterStats } from '@/types';

export interface JitterBufferConfig {
  minBufferSize: number;  // Minimum buffer in samples (128 for lowest latency)
  maxBufferSize: number;  // Maximum buffer in samples (1024 for stability)
  targetJitter: number;   // Target jitter in ms
  adaptationRate: number; // How fast to adapt (0-1)
  sampleRate: number;
}

const defaultConfig: JitterBufferConfig = {
  minBufferSize: 128,
  maxBufferSize: 1024,
  targetJitter: 5,
  adaptationRate: 0.1,
  sampleRate: 48000,
};

/**
 * Ultra-low latency configuration for live jamming mode.
 * Trades stability for minimum latency - use only with stable connections.
 * Potential savings: ~5-10ms compared to default settings.
 */
export const LIVE_JAMMING_CONFIG: JitterBufferConfig = {
  minBufferSize: 64,    // More aggressive minimum (default: 128)
  maxBufferSize: 256,   // Lower ceiling - prioritize latency (default: 1024)
  targetJitter: 2,      // Target only 2ms jitter tolerance (default: 5ms)
  adaptationRate: 0.2,  // Faster adaptation (default: 0.1)
  sampleRate: 48000,
};

/**
 * Balanced configuration for good quality with reasonable latency.
 * Good for most connections.
 */
export const BALANCED_CONFIG: JitterBufferConfig = {
  minBufferSize: 128,
  maxBufferSize: 512,
  targetJitter: 5,
  adaptationRate: 0.1,
  sampleRate: 48000,
};

/**
 * High stability configuration for poor network conditions.
 * Prioritizes audio quality over latency.
 */
export const HIGH_STABILITY_CONFIG: JitterBufferConfig = {
  minBufferSize: 256,
  maxBufferSize: 1024,
  targetJitter: 10,
  adaptationRate: 0.05,
  sampleRate: 48000,
};

export class AdaptiveJitterBuffer {
  private config: JitterBufferConfig;
  private currentBufferSize: number;
  private jitterHistory: number[] = [];
  private packetLossHistory: number[] = [];
  private rttHistory: number[] = [];
  private historySize = 100;
  private lastUpdateTime = 0;
  private updateInterval = 1000; // Update every second

  constructor(config: Partial<JitterBufferConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.currentBufferSize = 256; // Start with moderate buffer
  }

  // Process new network stats and potentially adjust buffer
  update(stats: JitterStats): number {
    const now = Date.now();

    // Add to history
    this.jitterHistory.push(stats.averageJitter);
    this.packetLossHistory.push(stats.packetLoss);
    this.rttHistory.push(stats.roundTripTime);

    // Trim history
    if (this.jitterHistory.length > this.historySize) {
      this.jitterHistory.shift();
      this.packetLossHistory.shift();
      this.rttHistory.shift();
    }

    // Only update buffer size periodically
    if (now - this.lastUpdateTime < this.updateInterval) {
      return this.currentBufferSize;
    }

    this.lastUpdateTime = now;

    // Calculate metrics
    const avgJitter = this.calculatePercentile(this.jitterHistory, 95);
    const avgPacketLoss = this.calculateAverage(this.packetLossHistory);
    const avgRtt = this.calculateAverage(this.rttHistory);

    // Determine recommended buffer size
    const recommendedBuffer = this.calculateRecommendedBuffer(avgJitter, avgPacketLoss, avgRtt);

    // Smoothly adapt towards recommended buffer
    const diff = recommendedBuffer - this.currentBufferSize;
    this.currentBufferSize += diff * this.config.adaptationRate;

    // Clamp to valid sizes (must be power of 2)
    this.currentBufferSize = this.clampToValidBuffer(this.currentBufferSize);

    return this.currentBufferSize;
  }

  private calculateRecommendedBuffer(jitter: number, packetLoss: number, rtt: number): number {
    // Convert jitter (ms) to samples
    const jitterSamples = (jitter / 1000) * this.config.sampleRate;

    // Base buffer on jitter (need 2x jitter to handle variations)
    let baseBuffer = jitterSamples * 2;

    // Increase buffer if packet loss is high
    if (packetLoss > 0.01) {
      baseBuffer *= 1.5;
    }
    if (packetLoss > 0.05) {
      baseBuffer *= 2;
    }

    // Consider RTT for very high latency connections
    if (rtt > 50) {
      baseBuffer *= 1.2;
    }

    return Math.max(this.config.minBufferSize, Math.min(this.config.maxBufferSize, baseBuffer));
  }

  private clampToValidBuffer(size: number): number {
    // Valid buffer sizes are powers of 2 (including 64 for live jamming mode)
    const validSizes = [64, 128, 256, 512, 1024];

    // Filter to sizes within our min/max config range
    const allowedSizes = validSizes.filter(
      s => s >= this.config.minBufferSize && s <= this.config.maxBufferSize
    );

    if (allowedSizes.length === 0) {
      // Fallback to config min if no valid sizes in range
      return this.config.minBufferSize;
    }

    let closest = allowedSizes[0];
    let minDiff = Math.abs(size - allowedSizes[0]);

    for (const validSize of allowedSizes) {
      const diff = Math.abs(size - validSize);
      if (diff < minDiff) {
        minDiff = diff;
        closest = validSize;
      }
    }

    return closest;
  }

  private calculateAverage(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, val) => sum + val, 0) / arr.length;
  }

  private calculatePercentile(arr: number[], percentile: number): number {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  getStats(): JitterStats {
    return {
      averageJitter: this.calculateAverage(this.jitterHistory),
      maxJitter: Math.max(...this.jitterHistory, 0),
      packetLoss: this.calculateAverage(this.packetLossHistory),
      roundTripTime: this.calculateAverage(this.rttHistory),
      recommendedBuffer: this.currentBufferSize,
    };
  }

  getCurrentBufferSize(): number {
    return this.currentBufferSize;
  }

  getBufferLatencyMs(): number {
    return (this.currentBufferSize / this.config.sampleRate) * 1000;
  }

  getConnectionQuality(): 'excellent' | 'good' | 'fair' | 'poor' {
    const stats = this.getStats();

    if (stats.averageJitter < 5 && stats.packetLoss < 0.01 && stats.roundTripTime < 20) {
      return 'excellent';
    }
    if (stats.averageJitter < 15 && stats.packetLoss < 0.03 && stats.roundTripTime < 50) {
      return 'good';
    }
    if (stats.averageJitter < 30 && stats.packetLoss < 0.05 && stats.roundTripTime < 100) {
      return 'fair';
    }
    return 'poor';
  }

  reset(): void {
    this.jitterHistory = [];
    this.packetLossHistory = [];
    this.rttHistory = [];
    this.currentBufferSize = 256;
    this.lastUpdateTime = 0;
  }

  /**
   * Set the jitter buffer mode for different use cases.
   * @param mode 'live-jamming' for ultra-low latency, 'balanced' for normal use, 'stable' for poor connections
   */
  setMode(mode: 'live-jamming' | 'balanced' | 'stable'): void {
    switch (mode) {
      case 'live-jamming':
        this.config = { ...LIVE_JAMMING_CONFIG };
        this.currentBufferSize = 64; // Start at minimum for lowest latency
        break;
      case 'balanced':
        this.config = { ...BALANCED_CONFIG };
        this.currentBufferSize = 256;
        break;
      case 'stable':
        this.config = { ...HIGH_STABILITY_CONFIG };
        this.currentBufferSize = 512;
        break;
    }
    // Clear history when switching modes
    this.reset();
    console.log(`[JitterBuffer] Mode set to '${mode}', buffer: ${this.currentBufferSize} samples (${this.getBufferLatencyMs().toFixed(1)}ms)`);
  }

  /**
   * Get the current mode name based on configuration
   */
  getMode(): 'live-jamming' | 'balanced' | 'stable' | 'custom' {
    if (this.config.minBufferSize === 64 && this.config.maxBufferSize === 256) {
      return 'live-jamming';
    }
    if (this.config.minBufferSize === 128 && this.config.maxBufferSize === 512) {
      return 'balanced';
    }
    if (this.config.minBufferSize === 256 && this.config.maxBufferSize === 1024) {
      return 'stable';
    }
    return 'custom';
  }

  /**
   * Update configuration directly
   */
  updateConfig(config: Partial<JitterBufferConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
