// Master Effects Processor
// Lightweight effects chain for master bus: EQ → Compressor → Reverb → Limiter
// Optimized for minimal latency with bypass when all effects disabled

import { EQProcessor } from './eq';
import { CompressorProcessor } from './compressor';
import { ReverbProcessor } from './reverb';
import { LimiterProcessor } from './limiter';
import type { EQSettings, CompressorSettings, ReverbSettings, LimiterSettings } from '@/types';

// Master-specific effects chain (subset of full chain)
export interface MasterEffectsChain {
  eq: EQSettings;
  compressor: CompressorSettings;
  reverb: ReverbSettings;
  limiter: LimiterSettings;
}

// Default settings optimized for master bus
export const DEFAULT_MASTER_EFFECTS: MasterEffectsChain = {
  eq: {
    enabled: false,
    bands: [
      { frequency: 60, gain: 0, q: 0.7, type: 'lowshelf' },   // Sub bass
      { frequency: 400, gain: 0, q: 1.0, type: 'peaking' },   // Low-mids
      { frequency: 2500, gain: 0, q: 1.0, type: 'peaking' },  // Presence
      { frequency: 10000, gain: 0, q: 0.7, type: 'highshelf' }, // Air
    ],
  },
  compressor: {
    enabled: false,
    threshold: -12,    // Gentler threshold for master bus
    ratio: 2,          // Gentle ratio for glue compression
    attack: 30,        // Slower attack to preserve transients
    release: 200,      // Medium release
    knee: 10,          // Soft knee for transparency
    makeupGain: 0,
  },
  reverb: {
    enabled: false,
    type: 'hall',
    decay: 2.0,
    preDelay: 30,
    highCut: 6000,
    lowCut: 200,
    mix: 0.15,         // Subtle mix for master
  },
  limiter: {
    enabled: true,     // Always on for safety
    threshold: -0.5,
    release: 50,
    ceiling: -0.1,
  },
};

export class MasterEffectsProcessor {
  private audioContext: AudioContext;
  private inputGain: GainNode;
  private outputGain: GainNode;

  // Effect processors (minimal chain)
  private eq: EQProcessor;
  private compressor: CompressorProcessor;
  private reverb: ReverbProcessor;
  private limiter: LimiterProcessor;

  private settings: MasterEffectsChain;
  private enabled: boolean = false;
  private bypassNode: GainNode | null = null;
  private onSettingsChange?: (settings: MasterEffectsChain) => void;

  constructor(
    audioContext: AudioContext,
    initialSettings?: Partial<MasterEffectsChain>,
    onSettingsChange?: (settings: MasterEffectsChain) => void
  ) {
    this.audioContext = audioContext;
    this.onSettingsChange = onSettingsChange;

    // Merge with defaults
    this.settings = this.mergeSettings(initialSettings);

    // Create input/output gain nodes
    this.inputGain = audioContext.createGain();
    this.outputGain = audioContext.createGain();

    // Create effect processors
    this.eq = new EQProcessor(audioContext, this.settings.eq);
    this.compressor = new CompressorProcessor(audioContext, this.settings.compressor);
    this.reverb = new ReverbProcessor(audioContext, this.settings.reverb);
    this.limiter = new LimiterProcessor(audioContext, this.settings.limiter);

    // Wire up signal chain: input → EQ → Compressor → Reverb → Limiter → output
    this.inputGain.connect(this.eq.getInputNode());
    this.eq.connect(this.compressor.getInputNode());
    this.compressor.connect(this.reverb.getInputNode());
    this.reverb.connect(this.limiter.getInputNode());
    this.limiter.connect(this.outputGain);
  }

  private mergeSettings(initial?: Partial<MasterEffectsChain>): MasterEffectsChain {
    return {
      eq: {
        enabled: initial?.eq?.enabled ?? DEFAULT_MASTER_EFFECTS.eq.enabled,
        bands: initial?.eq?.bands
          ? initial.eq.bands.map((b) => ({ ...b }))
          : DEFAULT_MASTER_EFFECTS.eq.bands.map((b) => ({ ...b })),
      },
      compressor: { ...DEFAULT_MASTER_EFFECTS.compressor, ...initial?.compressor },
      reverb: { ...DEFAULT_MASTER_EFFECTS.reverb, ...initial?.reverb },
      limiter: { ...DEFAULT_MASTER_EFFECTS.limiter, ...initial?.limiter },
    };
  }

  // Input/Output nodes
  getInputNode(): GainNode {
    return this.inputGain;
  }

  getOutputNode(): GainNode {
    return this.outputGain;
  }

  connect(destination: AudioNode): void {
    this.outputGain.connect(destination);
  }

  disconnect(): void {
    this.outputGain.disconnect();
  }

  /**
   * Enable or disable the entire master effects chain.
   * When disabled, audio bypasses all processing for zero latency.
   */
  setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;

    if (enabled) {
      this.disableBypass();
    } else {
      this.enableBypass();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Create bypass path: input → output (skips all effects)
   */
  private enableBypass(): void {
    if (this.bypassNode) return;

    // Disconnect effects chain
    this.inputGain.disconnect();

    // Create direct bypass
    this.bypassNode = this.audioContext.createGain();
    this.bypassNode.gain.value = 1;
    this.inputGain.connect(this.bypassNode);
    this.bypassNode.connect(this.outputGain);

    console.log('[MasterEffectsProcessor] Bypass enabled');
  }

  /**
   * Disable bypass and restore effects chain
   */
  private disableBypass(): void {
    if (!this.bypassNode) return;

    // Disconnect bypass
    this.inputGain.disconnect();
    this.bypassNode.disconnect();
    this.bypassNode = null;

    // Restore effects chain
    this.inputGain.connect(this.eq.getInputNode());

    console.log('[MasterEffectsProcessor] Bypass disabled, effects active');
  }

  // Update settings
  updateSettings(settings: Partial<MasterEffectsChain>): void {
    if (settings.eq) {
      if (settings.eq.enabled !== undefined) {
        this.settings.eq.enabled = settings.eq.enabled;
      }
      if (settings.eq.bands) {
        this.settings.eq.bands = settings.eq.bands.map((b) => ({ ...b }));
      }
      this.eq.updateSettings(settings.eq);
    }
    if (settings.compressor) {
      this.settings.compressor = { ...this.settings.compressor, ...settings.compressor };
      this.compressor.updateSettings(settings.compressor);
    }
    if (settings.reverb) {
      this.settings.reverb = { ...this.settings.reverb, ...settings.reverb };
      this.reverb.updateSettings(settings.reverb);
    }
    if (settings.limiter) {
      this.settings.limiter = { ...this.settings.limiter, ...settings.limiter };
      this.limiter.updateSettings(settings.limiter);
    }

    this.onSettingsChange?.(this.getSettings());
  }

  // Get current settings
  getSettings(): MasterEffectsChain {
    return {
      eq: this.eq.getSettings(),
      compressor: this.compressor.getSettings(),
      reverb: this.reverb.getSettings(),
      limiter: this.limiter.getSettings(),
    };
  }

  // Get metering data for UI
  getMeteringData(): {
    compressorReduction: number;
    limiterReduction: number;
  } {
    return {
      compressorReduction: this.compressor.getGainReduction(),
      limiterReduction: this.limiter.getGainReduction(),
    };
  }

  // Get list of enabled effects
  getEnabledEffects(): string[] {
    const enabled: string[] = [];
    if (this.settings.eq.enabled) enabled.push('EQ');
    if (this.settings.compressor.enabled) enabled.push('Comp');
    if (this.settings.reverb.enabled) enabled.push('Reverb');
    if (this.settings.limiter.enabled) enabled.push('Limiter');
    return enabled;
  }

  // Get EQ frequency response for visualization
  getEQFrequencyResponse(frequencies: Float32Array<ArrayBuffer>): {
    magnitude: Float32Array<ArrayBuffer>;
    phase: Float32Array<ArrayBuffer>;
  } {
    return this.eq.getFrequencyResponse(frequencies);
  }

  /**
   * Get estimated latency in milliseconds.
   * Returns 0 if bypassed, otherwise ~0.5-1ms for the chain.
   */
  getEstimatedLatency(): number {
    if (!this.enabled || this.bypassNode) {
      return 0;
    }
    // 4 effects × ~0.15ms each
    return this.getEnabledEffects().length * 0.15;
  }

  // Reset to defaults
  reset(): void {
    this.updateSettings(DEFAULT_MASTER_EFFECTS);
  }

  // Load preset
  loadPreset(preset: MasterEffectsChain): void {
    this.updateSettings(preset);
  }

  // Clean up resources
  dispose(): void {
    this.disconnect();

    if (this.bypassNode) {
      this.bypassNode.disconnect();
      this.bypassNode = null;
    }

    this.eq.dispose();
    this.compressor.dispose();
    this.reverb.dispose();
    this.limiter.dispose();
    this.inputGain.disconnect();
  }
}
