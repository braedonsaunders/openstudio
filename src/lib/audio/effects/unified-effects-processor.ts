// Unified Effects Processor
// Combines all effects (guitar + track) into a single signal chain
// Signal flow: wah → overdrive → distortion → amp → cabinet → noiseGate → eq → compressor → chorus → flanger → phaser → delay → tremolo → reverb → limiter

import { NoiseGateProcessor } from './noise-gate';
import { EQProcessor } from './eq';
import { CompressorProcessor } from './compressor';
import { ReverbProcessor } from './reverb';
import { LimiterProcessor } from './limiter';
import { OverdriveProcessor } from './guitar/overdrive';
import { DistortionProcessor } from './guitar/distortion';
import { AmpSimulatorProcessor } from './guitar/amp-simulator';
import { CabinetSimulatorProcessor } from './guitar/cabinet-simulator';
import { DelayProcessor } from './guitar/delay';
import { ChorusProcessor } from './guitar/chorus';
import { FlangerProcessor } from './guitar/flanger';
import { PhaserProcessor } from './guitar/phaser';
import { WahProcessor } from './guitar/wah';
import { TremoloProcessor } from './guitar/tremolo';
import type { UnifiedEffectsChain } from '@/types';

// Default settings for all effects
export const DEFAULT_UNIFIED_EFFECTS: UnifiedEffectsChain = {
  // Guitar/instrument effects (pre-processing) - all disabled by default
  wah: {
    enabled: false,
    mode: 'auto',
    frequency: 0.5,
    rate: 2,
    depth: 0.8,
    baseFrequency: 350,
    maxFrequency: 2500,
    q: 5,
    sensitivity: 0.5,
    attack: 0.05,
    release: 0.2,
    mix: 1,
  },
  overdrive: {
    enabled: false,
    drive: 0.5,
    tone: 0.5,
    level: 0.5,
  },
  distortion: {
    enabled: false,
    amount: 0.5,
    type: 'classic',
    tone: 0.5,
    level: 0.5,
  },
  ampSimulator: {
    enabled: false,
    type: 'crunch',
    gain: 0.5,
    bass: 0.5,
    mid: 0.5,
    treble: 0.5,
    presence: 0.5,
    master: 0.5,
  },
  cabinet: {
    enabled: false,
    type: '4x12',
    micPosition: 'center',
    mix: 1.0,
    roomLevel: 0.2,
  },
  // Track effects (mixing)
  noiseGate: {
    enabled: false,
    threshold: -40,
    attack: 0.5,
    hold: 50,
    release: 100,
    range: -80,
  },
  eq: {
    enabled: false,
    bands: [
      { frequency: 80, gain: 0, q: 1.0, type: 'lowshelf' },
      { frequency: 240, gain: 0, q: 1.0, type: 'peaking' },
      { frequency: 750, gain: 0, q: 1.0, type: 'peaking' },
      { frequency: 2200, gain: 0, q: 1.0, type: 'peaking' },
      { frequency: 6000, gain: 0, q: 1.0, type: 'highshelf' },
    ],
  },
  compressor: {
    enabled: false,
    threshold: -24,
    ratio: 4,
    attack: 10,
    release: 100,
    knee: 6,
    makeupGain: 0,
  },
  // Modulation effects
  chorus: {
    enabled: false,
    rate: 1.5,
    depth: 0.5,
    delay: 3.5,
    feedback: 0,
    spread: 180,
    mix: 0.5,
  },
  flanger: {
    enabled: false,
    rate: 0.5,
    depth: 0.5,
    delay: 2,
    feedback: 0.5,
    mix: 0.5,
    negative: false,
  },
  phaser: {
    enabled: false,
    rate: 0.5,
    depth: 0.5,
    baseFrequency: 350,
    octaves: 3,
    stages: 4,
    feedback: 0.3,
    q: 1,
    mix: 0.5,
  },
  // Time-based effects
  delay: {
    enabled: false,
    type: 'digital',
    time: 0.4,
    feedback: 0.3,
    mix: 0.3,
    tone: 0.8,
    modulation: 0.1,
    pingPongSpread: 0.5,
    tempo: 120,
    tempoSync: false,
    subdivision: '1/4',
  },
  tremolo: {
    enabled: false,
    rate: 5,
    depth: 0.5,
    spread: 0,
    waveform: 'sine',
  },
  // Output effects
  reverb: {
    enabled: false,
    type: 'room',
    decay: 1.5,
    preDelay: 20,
    highCut: 8000,
    lowCut: 100,
    mix: 0.3,
  },
  limiter: {
    enabled: false,
    threshold: -1,
    release: 100,
    ceiling: -0.3,
  },
};

export class UnifiedEffectsProcessor {
  private audioContext: AudioContext;
  private inputGain: GainNode;
  private outputGain: GainNode;

  // All effect processors in signal chain order
  private wah: WahProcessor;
  private overdrive: OverdriveProcessor;
  private distortion: DistortionProcessor;
  private ampSimulator: AmpSimulatorProcessor;
  private cabinet: CabinetSimulatorProcessor;
  private noiseGate: NoiseGateProcessor;
  private eq: EQProcessor;
  private compressor: CompressorProcessor;
  private chorus: ChorusProcessor;
  private flanger: FlangerProcessor;
  private phaser: PhaserProcessor;
  private delay: DelayProcessor;
  private tremolo: TremoloProcessor;
  private reverb: ReverbProcessor;
  private limiter: LimiterProcessor;

  private settings: UnifiedEffectsChain;
  private onSettingsChange?: (settings: UnifiedEffectsChain) => void;

  // Low-latency mode optimization
  private lowLatencyMode: boolean = false;
  private directBypassNode: GainNode | null = null;

  constructor(
    audioContext: AudioContext,
    initialSettings?: Partial<UnifiedEffectsChain>,
    onSettingsChange?: (settings: UnifiedEffectsChain) => void
  ) {
    this.audioContext = audioContext;
    this.onSettingsChange = onSettingsChange;

    // Merge with defaults
    this.settings = this.mergeSettings(initialSettings);

    // Create input/output gain nodes
    this.inputGain = audioContext.createGain();
    this.outputGain = audioContext.createGain();

    // Create all effect processors
    this.wah = new WahProcessor(audioContext, this.settings.wah);
    this.overdrive = new OverdriveProcessor(audioContext, this.settings.overdrive);
    this.distortion = new DistortionProcessor(audioContext, this.settings.distortion);
    this.ampSimulator = new AmpSimulatorProcessor(audioContext, this.settings.ampSimulator);
    this.cabinet = new CabinetSimulatorProcessor(audioContext, this.settings.cabinet);
    this.noiseGate = new NoiseGateProcessor(audioContext, this.settings.noiseGate);
    this.eq = new EQProcessor(audioContext, this.settings.eq);
    this.compressor = new CompressorProcessor(audioContext, this.settings.compressor);
    this.chorus = new ChorusProcessor(audioContext, this.settings.chorus);
    this.flanger = new FlangerProcessor(audioContext, this.settings.flanger);
    this.phaser = new PhaserProcessor(audioContext, this.settings.phaser);
    this.delay = new DelayProcessor(audioContext, this.settings.delay);
    this.tremolo = new TremoloProcessor(audioContext, this.settings.tremolo);
    this.reverb = new ReverbProcessor(audioContext, this.settings.reverb);
    this.limiter = new LimiterProcessor(audioContext, this.settings.limiter);

    // Wire up the complete signal chain
    this.inputGain.connect(this.wah.getInputNode());
    this.wah.connect(this.overdrive.getInputNode());
    this.overdrive.connect(this.distortion.getInputNode());
    this.distortion.connect(this.ampSimulator.getInputNode());
    this.ampSimulator.connect(this.cabinet.getInputNode());
    this.cabinet.connect(this.noiseGate.getInputNode());
    this.noiseGate.connect(this.eq.getInputNode());
    this.eq.connect(this.compressor.getInputNode());
    this.compressor.connect(this.chorus.getInputNode());
    this.chorus.connect(this.flanger.getInputNode());
    this.flanger.connect(this.phaser.getInputNode());
    this.phaser.connect(this.delay.getInputNode());
    this.delay.connect(this.tremolo.getInputNode());
    this.tremolo.connect(this.reverb.getInputNode());
    this.reverb.connect(this.limiter.getInputNode());
    this.limiter.connect(this.outputGain);
  }

  private mergeSettings(initial?: Partial<UnifiedEffectsChain>): UnifiedEffectsChain {
    return {
      wah: { ...DEFAULT_UNIFIED_EFFECTS.wah, ...initial?.wah },
      overdrive: { ...DEFAULT_UNIFIED_EFFECTS.overdrive, ...initial?.overdrive },
      distortion: { ...DEFAULT_UNIFIED_EFFECTS.distortion, ...initial?.distortion },
      ampSimulator: { ...DEFAULT_UNIFIED_EFFECTS.ampSimulator, ...initial?.ampSimulator },
      cabinet: { ...DEFAULT_UNIFIED_EFFECTS.cabinet, ...initial?.cabinet },
      noiseGate: { ...DEFAULT_UNIFIED_EFFECTS.noiseGate, ...initial?.noiseGate },
      eq: {
        enabled: initial?.eq?.enabled ?? DEFAULT_UNIFIED_EFFECTS.eq.enabled,
        bands: initial?.eq?.bands
          ? initial.eq.bands.map((b) => ({ ...b }))
          : DEFAULT_UNIFIED_EFFECTS.eq.bands.map((b) => ({ ...b })),
      },
      compressor: { ...DEFAULT_UNIFIED_EFFECTS.compressor, ...initial?.compressor },
      chorus: { ...DEFAULT_UNIFIED_EFFECTS.chorus, ...initial?.chorus },
      flanger: { ...DEFAULT_UNIFIED_EFFECTS.flanger, ...initial?.flanger },
      phaser: { ...DEFAULT_UNIFIED_EFFECTS.phaser, ...initial?.phaser },
      delay: { ...DEFAULT_UNIFIED_EFFECTS.delay, ...initial?.delay },
      tremolo: { ...DEFAULT_UNIFIED_EFFECTS.tremolo, ...initial?.tremolo },
      reverb: { ...DEFAULT_UNIFIED_EFFECTS.reverb, ...initial?.reverb },
      limiter: { ...DEFAULT_UNIFIED_EFFECTS.limiter, ...initial?.limiter },
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

  // Update all effects at once
  updateSettings(settings: Partial<UnifiedEffectsChain>): void {
    if (settings.wah) {
      this.settings.wah = { ...this.settings.wah, ...settings.wah };
      this.wah.updateSettings(settings.wah);
    }
    if (settings.overdrive) {
      this.settings.overdrive = { ...this.settings.overdrive, ...settings.overdrive };
      this.overdrive.updateSettings(settings.overdrive);
    }
    if (settings.distortion) {
      this.settings.distortion = { ...this.settings.distortion, ...settings.distortion };
      this.distortion.updateSettings(settings.distortion);
    }
    if (settings.ampSimulator) {
      this.settings.ampSimulator = { ...this.settings.ampSimulator, ...settings.ampSimulator };
      this.ampSimulator.updateSettings(settings.ampSimulator);
    }
    if (settings.cabinet) {
      this.settings.cabinet = { ...this.settings.cabinet, ...settings.cabinet };
      this.cabinet.updateSettings(settings.cabinet);
    }
    if (settings.noiseGate) {
      this.settings.noiseGate = { ...this.settings.noiseGate, ...settings.noiseGate };
      this.noiseGate.updateSettings(settings.noiseGate);
    }
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
    if (settings.chorus) {
      this.settings.chorus = { ...this.settings.chorus, ...settings.chorus };
      this.chorus.updateSettings(settings.chorus);
    }
    if (settings.flanger) {
      this.settings.flanger = { ...this.settings.flanger, ...settings.flanger };
      this.flanger.updateSettings(settings.flanger);
    }
    if (settings.phaser) {
      this.settings.phaser = { ...this.settings.phaser, ...settings.phaser };
      this.phaser.updateSettings(settings.phaser);
    }
    if (settings.delay) {
      this.settings.delay = { ...this.settings.delay, ...settings.delay };
      this.delay.updateSettings(settings.delay);
    }
    if (settings.tremolo) {
      this.settings.tremolo = { ...this.settings.tremolo, ...settings.tremolo };
      this.tremolo.updateSettings(settings.tremolo);
    }
    if (settings.reverb) {
      this.settings.reverb = { ...this.settings.reverb, ...settings.reverb };
      this.reverb.updateSettings(settings.reverb);
    }
    if (settings.limiter) {
      this.settings.limiter = { ...this.settings.limiter, ...settings.limiter };
      this.limiter.updateSettings(settings.limiter);
    }

    this.notifySettingsChange();
  }

  // Set tempo for tempo-synced effects (delay)
  setTempo(bpm: number): void {
    this.delay.setTempo(bpm);
  }

  // Get current settings
  getSettings(): UnifiedEffectsChain {
    return {
      wah: this.wah.getSettings(),
      overdrive: this.overdrive.getSettings(),
      distortion: this.distortion.getSettings(),
      ampSimulator: this.ampSimulator.getSettings(),
      cabinet: this.cabinet.getSettings(),
      noiseGate: this.noiseGate.getSettings(),
      eq: this.eq.getSettings(),
      compressor: this.compressor.getSettings(),
      chorus: this.chorus.getSettings(),
      flanger: this.flanger.getSettings(),
      phaser: this.phaser.getSettings(),
      delay: this.delay.getSettings(),
      tremolo: this.tremolo.getSettings(),
      reverb: this.reverb.getSettings(),
      limiter: this.limiter.getSettings(),
    };
  }

  // Get metering data for UI
  getMeteringData(): {
    noiseGateOpen: boolean;
    compressorReduction: number;
    limiterReduction: number;
  } {
    return {
      noiseGateOpen: this.noiseGate.isGateOpen(),
      compressorReduction: this.compressor.getGainReduction(),
      limiterReduction: this.limiter.getGainReduction(),
    };
  }

  // Get list of enabled effects for UI display
  getEnabledEffects(): string[] {
    const enabled: string[] = [];
    if (this.settings.wah.enabled) enabled.push('Wah');
    if (this.settings.overdrive.enabled) enabled.push('Overdrive');
    if (this.settings.distortion.enabled) enabled.push('Distortion');
    if (this.settings.ampSimulator.enabled) enabled.push('Amp');
    if (this.settings.cabinet.enabled) enabled.push('Cabinet');
    if (this.settings.noiseGate.enabled) enabled.push('Gate');
    if (this.settings.eq.enabled) enabled.push('EQ');
    if (this.settings.compressor.enabled) enabled.push('Comp');
    if (this.settings.chorus.enabled) enabled.push('Chorus');
    if (this.settings.flanger.enabled) enabled.push('Flanger');
    if (this.settings.phaser.enabled) enabled.push('Phaser');
    if (this.settings.delay.enabled) enabled.push('Delay');
    if (this.settings.tremolo.enabled) enabled.push('Tremolo');
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

  // Load preset
  loadPreset(effectsChain: UnifiedEffectsChain): void {
    this.updateSettings(effectsChain);
  }

  // Reset to defaults
  reset(): void {
    this.updateSettings(DEFAULT_UNIFIED_EFFECTS);
  }

  /**
   * Enable low-latency mode for live jamming.
   * In this mode, when no effects are enabled (except limiter),
   * audio bypasses the entire effects chain for ~1-2ms latency savings.
   *
   * The signal flow becomes: input -> limiter -> output
   * instead of: input -> 15 effect nodes -> output
   */
  setLowLatencyMode(enabled: boolean): void {
    if (this.lowLatencyMode === enabled) return;

    this.lowLatencyMode = enabled;
    console.log(`[UnifiedEffectsProcessor] Low-latency mode: ${enabled ? 'ON' : 'OFF'}`);

    this.optimizeSignalChain();
  }

  /**
   * Check if low-latency mode is enabled
   */
  isLowLatencyMode(): boolean {
    return this.lowLatencyMode;
  }

  /**
   * Optimize the signal chain based on which effects are enabled.
   * In low-latency mode, if no effects are enabled (except limiter),
   * creates a direct bypass path to minimize node traversal.
   */
  private optimizeSignalChain(): void {
    if (!this.lowLatencyMode) {
      // Disable bypass and use normal signal chain
      this.disableDirectBypass();
      return;
    }

    // Check if any effects (except limiter) are enabled
    const anyEffectEnabled =
      this.settings.wah.enabled ||
      this.settings.overdrive.enabled ||
      this.settings.distortion.enabled ||
      this.settings.ampSimulator.enabled ||
      this.settings.cabinet.enabled ||
      this.settings.noiseGate.enabled ||
      this.settings.eq.enabled ||
      this.settings.compressor.enabled ||
      this.settings.chorus.enabled ||
      this.settings.flanger.enabled ||
      this.settings.phaser.enabled ||
      this.settings.delay.enabled ||
      this.settings.tremolo.enabled ||
      this.settings.reverb.enabled;

    if (!anyEffectEnabled) {
      // All effects are disabled - create direct bypass to limiter
      this.enableDirectBypass();
    } else {
      // Some effects are enabled - use normal signal chain
      this.disableDirectBypass();
    }
  }

  /**
   * Create direct bypass path: input -> limiter -> output
   * Saves latency by skipping disabled effect nodes
   */
  private enableDirectBypass(): void {
    if (this.directBypassNode) return; // Already enabled

    // Create a direct bypass gain node
    this.directBypassNode = this.audioContext.createGain();
    this.directBypassNode.gain.value = 1;

    // Disconnect normal signal chain from input
    this.inputGain.disconnect();

    // Connect input directly to limiter via bypass node
    this.inputGain.connect(this.directBypassNode);
    this.directBypassNode.connect(this.limiter.getInputNode());

    console.log('[UnifiedEffectsProcessor] Direct bypass enabled (all effects off)');
  }

  /**
   * Disable direct bypass and restore normal signal chain
   */
  private disableDirectBypass(): void {
    if (!this.directBypassNode) return; // Already disabled

    // Disconnect bypass
    this.inputGain.disconnect();
    this.directBypassNode.disconnect();
    this.directBypassNode = null;

    // Restore normal signal chain
    this.inputGain.connect(this.wah.getInputNode());

    console.log('[UnifiedEffectsProcessor] Direct bypass disabled (using effects chain)');
  }

  /**
   * Get the estimated latency added by the effects chain in milliseconds.
   * This is a rough estimate based on the number of active nodes.
   */
  getEstimatedLatency(): number {
    if (this.lowLatencyMode && !this.directBypassNode) {
      // All effects bypassed via direct path
      return 0.1; // Just limiter
    }

    // Count enabled effects (each adds ~0.1-0.2ms of processing latency)
    const enabledCount = this.getEnabledEffects().length;
    return enabledCount * 0.15; // Rough estimate
  }

  private notifySettingsChange(): void {
    this.onSettingsChange?.(this.getSettings());

    // Re-optimize signal chain when settings change
    if (this.lowLatencyMode) {
      this.optimizeSignalChain();
    }
  }

  // Clean up resources
  dispose(): void {
    this.disconnect();

    // Clean up bypass node if exists
    if (this.directBypassNode) {
      this.directBypassNode.disconnect();
      this.directBypassNode = null;
    }

    this.wah.dispose();
    this.overdrive.dispose();
    this.distortion.dispose();
    this.ampSimulator.dispose();
    this.cabinet.dispose();
    this.noiseGate.dispose();
    this.eq.dispose();
    this.compressor.dispose();
    this.chorus.dispose();
    this.flanger.dispose();
    this.phaser.dispose();
    this.delay.dispose();
    this.tremolo.dispose();
    this.reverb.dispose();
    this.limiter.dispose();
    this.inputGain.disconnect();
  }
}
