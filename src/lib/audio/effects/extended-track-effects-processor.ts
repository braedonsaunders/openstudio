// Extended Track Effects Processor
// Combines the standard track effects chain with guitar-specific effects
// Signal flow: Input -> Guitar Effects -> Standard Effects -> Output

import { TrackEffectsProcessor } from './track-effects-processor';
import { GuitarEffectsProcessor, DEFAULT_GUITAR_EFFECTS } from './guitar';
import type {
  TrackEffectsChain,
  GuitarEffectsChain,
  GuitarEffectPreset,
} from '@/types';

export interface ExtendedEffectsSettings {
  standardEffects: TrackEffectsChain;
  guitarEffects: GuitarEffectsChain;
  isGuitarMode: boolean;
}

export class ExtendedTrackEffectsProcessor {
  private audioContext: AudioContext;
  private inputGain: GainNode;
  private outputGain: GainNode;

  // Effect chains
  private guitarEffects: GuitarEffectsProcessor;
  private standardEffects: TrackEffectsProcessor;

  // Bypass for non-guitar mode
  private guitarBypassGain: GainNode;

  private isGuitarMode: boolean = false;
  private onSettingsChange?: (settings: ExtendedEffectsSettings) => void;

  constructor(
    audioContext: AudioContext,
    initialSettings?: Partial<ExtendedEffectsSettings>,
    onSettingsChange?: (settings: ExtendedEffectsSettings) => void
  ) {
    this.audioContext = audioContext;
    this.onSettingsChange = onSettingsChange;
    this.isGuitarMode = initialSettings?.isGuitarMode ?? false;

    // Create input/output nodes
    this.inputGain = audioContext.createGain();
    this.outputGain = audioContext.createGain();

    // Create bypass for guitar effects
    this.guitarBypassGain = audioContext.createGain();

    // Create guitar effects processor
    this.guitarEffects = new GuitarEffectsProcessor(
      audioContext,
      initialSettings?.guitarEffects,
      () => this.notifySettingsChange()
    );

    // Create standard effects processor
    this.standardEffects = new TrackEffectsProcessor(
      audioContext,
      initialSettings?.standardEffects,
      () => this.notifySettingsChange()
    );

    // Wire up the signal chain
    // When guitar mode is active:
    //   input -> guitarEffects -> standardEffects -> output
    // When guitar mode is bypassed:
    //   input -> standardEffects -> output

    // Guitar effects path
    this.inputGain.connect(this.guitarEffects.getInputNode());
    this.guitarEffects.connect(this.standardEffects.getInputNode());

    // Bypass path
    this.inputGain.connect(this.guitarBypassGain);
    this.guitarBypassGain.connect(this.standardEffects.getInputNode());

    // Standard effects to output
    this.standardEffects.connect(this.outputGain);

    // Set initial mode
    this.setGuitarMode(this.isGuitarMode);
  }

  /**
   * Enable/disable guitar effects processing
   */
  setGuitarMode(enabled: boolean): void {
    this.isGuitarMode = enabled;
    const now = this.audioContext.currentTime;

    if (enabled) {
      // Enable guitar effects, disable bypass
      this.guitarBypassGain.gain.setTargetAtTime(0, now, 0.02);
      // Guitar effects output is controlled by individual effect enables
    } else {
      // Disable guitar effects, enable bypass
      this.guitarBypassGain.gain.setTargetAtTime(1, now, 0.02);
    }

    this.notifySettingsChange();
  }

  /**
   * Get current guitar mode state
   */
  getGuitarMode(): boolean {
    return this.isGuitarMode;
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

  // Guitar effects methods
  getGuitarEffectsProcessor(): GuitarEffectsProcessor {
    return this.guitarEffects;
  }

  updateGuitarEffects(settings: Partial<GuitarEffectsChain>): void {
    this.guitarEffects.updateSettings(settings);
  }

  loadGuitarPreset(preset: GuitarEffectPreset): void {
    this.guitarEffects.loadPreset(preset.effects);
    // Auto-enable guitar mode when loading a preset
    if (!this.isGuitarMode) {
      this.setGuitarMode(true);
    }
  }

  // Standard effects methods
  getStandardEffectsProcessor(): TrackEffectsProcessor {
    return this.standardEffects;
  }

  updateStandardEffects(settings: Partial<TrackEffectsChain>): void {
    this.standardEffects.updateSettings(settings);
  }

  // Combined settings
  getSettings(): ExtendedEffectsSettings {
    return {
      standardEffects: this.standardEffects.getSettings(),
      guitarEffects: this.guitarEffects.getSettings(),
      isGuitarMode: this.isGuitarMode,
    };
  }

  updateSettings(settings: Partial<ExtendedEffectsSettings>): void {
    if (settings.standardEffects) {
      this.standardEffects.updateSettings(settings.standardEffects);
    }
    if (settings.guitarEffects) {
      this.guitarEffects.updateSettings(settings.guitarEffects);
    }
    if (settings.isGuitarMode !== undefined) {
      this.setGuitarMode(settings.isGuitarMode);
    }
  }

  // Set tempo for tempo-synced effects
  setTempo(bpm: number): void {
    this.guitarEffects.setTempo(bpm);
  }

  // Get metering data
  getMeteringData() {
    return {
      standard: this.standardEffects.getMeteringData(),
      guitarEnabledEffects: this.guitarEffects.getEnabledEffects(),
    };
  }

  // Reset
  reset(): void {
    this.guitarEffects.reset();
    this.standardEffects.reset();
    this.setGuitarMode(false);
  }

  private notifySettingsChange(): void {
    this.onSettingsChange?.(this.getSettings());
  }

  dispose(): void {
    this.disconnect();
    this.guitarEffects.dispose();
    this.standardEffects.dispose();
    this.inputGain.disconnect();
    this.guitarBypassGain.disconnect();
  }
}
