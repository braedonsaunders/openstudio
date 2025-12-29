// Phaser Effect Processor
// Classic phaser using cascaded allpass filters with LFO modulation
// Based on Tone.js Phaser algorithm

import { BaseEffect } from '../base-effect';
import type { PhaserSettings } from '@/types';

export class PhaserProcessor extends BaseEffect {
  readonly name = 'Phaser';

  // Allpass filter stages
  private allpassFilters: BiquadFilterNode[];

  // LFO for modulation
  private lfo: OscillatorNode;
  private lfoGain: GainNode;

  // Frequency control - constant source for base frequency
  private baseFrequencySource: ConstantSourceNode;
  private baseFrequencyGain: GainNode;

  // Mixing
  private phaserWetGain: GainNode;
  private phaserDryGain: GainNode;

  // Feedback for resonance
  private feedbackGain: GainNode;

  private settings: PhaserSettings;

  constructor(audioContext: AudioContext, settings?: Partial<PhaserSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      rate: 0.5, // LFO rate in Hz (0.1 - 8)
      depth: 0.5, // Modulation depth 0-1
      baseFrequency: 350, // Center frequency in Hz (100 - 4000)
      octaves: 3, // Range of sweep in octaves (0.5 - 6)
      stages: 4, // Number of allpass stages (2, 4, 6, 8, 10, 12)
      feedback: 0.3, // Feedback for resonance 0-1
      q: 1, // Filter Q (0.1 - 10)
      mix: 0.5, // Wet/dry mix 0-1
      ...settings,
    };

    // Create allpass filter stages
    this.allpassFilters = [];
    for (let i = 0; i < 12; i++) {
      const filter = audioContext.createBiquadFilter();
      filter.type = 'allpass';
      filter.Q.value = this.settings.q;
      this.allpassFilters.push(filter);
      // Register filter for recovery tracking
      this.registerFilter(filter);
    }

    // Create LFO
    this.lfo = audioContext.createOscillator();
    this.lfoGain = audioContext.createGain();

    // Create base frequency source
    this.baseFrequencySource = audioContext.createConstantSource();
    this.baseFrequencyGain = audioContext.createGain();

    // Create feedback
    this.feedbackGain = audioContext.createGain();

    // Create mix controls
    this.phaserWetGain = audioContext.createGain();
    this.phaserDryGain = audioContext.createGain();

    // Configure LFO
    this.lfo.type = 'sine';

    // Wire up the signal chain
    this.wireUpSignalChain();

    // Start oscillators
    this.lfo.start();
    this.baseFrequencySource.start();

    // Apply initial settings
    this.updateRate();
    this.updateStages();
    this.updateFeedback();
    this.updateQ();
    this.updateMix();

    // Initialize filters to safe state first
    for (const filter of this.allpassFilters) {
      filter.frequency.value = 1000; // Safe default
    }

    // Only connect modulation and set values if enabled
    if (this.settings.enabled) {
      // Connect modulation to all filters
      for (const filter of this.allpassFilters) {
        this.baseFrequencyGain.connect(filter.frequency);
        this.lfoGain.connect(filter.frequency);
      }
      this.updateBaseFrequency();
      this.updateDepth();
    } else {
      // Keep gains at zero when disabled
      this.lfoGain.gain.value = 0;
      this.baseFrequencyGain.gain.value = 0;
    }
  }

  private wireUpSignalChain(): void {
    // Dry path
    this.inputGain.connect(this.phaserDryGain);
    this.phaserDryGain.connect(this.outputGain);

    // Wet path through allpass cascade
    let currentNode: AudioNode = this.inputGain;

    // Connect the active stages
    for (let i = 0; i < this.settings.stages; i++) {
      currentNode.connect(this.allpassFilters[i]);
      currentNode = this.allpassFilters[i];
    }

    // Last stage to wet output
    currentNode.connect(this.phaserWetGain);

    // Feedback from last active stage back to first
    currentNode.connect(this.feedbackGain);
    this.feedbackGain.connect(this.allpassFilters[0]);

    // LFO modulates all filter frequencies
    // Base frequency + LFO depth
    this.baseFrequencySource.connect(this.baseFrequencyGain);
    this.lfo.connect(this.lfoGain);

    // NOTE: We do NOT connect modulation to filter.frequency here.
    // Modulation connections are managed by setEnabled() to prevent
    // BiquadFilterNode instability when the effect is disabled.

    // Wet to output through base class wetGain
    this.phaserWetGain.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);
  }

  private rewireStages(): void {
    // Disconnect all current connections from input
    for (const filter of this.allpassFilters) {
      try {
        filter.disconnect();
      } catch {
        // Ignore if not connected
      }
    }

    // Reconnect based on current stage count
    let currentNode: AudioNode = this.inputGain;

    for (let i = 0; i < this.settings.stages; i++) {
      currentNode.connect(this.allpassFilters[i]);
      currentNode = this.allpassFilters[i];
    }

    // Last stage to outputs
    currentNode.connect(this.phaserWetGain);
    currentNode.connect(this.feedbackGain);
  }

  private updateRate(): void {
    const now = this.audioContext.currentTime;
    this.lfo.frequency.setTargetAtTime(this.settings.rate, now, 0.01);
  }

  private updateDepth(): void {
    const now = this.audioContext.currentTime;
    // Depth controls the range of the sweep
    // We sweep from baseFrequency to baseFrequency * 2^octaves
    const maxFreq = this.settings.baseFrequency * Math.pow(2, this.settings.octaves);
    const freqRange = (maxFreq - this.settings.baseFrequency) * this.settings.depth;

    this.lfoGain.gain.setTargetAtTime(freqRange, now, 0.01);
  }

  private updateBaseFrequency(): void {
    const now = this.audioContext.currentTime;
    // Add half the range to center the sweep
    const maxFreq = this.settings.baseFrequency * Math.pow(2, this.settings.octaves);
    const centerFreq = (this.settings.baseFrequency + maxFreq) / 2;

    this.baseFrequencyGain.gain.setTargetAtTime(centerFreq, now, 0.01);
    this.baseFrequencySource.offset.setTargetAtTime(1, now, 0.01);

    // Update depth since it depends on base frequency
    this.updateDepth();
  }

  private updateStages(): void {
    // Ensure stages is even and within range
    this.settings.stages = Math.max(2, Math.min(12, Math.round(this.settings.stages / 2) * 2));

    this.rewireStages();
  }

  private updateFeedback(): void {
    const now = this.audioContext.currentTime;
    // Limit feedback to prevent oscillation
    const feedback = Math.min(this.settings.feedback, 0.95);
    this.feedbackGain.gain.setTargetAtTime(feedback, now, 0.01);
  }

  private updateQ(): void {
    for (const filter of this.allpassFilters) {
      this.safeSetFilterQ(filter, this.settings.q);
    }
  }

  private updateMix(): void {
    const now = this.audioContext.currentTime;

    // Equal power crossfade
    const wet = Math.sqrt(this.settings.mix);
    const dry = Math.sqrt(1 - this.settings.mix);

    this.phaserWetGain.gain.setTargetAtTime(wet, now, 0.01);
    this.phaserDryGain.gain.setTargetAtTime(dry, now, 0.01);
  }

  updateSettings(settings: Partial<PhaserSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.rate !== undefined) {
      this.updateRate();
    }

    if (settings.depth !== undefined) {
      this.updateDepth();
    }

    if (settings.baseFrequency !== undefined || settings.octaves !== undefined) {
      this.updateBaseFrequency();
    }

    if (settings.stages !== undefined) {
      this.updateStages();
    }

    if (settings.feedback !== undefined) {
      this.updateFeedback();
    }

    if (settings.q !== undefined) {
      this.updateQ();
    }

    if (settings.mix !== undefined) {
      this.updateMix();
    }
  }

  getSettings(): PhaserSettings {
    return { ...this.settings };
  }

  // Override setEnabled to completely disconnect modulation when disabled
  // This prevents BiquadFilterNode instability from audio-rate parameter automation
  setEnabled(enabled: boolean): void {
    super.setEnabled(enabled);

    if (!enabled) {
      // CRITICAL: Zero the gains IMMEDIATELY before disconnecting
      // This prevents any residual modulation from causing instability during disconnect
      this.zeroGainImmediate(this.lfoGain);
      this.zeroGainImmediate(this.baseFrequencyGain);

      // CRITICAL: Disconnect ALL modulation sources from filter.frequency
      // Just zeroing the gain is not enough - the connected oscillators can still
      // cause filter instability even at very low amplitudes
      try {
        this.lfoGain.disconnect();
        this.baseFrequencyGain.disconnect();
      } catch {
        // Ignore if already disconnected
      }

      // Reset all filters to a safe, stable state (now uses smooth transition)
      for (const filter of this.allpassFilters) {
        this.resetFilter(filter);
      }
    } else {
      // CRITICAL: Zero all modulation gains BEFORE connecting
      // This prevents stale gain values from pushing the filter to unstable frequencies
      this.zeroGainImmediate(this.lfoGain);
      this.zeroGainImmediate(this.baseFrequencyGain);

      // Prepare all filters for modulation
      for (const filter of this.allpassFilters) {
        this.prepareFilterForModulation(filter);
      }

      // Reconnect modulation sources to all filters (gains are zeroed, so this is safe)
      for (const filter of this.allpassFilters) {
        this.baseFrequencyGain.connect(filter.frequency);
        this.lfoGain.connect(filter.frequency);
      }

      // Now restore modulation values - gains will ramp up smoothly via setTargetAtTime
      this.updateBaseFrequency();
      this.updateDepth();
    }
  }

  dispose(): void {
    this.lfo.stop();
    this.baseFrequencySource.stop();
    this.lfo.disconnect();
    this.lfoGain.disconnect();
    this.baseFrequencySource.disconnect();
    this.baseFrequencyGain.disconnect();
    for (const filter of this.allpassFilters) {
      filter.disconnect();
    }
    this.feedbackGain.disconnect();
    this.phaserWetGain.disconnect();
    this.phaserDryGain.disconnect();
    super.dispose();
  }
}
