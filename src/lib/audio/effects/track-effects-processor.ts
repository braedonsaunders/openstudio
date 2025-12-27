// Track Effects Processor - Manages complete effects chain for a single track

import { NoiseGateProcessor } from './noise-gate';
import { EQProcessor } from './eq';
import { CompressorProcessor } from './compressor';
import { ReverbProcessor } from './reverb';
import { LimiterProcessor } from './limiter';
import { DEFAULT_EFFECTS_CHAIN } from './presets';
import type {
  TrackEffectsChain,
  NoiseGateSettings,
  EQSettings,
  EQBand,
  CompressorSettings,
  ReverbSettings,
  LimiterSettings,
} from '@/types';

export class TrackEffectsProcessor {
  private audioContext: AudioContext;
  private inputGain: GainNode;
  private outputGain: GainNode;

  // Effect processors in signal chain order
  private noiseGate: NoiseGateProcessor;
  private eq: EQProcessor;
  private compressor: CompressorProcessor;
  private reverb: ReverbProcessor;
  private limiter: LimiterProcessor;

  private settings: TrackEffectsChain;
  private onSettingsChange?: (settings: TrackEffectsChain) => void;

  constructor(
    audioContext: AudioContext,
    initialSettings?: Partial<TrackEffectsChain>,
    onSettingsChange?: (settings: TrackEffectsChain) => void
  ) {
    this.audioContext = audioContext;
    this.onSettingsChange = onSettingsChange;

    // Merge with defaults
    this.settings = {
      noiseGate: { ...DEFAULT_EFFECTS_CHAIN.noiseGate, ...initialSettings?.noiseGate },
      eq: {
        enabled: initialSettings?.eq?.enabled ?? DEFAULT_EFFECTS_CHAIN.eq.enabled,
        bands: initialSettings?.eq?.bands
          ? initialSettings.eq.bands.map((b) => ({ ...b }))
          : DEFAULT_EFFECTS_CHAIN.eq.bands.map((b) => ({ ...b })),
      },
      compressor: { ...DEFAULT_EFFECTS_CHAIN.compressor, ...initialSettings?.compressor },
      reverb: { ...DEFAULT_EFFECTS_CHAIN.reverb, ...initialSettings?.reverb },
      limiter: { ...DEFAULT_EFFECTS_CHAIN.limiter, ...initialSettings?.limiter },
    };

    // Create input/output gain nodes
    this.inputGain = audioContext.createGain();
    this.outputGain = audioContext.createGain();

    // Create effect processors
    this.noiseGate = new NoiseGateProcessor(audioContext, this.settings.noiseGate);
    this.eq = new EQProcessor(audioContext, this.settings.eq);
    this.compressor = new CompressorProcessor(audioContext, this.settings.compressor);
    this.reverb = new ReverbProcessor(audioContext, this.settings.reverb);
    this.limiter = new LimiterProcessor(audioContext, this.settings.limiter);

    // Wire up the effects chain:
    // input -> noiseGate -> eq -> compressor -> reverb -> limiter -> output
    this.inputGain.connect(this.noiseGate.getInputNode());
    this.noiseGate.connect(this.eq.getInputNode());
    this.eq.connect(this.compressor.getInputNode());
    this.compressor.connect(this.reverb.getInputNode());
    this.reverb.connect(this.limiter.getInputNode());
    this.limiter.connect(this.outputGain);
  }

  // Get input node (where audio comes in)
  getInputNode(): GainNode {
    return this.inputGain;
  }

  // Get output node (where audio goes out)
  getOutputNode(): GainNode {
    return this.outputGain;
  }

  // Connect output to destination
  connect(destination: AudioNode): void {
    this.outputGain.connect(destination);
  }

  // Disconnect output
  disconnect(): void {
    this.outputGain.disconnect();
  }

  // Update entire effects chain
  updateSettings(settings: Partial<TrackEffectsChain>): void {
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

  // Individual effect updates
  updateNoiseGate(settings: Partial<NoiseGateSettings>): void {
    this.settings.noiseGate = { ...this.settings.noiseGate, ...settings };
    this.noiseGate.updateSettings(settings);
    this.notifySettingsChange();
  }

  updateEQ(settings: Partial<EQSettings>): void {
    if (settings.enabled !== undefined) {
      this.settings.eq.enabled = settings.enabled;
    }
    if (settings.bands) {
      this.settings.eq.bands = settings.bands.map((b) => ({ ...b }));
    }
    this.eq.updateSettings(settings);
    this.notifySettingsChange();
  }

  updateEQBand(index: number, updates: Partial<EQBand>): void {
    this.eq.updateBand(index, updates);
    if (index >= 0 && index < this.settings.eq.bands.length) {
      this.settings.eq.bands[index] = { ...this.settings.eq.bands[index], ...updates };
    }
    this.notifySettingsChange();
  }

  updateCompressor(settings: Partial<CompressorSettings>): void {
    this.settings.compressor = { ...this.settings.compressor, ...settings };
    this.compressor.updateSettings(settings);
    this.notifySettingsChange();
  }

  updateReverb(settings: Partial<ReverbSettings>): void {
    this.settings.reverb = { ...this.settings.reverb, ...settings };
    this.reverb.updateSettings(settings);
    this.notifySettingsChange();
  }

  updateLimiter(settings: Partial<LimiterSettings>): void {
    this.settings.limiter = { ...this.settings.limiter, ...settings };
    this.limiter.updateSettings(settings);
    this.notifySettingsChange();
  }

  // Toggle individual effects
  setNoiseGateEnabled(enabled: boolean): void {
    this.updateNoiseGate({ enabled });
  }

  setEQEnabled(enabled: boolean): void {
    this.updateEQ({ enabled });
  }

  setCompressorEnabled(enabled: boolean): void {
    this.updateCompressor({ enabled });
  }

  setReverbEnabled(enabled: boolean): void {
    this.updateReverb({ enabled });
  }

  setLimiterEnabled(enabled: boolean): void {
    this.updateLimiter({ enabled });
  }

  // Get current settings
  getSettings(): TrackEffectsChain {
    return {
      noiseGate: this.noiseGate.getSettings(),
      eq: this.eq.getSettings(),
      compressor: this.compressor.getSettings(),
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

  // Get EQ frequency response for visualization
  getEQFrequencyResponse(frequencies: Float32Array<ArrayBuffer>): {
    magnitude: Float32Array<ArrayBuffer>;
    phase: Float32Array<ArrayBuffer>;
  } {
    return this.eq.getFrequencyResponse(frequencies);
  }

  // Load preset
  loadPreset(effectsChain: TrackEffectsChain): void {
    this.updateSettings(effectsChain);
  }

  // Reset to defaults
  reset(): void {
    this.updateSettings(DEFAULT_EFFECTS_CHAIN);
  }

  private notifySettingsChange(): void {
    this.onSettingsChange?.(this.getSettings());
  }

  // Clean up resources
  dispose(): void {
    this.disconnect();
    this.noiseGate.dispose();
    this.eq.dispose();
    this.compressor.dispose();
    this.reverb.dispose();
    this.limiter.dispose();
    this.inputGain.disconnect();
  }
}
