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
    // Valid buffer sizes are powers of 2
    const validSizes = [128, 256, 512, 1024];
    let closest = validSizes[0];
    let minDiff = Math.abs(size - validSizes[0]);

    for (const validSize of validSizes) {
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
}
