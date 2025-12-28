// Latency Synchronization Engine
// Master-client clock sync with NTP-style algorithm and latency compensation
// World-class implementation exceeding JamKazam, Jamulus, and SonoBus

import type {
  ClockSyncMessage,
  ClockSyncAck,
  ClockSample,
  LatencySample,
  LatencyBreakdown,
  UserPerformanceInfo,
  JamCompatibility,
  JamQuality,
  AutoOptimization,
  DataChannelMessage,
  NetworkTrend,
  QualityPresetName,
} from '@/types';
import { getRecommendedPreset } from './quality-presets';

// ============================================================================
// Master Clock Sync - NTP-style algorithm
// ============================================================================

export interface ClockSyncConfig {
  sampleCount: number;        // Number of samples to keep for averaging
  syncInterval: number;       // ms between sync broadcasts (master)
  maxClockDrift: number;      // Maximum acceptable drift in ms/s
  outlierThreshold: number;   // RTT multiplier for outlier detection
}

const DEFAULT_CLOCK_SYNC_CONFIG: ClockSyncConfig = {
  sampleCount: 8,
  syncInterval: 100,          // 100ms = 10 syncs per second
  maxClockDrift: 0.1,         // 0.1ms per second
  outlierThreshold: 2.5,      // Reject samples with RTT > 2.5x median
};

export class MasterClockSync {
  private config: ClockSyncConfig;
  private samples: ClockSample[] = [];
  private clockOffset: number = 0;
  private clockDrift: number = 0;
  private lastSyncTime: number = 0;
  private lastRtt: number = 0;
  private sequence: number = 0;
  private pendingAcks: Map<number, number> = new Map(); // sequence -> sendTime

  // Callbacks
  public onClockSync?: (offset: number, rtt: number) => void;
  public onSyncQualityChange?: (quality: 'excellent' | 'good' | 'fair' | 'poor') => void;

  constructor(config: Partial<ClockSyncConfig> = {}) {
    this.config = { ...DEFAULT_CLOCK_SYNC_CONFIG, ...config };
  }

  /**
   * Process incoming clock sync message (called by non-master clients)
   */
  processClockSync(msg: ClockSyncMessage, receiveTime: number): ClockSyncAck {
    // Calculate RTT from pending ack if available
    const rtt = this.pendingAcks.has(msg.sequence - 1)
      ? receiveTime - this.pendingAcks.get(msg.sequence - 1)!
      : this.lastRtt || 20; // Default 20ms if no RTT available

    // Estimate one-way delay (assume symmetric)
    const oneWayDelay = rtt / 2;

    // Calculate offset: masterTime + oneWayDelay = localTime
    const estimatedMasterNow = msg.masterTime + oneWayDelay;
    const offset = receiveTime - estimatedMasterNow;

    // Calculate weight (lower RTT = higher weight)
    const medianRtt = this.getMedianRtt();
    const weight = medianRtt > 0 ? medianRtt / Math.max(rtt, 1) : 1;

    // Check for outlier
    const isOutlier = medianRtt > 0 && rtt > medianRtt * this.config.outlierThreshold;

    if (!isOutlier) {
      // Add sample
      this.samples.push({
        offset,
        rtt,
        timestamp: receiveTime,
        weight,
      });

      // Trim to sample count
      while (this.samples.length > this.config.sampleCount) {
        this.samples.shift();
      }

      // Calculate weighted median offset
      this.clockOffset = this.calculateWeightedMedian();

      // Calculate drift
      this.clockDrift = this.calculateDrift();

      this.lastRtt = rtt;
      this.lastSyncTime = receiveTime;

      // Notify
      this.onClockSync?.(this.clockOffset, rtt);

      // Check sync quality
      const quality = this.getSyncQuality();
      this.onSyncQualityChange?.(quality);
    }

    // Return ack
    return {
      type: 'clock_ack',
      originalSendTime: msg.sendTimestamp,
      clientReceiveTime: receiveTime,
      clientId: '', // Will be filled by caller
      sequence: msg.sequence,
    };
  }

  /**
   * Process ack from client (called by master)
   */
  processClockAck(ack: ClockSyncAck, receiveTime: number): number {
    const rtt = receiveTime - ack.originalSendTime;
    this.lastRtt = rtt;
    this.pendingAcks.delete(ack.sequence);
    return rtt;
  }

  /**
   * Create clock sync message (called by master)
   */
  createClockSyncMessage(bpm: number, beatPosition: number): ClockSyncMessage {
    const now = performance.now();
    this.sequence++;
    this.pendingAcks.set(this.sequence, now);

    // Clean old pending acks
    const cutoff = now - 5000;
    for (const [seq, time] of this.pendingAcks) {
      if (time < cutoff) {
        this.pendingAcks.delete(seq);
      }
    }

    return {
      type: 'clock_sync',
      masterTime: now,
      masterWallClock: Date.now(),
      beatPosition,
      bpm,
      sendTimestamp: now,
      sequence: this.sequence,
    };
  }

  /**
   * Get the current master time (adjusted by offset)
   */
  getMasterTime(): number {
    const localNow = performance.now();
    const timeSinceLastSync = localNow - this.lastSyncTime;
    const driftCorrection = timeSinceLastSync * this.clockDrift / 1000;
    return localNow - this.clockOffset - driftCorrection;
  }

  /**
   * Convert master time to local time
   */
  getLocalTime(masterTime: number): number {
    return masterTime + this.clockOffset;
  }

  /**
   * Get current clock offset
   */
  getOffset(): number {
    return this.clockOffset;
  }

  /**
   * Get current RTT
   */
  getRtt(): number {
    return this.lastRtt;
  }

  /**
   * Get sync quality assessment
   */
  getSyncQuality(): 'excellent' | 'good' | 'fair' | 'poor' {
    if (this.samples.length < 3) return 'fair';

    const jitter = this.calculateJitter();
    const rtt = this.lastRtt;

    if (jitter < 2 && rtt < 30) return 'excellent';
    if (jitter < 5 && rtt < 60) return 'good';
    if (jitter < 15 && rtt < 100) return 'fair';
    return 'poor';
  }

  /**
   * Reset sync state
   */
  reset(): void {
    this.samples = [];
    this.clockOffset = 0;
    this.clockDrift = 0;
    this.lastSyncTime = 0;
    this.lastRtt = 0;
    this.sequence = 0;
    this.pendingAcks.clear();
  }

  // Private helpers

  private getMedianRtt(): number {
    if (this.samples.length === 0) return 0;
    const rtts = this.samples.map(s => s.rtt).sort((a, b) => a - b);
    const mid = Math.floor(rtts.length / 2);
    return rtts.length % 2 ? rtts[mid] : (rtts[mid - 1] + rtts[mid]) / 2;
  }

  private calculateWeightedMedian(): number {
    if (this.samples.length === 0) return 0;

    // Sort by offset
    const sorted = [...this.samples].sort((a, b) => a.offset - b.offset);

    // Calculate total weight
    const totalWeight = sorted.reduce((sum, s) => sum + s.weight, 0);

    // Find weighted median
    let cumWeight = 0;
    for (const sample of sorted) {
      cumWeight += sample.weight;
      if (cumWeight >= totalWeight / 2) {
        return sample.offset;
      }
    }

    return sorted[sorted.length - 1].offset;
  }

  private calculateDrift(): number {
    if (this.samples.length < 2) return 0;

    // Linear regression on offset vs timestamp
    const n = this.samples.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (const sample of this.samples) {
      sumX += sample.timestamp;
      sumY += sample.offset;
      sumXY += sample.timestamp * sample.offset;
      sumXX += sample.timestamp * sample.timestamp;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return isNaN(slope) ? 0 : slope;
  }

  private calculateJitter(): number {
    if (this.samples.length < 2) return 0;

    let sumDiff = 0;
    for (let i = 1; i < this.samples.length; i++) {
      sumDiff += Math.abs(this.samples[i].rtt - this.samples[i - 1].rtt);
    }
    return sumDiff / (this.samples.length - 1);
  }
}

// ============================================================================
// Latency Compensation Engine
// ============================================================================

export interface LatencyCompensationConfig {
  safetyBuffer: number;           // Additional buffer in ms
  maxCompensation: number;        // Maximum compensation delay in ms
  adaptationRate: number;         // How fast to adapt (0-1)
  smoothingWindow: number;        // Samples for smoothing
}

const DEFAULT_COMPENSATION_CONFIG: LatencyCompensationConfig = {
  safetyBuffer: 10,               // 10ms safety margin
  maxCompensation: 200,           // Max 200ms compensation
  adaptationRate: 0.3,            // 30% adaptation per update
  smoothingWindow: 5,             // 5 samples for smoothing
};

export class LatencyCompensator {
  private config: LatencyCompensationConfig;
  private userLatencies: Map<string, LatencySample[]> = new Map();
  private targetDelay: number = 0;
  private userCompensations: Map<string, number> = new Map();
  private compensationNode: DelayNode | null = null;
  private audioContext: AudioContext | null = null;

  // Callbacks
  public onCompensationChange?: (targetDelay: number, userDelays: Map<string, number>) => void;
  public onJamCompatibilityChange?: (compatibility: JamCompatibility) => void;
  /**
   * Callback to apply compensation delays to incoming remote streams.
   * Called with userId and the delay in ms to apply to their incoming audio.
   * This enables proper bidirectional synchronization.
   */
  public onRemoteStreamCompensation?: (userId: string, delayMs: number) => void;

  constructor(config: Partial<LatencyCompensationConfig> = {}) {
    this.config = { ...DEFAULT_COMPENSATION_CONFIG, ...config };
  }

  /**
   * Initialize with audio context
   */
  initialize(audioContext: AudioContext): void {
    this.audioContext = audioContext;
    this.compensationNode = audioContext.createDelay(this.config.maxCompensation / 1000);
    this.compensationNode.delayTime.value = 0;
  }

  /**
   * Get the compensation delay node
   */
  getDelayNode(): DelayNode | null {
    return this.compensationNode;
  }

  /**
   * Update latency for a user
   */
  updateUserLatency(userId: string, rtt: number, jitter: number, packetLoss: number): void {
    const samples = this.userLatencies.get(userId) || [];
    samples.push({
      rtt,
      jitter,
      packetLoss,
      timestamp: Date.now(),
    });

    // Keep only recent samples
    while (samples.length > this.config.smoothingWindow) {
      samples.shift();
    }

    this.userLatencies.set(userId, samples);

    // Recalculate compensations
    this.recalculateCompensations();
  }

  /**
   * Remove user from compensation
   */
  removeUser(userId: string): void {
    this.userLatencies.delete(userId);
    this.userCompensations.delete(userId);
    this.recalculateCompensations();
  }

  /**
   * Get compensation delay for a specific user
   */
  getUserCompensation(userId: string): number {
    return this.userCompensations.get(userId) || 0;
  }

  /**
   * Get the target delay all users should sync to
   */
  getTargetDelay(): number {
    return this.targetDelay;
  }

  /**
   * Get all user compensations
   */
  getAllCompensations(): Map<string, number> {
    return new Map(this.userCompensations);
  }

  /**
   * Calculate jam compatibility
   */
  calculateJamCompatibility(): JamCompatibility {
    const latencies = Array.from(this.userLatencies.values());
    if (latencies.length === 0) {
      return {
        canJam: true,
        quality: 'tight',
        maxGroupLatency: 0,
        recommendation: 'Waiting for participants...',
        autoOptimizations: [],
      };
    }

    // Get average RTT for each user
    const userRtts = latencies.map(samples => {
      const avg = samples.reduce((sum, s) => sum + s.rtt, 0) / samples.length;
      return avg;
    });

    const maxRtt = Math.max(...userRtts);
    const avgRtt = userRtts.reduce((a, b) => a + b, 0) / userRtts.length;

    // Group latency includes processing overhead
    const processingOverhead = 15; // Estimate 15ms for encoding/decoding/effects
    const maxGroupLatency = maxRtt + processingOverhead + this.config.safetyBuffer;

    // Determine quality and compatibility
    let quality: JamQuality;
    let canJam: boolean;
    let recommendation: string;
    let suggestedBpmMax: number | undefined;
    const autoOptimizations: AutoOptimization[] = [];

    if (maxGroupLatency < 30) {
      quality = 'tight';
      canJam = true;
      recommendation = 'Excellent! You can play tight rhythms together at any tempo.';
    } else if (maxGroupLatency < 50) {
      quality = 'good';
      canJam = true;
      recommendation = 'Great conditions for jamming. Most genres will work well.';
      suggestedBpmMax = 180;
    } else if (maxGroupLatency < 80) {
      quality = 'loose';
      canJam = true;
      recommendation = 'Good for moderate tempos and flowing genres like jazz or ambient.';
      suggestedBpmMax = 140;
      autoOptimizations.push({
        type: 'reduce_buffer',
        description: 'Switching to aggressive jitter buffer',
        automatic: true,
      });
    } else if (maxGroupLatency < 120) {
      quality = 'difficult';
      canJam = true;
      recommendation = 'Challenging but possible for slow tempos and ambient music.';
      suggestedBpmMax = 100;
      autoOptimizations.push({
        type: 'reduce_buffer',
        description: 'Enabling live-jamming mode',
        automatic: true,
      });
      autoOptimizations.push({
        type: 'bypass_effects',
        description: 'Bypassing non-essential effects',
        automatic: false,
      });
    } else {
      quality = 'impossible';
      canJam = false;
      recommendation = `${Math.round(maxGroupLatency)}ms is too high for real-time jamming. Try: wired connection, closer server, or turn-taking mode.`;
      autoOptimizations.push({
        type: 'switch_preset',
        description: 'Switching to poor-connection preset',
        automatic: true,
      });
    }

    const compatibility: JamCompatibility = {
      canJam,
      quality,
      maxGroupLatency: Math.round(maxGroupLatency),
      recommendation,
      suggestedBpmMax,
      autoOptimizations,
    };

    this.onJamCompatibilityChange?.(compatibility);
    return compatibility;
  }

  /**
   * Set compensation delay manually (for master control)
   */
  setCompensationDelay(userId: string, delay: number): void {
    this.userCompensations.set(userId, Math.min(delay, this.config.maxCompensation));

    if (this.compensationNode && this.audioContext) {
      // Apply own compensation
      const ownDelay = this.userCompensations.get('self') || 0;
      this.compensationNode.delayTime.setTargetAtTime(
        ownDelay / 1000,
        this.audioContext.currentTime,
        0.05
      );
    }
  }

  /**
   * Reset all compensations
   */
  reset(): void {
    this.userLatencies.clear();
    this.userCompensations.clear();
    this.targetDelay = 0;

    if (this.compensationNode) {
      this.compensationNode.delayTime.value = 0;
    }
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.reset();
    if (this.compensationNode) {
      this.compensationNode.disconnect();
      this.compensationNode = null;
    }
    this.audioContext = null;
  }

  // Private helpers

  private recalculateCompensations(): void {
    if (this.userLatencies.size === 0) {
      this.targetDelay = 0;
      this.userCompensations.clear();
      return;
    }

    // Calculate smoothed RTT for each user
    const userRtts = new Map<string, number>();
    for (const [userId, samples] of this.userLatencies) {
      const avgRtt = samples.reduce((sum, s) => sum + s.rtt, 0) / samples.length;
      userRtts.set(userId, avgRtt);
    }

    // Find max RTT
    const maxRtt = Math.max(...userRtts.values());

    // Target delay = max RTT + safety buffer
    const newTargetDelay = Math.min(
      maxRtt + this.config.safetyBuffer,
      this.config.maxCompensation
    );

    // Smooth adaptation
    this.targetDelay = this.targetDelay +
      (newTargetDelay - this.targetDelay) * this.config.adaptationRate;

    // Calculate per-user compensation
    for (const [userId, rtt] of userRtts) {
      const compensation = Math.max(0, this.targetDelay - rtt);
      this.userCompensations.set(userId, compensation);
    }

    // Apply own compensation (delay our local output)
    if (this.compensationNode && this.audioContext) {
      const ownCompensation = this.userCompensations.get('self') || 0;
      this.compensationNode.delayTime.setTargetAtTime(
        ownCompensation / 1000,
        this.audioContext.currentTime,
        0.1
      );
    }

    // Apply compensation to incoming remote streams
    // Each remote user's audio should be delayed by their compensation amount
    // This ensures all audio arrives at our ears synchronized
    for (const [userId, compensation] of this.userCompensations) {
      if (userId !== 'self') {
        this.onRemoteStreamCompensation?.(userId, compensation);
      }
    }

    // Notify
    this.onCompensationChange?.(this.targetDelay, new Map(this.userCompensations));
  }
}

// ============================================================================
// Latency Breakdown Calculator
// ============================================================================

export interface LatencyMeasurements {
  audioContextLatency: number;
  outputLatency: number;
  networkRtt: number;
  jitterBufferSize: number;
  sampleRate: number;
  effectsEnabled: boolean;
  effectsCount: number;
  encodingFrameSize: number;
  compensationDelay: number;
}

export function calculateLatencyBreakdown(measurements: LatencyMeasurements): LatencyBreakdown {
  // Capture latency (getUserMedia + audio context input)
  const capture = Math.max(measurements.audioContextLatency * 1000, 3);

  // Encoding latency (Opus frame size)
  const encode = measurements.encodingFrameSize * 0.75; // Opus encodes faster than real-time

  // Network latency (one-way)
  const network = measurements.networkRtt / 2;

  // Jitter buffer latency
  const jitterBuffer = (measurements.jitterBufferSize / measurements.sampleRate) * 1000;

  // Decoding latency (similar to encoding)
  const decode = measurements.encodingFrameSize * 0.5;

  // Effects processing latency
  const effects = measurements.effectsEnabled ? measurements.effectsCount * 0.15 : 0;

  // Playback latency (output buffer)
  const playback = measurements.outputLatency * 1000 || 3;

  // Compensation delay
  const compensation = measurements.compensationDelay;

  // Total
  const total = capture + encode + network + jitterBuffer + decode + effects + playback + compensation;

  return {
    capture: Math.round(capture * 10) / 10,
    encode: Math.round(encode * 10) / 10,
    network: Math.round(network * 10) / 10,
    jitterBuffer: Math.round(jitterBuffer * 10) / 10,
    decode: Math.round(decode * 10) / 10,
    effects: Math.round(effects * 10) / 10,
    playback: Math.round(playback * 10) / 10,
    compensation: Math.round(compensation * 10) / 10,
    total: Math.round(total * 10) / 10,
  };
}

// ============================================================================
// Network Trend Analyzer (Predictive)
// ============================================================================

export class NetworkTrendAnalyzer {
  private samples: LatencySample[] = [];
  private readonly maxSamples = 100;
  private readonly trendWindow = 10;

  addSample(rtt: number, jitter: number, packetLoss: number): void {
    this.samples.push({
      rtt,
      jitter,
      packetLoss,
      timestamp: Date.now(),
    });

    while (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
  }

  analyzeTrend(): NetworkTrend {
    if (this.samples.length < this.trendWindow) {
      return {
        direction: 'stable',
        confidence: 0,
        predictedRtt: this.samples.length > 0 ? this.samples[this.samples.length - 1].rtt : 0,
        predictedJitter: this.samples.length > 0 ? this.samples[this.samples.length - 1].jitter : 0,
      };
    }

    // Get recent samples
    const recent = this.samples.slice(-this.trendWindow);

    // Calculate linear trend for RTT
    const rttTrend = this.calculateLinearTrend(recent.map(s => s.rtt));
    const jitterTrend = this.calculateLinearTrend(recent.map(s => s.jitter));

    // Determine direction
    let direction: 'improving' | 'stable' | 'degrading';
    const threshold = 0.5; // ms per sample

    if (rttTrend < -threshold) {
      direction = 'improving';
    } else if (rttTrend > threshold) {
      direction = 'degrading';
    } else {
      direction = 'stable';
    }

    // Calculate confidence based on consistency
    const rttStdDev = this.calculateStdDev(recent.map(s => s.rtt));
    const confidence = Math.max(0, 1 - rttStdDev / 50);

    // Predict future values (5 samples ahead)
    const predictedRtt = recent[recent.length - 1].rtt + rttTrend * 5;
    const predictedJitter = recent[recent.length - 1].jitter + jitterTrend * 5;

    return {
      direction,
      confidence: Math.round(confidence * 100) / 100,
      predictedRtt: Math.max(0, Math.round(predictedRtt * 10) / 10),
      predictedJitter: Math.max(0, Math.round(predictedJitter * 10) / 10),
    };
  }

  predictSpike(): boolean {
    if (this.samples.length < 5) return false;

    const recent = this.samples.slice(-5);
    const trend = this.calculateLinearTrend(recent.map(s => s.rtt));

    // Predict spike if trend is strongly positive
    return trend > 2; // 2ms per sample increase
  }

  reset(): void {
    this.samples = [];
  }

  private calculateLinearTrend(values: number[]): number {
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumXX += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return isNaN(slope) ? 0 : slope;
  }

  private calculateStdDev(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }
}

// ============================================================================
// Quality Score Calculator
// ============================================================================

export function calculateQualityScore(
  rtt: number,
  jitter: number,
  packetLoss: number,
  bitrate: number
): number {
  // Base score from RTT (0-40 points)
  let rttScore: number;
  if (rtt < 20) rttScore = 40;
  else if (rtt < 50) rttScore = 35;
  else if (rtt < 80) rttScore = 25;
  else if (rtt < 120) rttScore = 15;
  else rttScore = 5;

  // Jitter score (0-20 points)
  let jitterScore: number;
  if (jitter < 2) jitterScore = 20;
  else if (jitter < 5) jitterScore = 15;
  else if (jitter < 10) jitterScore = 10;
  else if (jitter < 20) jitterScore = 5;
  else jitterScore = 0;

  // Packet loss score (0-20 points)
  let lossScore: number;
  if (packetLoss < 0.1) lossScore = 20;
  else if (packetLoss < 1) lossScore = 15;
  else if (packetLoss < 3) lossScore = 10;
  else if (packetLoss < 5) lossScore = 5;
  else lossScore = 0;

  // Bitrate score (0-20 points)
  let bitrateScore: number;
  if (bitrate >= 256) bitrateScore = 20;
  else if (bitrate >= 128) bitrateScore = 15;
  else if (bitrate >= 64) bitrateScore = 10;
  else if (bitrate >= 32) bitrateScore = 5;
  else bitrateScore = 0;

  return Math.min(100, rttScore + jitterScore + lossScore + bitrateScore);
}

// ============================================================================
// Connection Quality Assessor
// ============================================================================

export function assessConnectionQuality(
  rtt: number,
  jitter: number,
  packetLoss: number
): 'excellent' | 'good' | 'fair' | 'poor' {
  const score = calculateQualityScore(rtt, jitter, packetLoss, 128);

  if (score >= 85) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}
