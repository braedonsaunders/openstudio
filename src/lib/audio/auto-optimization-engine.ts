// Auto-Optimization Engine
// Automatically adjusts audio settings based on network conditions
// World-class implementation that exceeds competitors

import type {
  AutoOptimization,
  OptimizationState,
  OptimizationIssue,
  QualityPresetName,
  UserPerformanceInfo,
  JamCompatibility,
} from '@/types';
import { getRecommendedPreset, QUALITY_PRESETS } from './quality-presets';

export interface OptimizationConfig {
  enabled: boolean;
  minTimeBetweenOptimizations: number;  // ms
  issueHistorySize: number;
  autoApplyThreshold: number;           // Issues needed before auto-apply
}

const DEFAULT_CONFIG: OptimizationConfig = {
  enabled: true,
  minTimeBetweenOptimizations: 5000,    // 5 seconds
  issueHistorySize: 20,
  autoApplyThreshold: 3,
};

// Thresholds for issue detection
const THRESHOLDS = {
  HIGH_JITTER: 15,           // ms
  HIGH_LATENCY: 100,         // ms
  CRITICAL_LATENCY: 150,     // ms
  PACKET_LOSS_WARNING: 2,    // %
  PACKET_LOSS_HIGH: 5,       // %
  LOW_LATENCY_STABLE: 30,    // ms - consistently below this
  BUFFER_UNDERRUN_RATE: 0.1, // underruns per second
};

export class AutoOptimizationEngine {
  private config: OptimizationConfig;
  private state: OptimizationState;
  private lastOptimization: number = 0;
  private recentSamples: { rtt: number; jitter: number; packetLoss: number; timestamp: number }[] = [];
  private readonly sampleWindowMs = 10000; // 10 second window

  // Callbacks
  public onOptimizationApplied?: (optimization: AutoOptimization) => void;
  public onOptimizationSuggested?: (optimization: AutoOptimization) => void;
  public onIssueDetected?: (issue: OptimizationIssue) => void;
  public onPresetChange?: (preset: QualityPresetName) => void;
  public onJitterModeChange?: (mode: 'live-jamming' | 'balanced' | 'stable') => void;
  public onFecChange?: (enabled: boolean) => void;
  public onBitrateChange?: (bitrate: number) => void;
  public onLowLatencyModeChange?: (enabled: boolean) => void;

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      isEnabled: this.config.enabled,
      lastOptimization: 0,
      recentIssues: [],
      appliedOptimizations: [],
      pendingOptimizations: [],
    };
  }

  /**
   * Enable or disable auto-optimization
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.state.isEnabled = enabled;
  }

  /**
   * Get current optimization state
   */
  getState(): OptimizationState {
    return { ...this.state };
  }

  /**
   * Add a network sample for analysis
   */
  addSample(rtt: number, jitter: number, packetLoss: number): void {
    const now = Date.now();
    this.recentSamples.push({ rtt, jitter, packetLoss, timestamp: now });

    // Clean old samples
    const cutoff = now - this.sampleWindowMs;
    this.recentSamples = this.recentSamples.filter(s => s.timestamp > cutoff);

    // Analyze and potentially optimize
    if (this.config.enabled) {
      this.analyzeAndOptimize();
    }
  }

  /**
   * Analyze current conditions and apply/suggest optimizations
   */
  analyzeAndOptimize(): void {
    const issues = this.detectIssues();
    const optimizations: AutoOptimization[] = [];

    for (const issue of issues) {
      // Record issue
      this.recordIssue(issue);

      // Generate optimizations
      const opts = this.generateOptimizations(issue);
      optimizations.push(...opts);
    }

    // Deduplicate and process optimizations
    const uniqueOpts = this.deduplicateOptimizations(optimizations);

    for (const opt of uniqueOpts) {
      if (opt.automatic && this.canApplyOptimization()) {
        this.applyOptimization(opt);
      } else {
        this.suggestOptimization(opt);
      }
    }
  }

  /**
   * Detect issues from recent samples
   */
  private detectIssues(): OptimizationIssue[] {
    if (this.recentSamples.length < 3) return [];

    const issues: OptimizationIssue[] = [];
    const now = Date.now();

    // Calculate averages
    const avgRtt = this.average(this.recentSamples.map(s => s.rtt));
    const avgJitter = this.average(this.recentSamples.map(s => s.jitter));
    const avgPacketLoss = this.average(this.recentSamples.map(s => s.packetLoss));
    const p95Rtt = this.percentile(this.recentSamples.map(s => s.rtt), 0.95);

    // High jitter detection
    if (avgJitter > THRESHOLDS.HIGH_JITTER) {
      issues.push({
        type: 'high_jitter',
        severity: avgJitter > THRESHOLDS.HIGH_JITTER * 2 ? 'high' : 'medium',
        detectedAt: now,
        resolved: false,
      });
    }

    // High latency detection
    if (avgRtt > THRESHOLDS.HIGH_LATENCY) {
      issues.push({
        type: 'high_latency',
        severity: avgRtt > THRESHOLDS.CRITICAL_LATENCY ? 'high' : 'medium',
        detectedAt: now,
        resolved: false,
      });
    }

    // Packet loss detection
    if (avgPacketLoss > THRESHOLDS.PACKET_LOSS_WARNING) {
      issues.push({
        type: 'packet_loss',
        severity: avgPacketLoss > THRESHOLDS.PACKET_LOSS_HIGH ? 'high' : 'medium',
        detectedAt: now,
        resolved: false,
      });
    }

    // Consistent low latency detection (opportunity to optimize)
    if (avgRtt < THRESHOLDS.LOW_LATENCY_STABLE && avgJitter < 5 && avgPacketLoss < 0.5) {
      // Check if we've been stable for a while
      const stableFor = this.recentSamples.filter(
        s => s.rtt < THRESHOLDS.LOW_LATENCY_STABLE && s.jitter < 5
      ).length;

      if (stableFor >= 5) {
        issues.push({
          type: 'consistent_low_latency',
          severity: 'low',
          detectedAt: now,
          resolved: false,
        });
      }
    }

    return issues;
  }

  /**
   * Generate optimizations for an issue
   */
  private generateOptimizations(issue: OptimizationIssue): AutoOptimization[] {
    const optimizations: AutoOptimization[] = [];

    switch (issue.type) {
      case 'high_jitter':
        optimizations.push({
          type: 'increase_buffer',
          description: 'Increasing jitter buffer to handle network instability',
          automatic: issue.severity !== 'high',
        });
        if (issue.severity === 'high') {
          optimizations.push({
            type: 'switch_preset',
            description: 'Switching to stable preset for high jitter',
            automatic: false,
          });
        }
        break;

      case 'high_latency':
        optimizations.push({
          type: 'reduce_buffer',
          description: 'Reducing buffer to minimize latency',
          automatic: true,
        });
        optimizations.push({
          type: 'bypass_effects',
          description: 'Bypassing effects to reduce processing latency',
          automatic: issue.severity === 'high',
        });
        if (issue.severity === 'high') {
          optimizations.push({
            type: 'switch_preset',
            description: 'Switching to low-latency preset',
            automatic: false,
          });
        }
        break;

      case 'packet_loss':
        optimizations.push({
          type: 'enable_fec',
          description: 'Enabling Forward Error Correction for packet loss recovery',
          automatic: true,
        });
        if (issue.severity === 'high') {
          optimizations.push({
            type: 'reduce_bitrate',
            description: 'Reducing bitrate to handle congestion',
            automatic: false,
          });
        }
        break;

      case 'consistent_low_latency':
        optimizations.push({
          type: 'reduce_buffer',
          description: 'Network is stable, reducing buffer for lower latency',
          automatic: true,
        });
        optimizations.push({
          type: 'disable_fec',
          description: 'Disabling FEC (not needed with stable connection)',
          automatic: true,
        });
        break;

      case 'buffer_underrun':
        optimizations.push({
          type: 'increase_buffer',
          description: 'Increasing buffer to prevent audio dropouts',
          automatic: true,
        });
        break;
    }

    return optimizations;
  }

  /**
   * Apply an optimization
   */
  private applyOptimization(opt: AutoOptimization): void {
    if (!this.canApplyOptimization()) return;

    this.lastOptimization = Date.now();
    opt.applied = true;
    this.state.appliedOptimizations.push(opt);

    // Remove from pending if present
    this.state.pendingOptimizations = this.state.pendingOptimizations.filter(
      p => p.type !== opt.type
    );

    // Execute the optimization
    switch (opt.type) {
      case 'increase_buffer':
        this.onJitterModeChange?.('stable');
        break;
      case 'reduce_buffer':
        this.onJitterModeChange?.('live-jamming');
        break;
      case 'enable_fec':
        this.onFecChange?.(true);
        break;
      case 'disable_fec':
        this.onFecChange?.(false);
        break;
      case 'bypass_effects':
        this.onLowLatencyModeChange?.(true);
        break;
      case 'enable_effects':
        this.onLowLatencyModeChange?.(false);
        break;
      case 'reduce_bitrate':
        this.onBitrateChange?.(64);
        break;
      case 'increase_bitrate':
        this.onBitrateChange?.(192);
        break;
      case 'switch_preset':
        const recommended = this.getRecommendedPresetFromSamples();
        this.onPresetChange?.(recommended);
        break;
    }

    this.onOptimizationApplied?.(opt);
    console.log(`[AutoOptimization] Applied: ${opt.description}`);
  }

  /**
   * Suggest an optimization (for manual approval)
   */
  private suggestOptimization(opt: AutoOptimization): void {
    // Check if already suggested
    if (this.state.pendingOptimizations.some(p => p.type === opt.type)) {
      return;
    }

    this.state.pendingOptimizations.push(opt);
    this.onOptimizationSuggested?.(opt);
    console.log(`[AutoOptimization] Suggested: ${opt.description}`);
  }

  /**
   * Accept a suggested optimization
   */
  acceptOptimization(type: AutoOptimization['type']): void {
    const opt = this.state.pendingOptimizations.find(p => p.type === type);
    if (opt) {
      opt.automatic = true; // Override to apply
      this.applyOptimization(opt);
    }
  }

  /**
   * Dismiss a suggested optimization
   */
  dismissOptimization(type: AutoOptimization['type']): void {
    this.state.pendingOptimizations = this.state.pendingOptimizations.filter(
      p => p.type !== type
    );
  }

  /**
   * Get recommended preset based on current samples
   */
  private getRecommendedPresetFromSamples(): QualityPresetName {
    if (this.recentSamples.length === 0) return 'balanced';
    const avgRtt = this.average(this.recentSamples.map(s => s.rtt));
    return getRecommendedPreset(avgRtt);
  }

  /**
   * Check if we can apply an optimization (rate limiting)
   */
  private canApplyOptimization(): boolean {
    return Date.now() - this.lastOptimization >= this.config.minTimeBetweenOptimizations;
  }

  /**
   * Record an issue
   */
  private recordIssue(issue: OptimizationIssue): void {
    this.state.recentIssues.push(issue);
    while (this.state.recentIssues.length > this.config.issueHistorySize) {
      this.state.recentIssues.shift();
    }
    this.onIssueDetected?.(issue);
  }

  /**
   * Deduplicate optimizations
   */
  private deduplicateOptimizations(opts: AutoOptimization[]): AutoOptimization[] {
    const seen = new Set<string>();
    return opts.filter(opt => {
      if (seen.has(opt.type)) return false;
      seen.add(opt.type);
      return true;
    });
  }

  /**
   * Calculate average
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(p * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Reset the engine
   */
  reset(): void {
    this.recentSamples = [];
    this.state = {
      isEnabled: this.config.enabled,
      lastOptimization: 0,
      recentIssues: [],
      appliedOptimizations: [],
      pendingOptimizations: [],
    };
    this.lastOptimization = 0;
  }
}

/**
 * Create a configured auto-optimization engine
 */
export function createAutoOptimizationEngine(
  config?: Partial<OptimizationConfig>
): AutoOptimizationEngine {
  return new AutoOptimizationEngine(config);
}
