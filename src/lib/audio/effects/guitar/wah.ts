// Wah Effect Processor
// Classic wah-wah pedal with manual, auto, and envelope follower modes
// Based on Tone.js AutoWah with additional features

import { BaseEffect } from '../base-effect';
import type { WahSettings } from '@/types';

export type WahMode = 'manual' | 'auto' | 'envelope';

export class WahProcessor extends BaseEffect {
  readonly name = 'Wah';

  // Bandpass filter for wah effect
  private wahFilter: BiquadFilterNode;

  // LFO for auto mode
  private lfo: OscillatorNode;
  private lfoGain: GainNode;

  // Envelope follower components
  private envelopeInput: GainNode;
  private envelopeRectifier: WaveShaperNode;
  private envelopeSmoother: BiquadFilterNode;
  private envelopeGain: GainNode;

  // Base frequency control
  private baseFrequencySource: ConstantSourceNode;
  private baseFrequencyGain: GainNode;

  // Manual control (AudioParam simulation)
  private manualFrequencyGain: GainNode;

  // Q control
  private qControl: BiquadFilterNode;

  private settings: WahSettings;
  private animationFrameId: number | null = null;
  private manualPosition: number = 0.5;

  constructor(audioContext: AudioContext, settings?: Partial<WahSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      mode: 'auto', // 'manual' | 'auto' | 'envelope'
      frequency: 0.5, // Manual position 0-1 (heel to toe)
      rate: 2, // LFO rate for auto mode (0.1 - 10)
      depth: 0.8, // Sweep depth 0-1
      baseFrequency: 350, // Minimum frequency Hz
      maxFrequency: 2500, // Maximum frequency Hz
      q: 5, // Filter Q / resonance (1 - 20)
      sensitivity: 0.5, // Envelope sensitivity 0-1
      attack: 0.05, // Envelope attack in seconds
      release: 0.2, // Envelope release in seconds
      mix: 1, // Usually 100% wet for wah
      ...settings,
    };

    // Create wah bandpass filter
    this.wahFilter = audioContext.createBiquadFilter();
    this.wahFilter.type = 'bandpass';
    this.registerFilter(this.wahFilter);

    // Create LFO for auto mode
    this.lfo = audioContext.createOscillator();
    this.lfoGain = audioContext.createGain();

    // Create envelope follower
    this.envelopeInput = audioContext.createGain();
    this.envelopeRectifier = audioContext.createWaveShaper();
    this.envelopeSmoother = audioContext.createBiquadFilter();
    this.registerFilter(this.envelopeSmoother);
    this.envelopeGain = audioContext.createGain();

    // Create base frequency control
    this.baseFrequencySource = audioContext.createConstantSource();
    this.baseFrequencyGain = audioContext.createGain();

    // Create manual frequency control
    this.manualFrequencyGain = audioContext.createGain();

    // Create Q control filter (unused, just for storage)
    this.qControl = audioContext.createBiquadFilter();

    // Configure wah filter
    this.wahFilter.Q.value = this.settings.q;

    // Configure LFO
    this.lfo.type = 'sine';

    // Configure envelope rectifier (absolute value)
    this.envelopeRectifier.curve = this.createRectifierCurve();
    this.envelopeRectifier.oversample = '4x';

    // Configure envelope smoother (lowpass)
    this.envelopeSmoother.type = 'lowpass';
    this.envelopeSmoother.Q.value = 0.7;

    // Wire up the signal chain
    this.wireUpSignalChain();

    // Start oscillators
    this.lfo.start();
    this.baseFrequencySource.start();

    // Initialize filter to safe state first
    this.wahFilter.frequency.value = 1000; // Safe default

    // Apply initial settings
    this.updateRate();
    this.updateQ();
    this.updateEnvelopeSettings();

    // Only connect modulation if enabled
    if (this.settings.enabled) {
      this.connectModulation();
      this.updateMode();
      this.updateDepth();
    } else {
      // Keep gains at zero when disabled
      this.lfoGain.gain.value = 0;
      this.envelopeGain.gain.value = 0;
      this.baseFrequencyGain.gain.value = 0;
    }
  }

  private createRectifierCurve(): Float32Array<ArrayBuffer> {
    const samples = 256;
    const buffer = new ArrayBuffer(samples * 4);
    const curve = new Float32Array(buffer);

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      // Full wave rectification (absolute value)
      curve[i] = Math.abs(x);
    }

    return curve;
  }

  private wireUpSignalChain(): void {
    // Main audio path - start from wetPathGate to allow disabling
    // When effect is disabled, wetPathGate blocks audio from entering filter chain
    this.getWetPathInput().connect(this.wahFilter);
    this.wahFilter.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Bypass path (using base class - already connected in base constructor)
    // this.inputGain.connect(this.bypassGain) is done in base class
    // this.bypassGain.connect(this.outputGain) is done in base class

    // Frequency control sources (internal connections only)
    this.baseFrequencySource.connect(this.baseFrequencyGain);
    this.lfo.connect(this.lfoGain);

    // Envelope follower path (internal connections only) - also gated
    this.getWetPathInput().connect(this.envelopeInput);
    this.envelopeInput.connect(this.envelopeRectifier);
    this.envelopeRectifier.connect(this.envelopeSmoother);
    this.envelopeSmoother.connect(this.envelopeGain);

    // NOTE: We do NOT connect modulation to wahFilter.frequency here.
    // Modulation connections are managed by setEnabled() to prevent
    // BiquadFilterNode instability when the effect is disabled.
  }

  // Connect all modulation sources to filter.frequency
  private connectModulation(): void {
    this.baseFrequencyGain.connect(this.wahFilter.frequency);
    this.lfoGain.connect(this.wahFilter.frequency);
    this.envelopeGain.connect(this.wahFilter.frequency);
  }

  // Disconnect all modulation sources from filter.frequency
  private disconnectModulation(): void {
    try {
      this.baseFrequencyGain.disconnect(this.wahFilter.frequency);
    } catch { /* already disconnected */ }
    try {
      this.lfoGain.disconnect(this.wahFilter.frequency);
    } catch { /* already disconnected */ }
    try {
      this.envelopeGain.disconnect(this.wahFilter.frequency);
    } catch { /* already disconnected */ }
  }

  private updateMode(): void {
    const now = this.audioContext.currentTime;

    // Disable all frequency modulation sources first
    this.lfoGain.gain.setTargetAtTime(0, now, 0.01);
    this.envelopeGain.gain.setTargetAtTime(0, now, 0.01);

    switch (this.settings.mode) {
      case 'manual':
        // Set base frequency from manual position
        this.updateManualPosition();
        break;

      case 'auto':
        // Enable LFO
        this.updateRate();
        this.updateDepth();
        break;

      case 'envelope':
        // Enable envelope follower
        this.updateEnvelopeSettings();
        this.updateDepth();
        break;
    }
  }

  private updateManualPosition(): void {
    const now = this.audioContext.currentTime;

    // Map 0-1 to frequency range
    const freqRange = this.settings.maxFrequency - this.settings.baseFrequency;
    const targetFreq = this.settings.baseFrequency + this.settings.frequency * freqRange;

    this.baseFrequencyGain.gain.setTargetAtTime(targetFreq, now, 0.02);
    this.baseFrequencySource.offset.setTargetAtTime(1, now, 0.01);
  }

  private updateRate(): void {
    const now = this.audioContext.currentTime;
    this.lfo.frequency.setTargetAtTime(this.settings.rate, now, 0.01);
  }

  private updateDepth(): void {
    const now = this.audioContext.currentTime;
    const freqRange = this.settings.maxFrequency - this.settings.baseFrequency;
    const depthHz = freqRange * this.settings.depth;

    if (this.settings.mode === 'auto') {
      // Set base to center of range and LFO depth to sweep
      const centerFreq = this.settings.baseFrequency + freqRange / 2;
      this.baseFrequencyGain.gain.setTargetAtTime(centerFreq, now, 0.01);
      this.baseFrequencySource.offset.setTargetAtTime(1, now, 0.01);
      this.lfoGain.gain.setTargetAtTime(depthHz / 2, now, 0.01);
    } else if (this.settings.mode === 'envelope') {
      // Set base to minimum and envelope controls sweep up
      this.baseFrequencyGain.gain.setTargetAtTime(this.settings.baseFrequency, now, 0.01);
      this.baseFrequencySource.offset.setTargetAtTime(1, now, 0.01);
      this.envelopeGain.gain.setTargetAtTime(depthHz * this.settings.sensitivity, now, 0.01);
    }
  }

  private updateQ(): void {
    this.safeSetFilterQ(this.wahFilter, this.settings.q);
  }

  private updateEnvelopeSettings(): void {
    const now = this.audioContext.currentTime;

    // Input sensitivity
    this.envelopeInput.gain.setTargetAtTime(this.settings.sensitivity * 2, now, 0.01);

    // Attack/release via smoother frequency
    // Faster attack = higher frequency, slower release = lower frequency
    // We use a compromise based on release time
    const smootherFreq = Math.max(0.1, 1 / Math.max(0.01, this.settings.release));
    this.safeSetFilterFrequency(this.envelopeSmoother, smootherFreq);
  }

  // Override setEnabled to completely disconnect modulation when disabled
  // This prevents BiquadFilterNode instability from audio-rate parameter automation
  setEnabled(enabled: boolean): void {
    super.setEnabled(enabled);
    const now = this.audioContext.currentTime;

    if (!enabled) {
      // CRITICAL: Zero the gains IMMEDIATELY before disconnecting
      // This prevents any residual modulation from causing instability during disconnect
      this.zeroGainImmediate(this.lfoGain);
      this.zeroGainImmediate(this.envelopeGain);
      this.zeroGainImmediate(this.baseFrequencyGain);

      // CRITICAL: Disconnect ALL modulation sources from filter.frequency
      this.disconnectModulation();

      // Reset filter to a safe, stable state (now uses smooth transition)
      this.resetFilter(this.wahFilter);
    } else {
      // CRITICAL: Zero all modulation gains BEFORE connecting
      // This prevents stale gain values from pushing the filter to unstable frequencies
      this.zeroGainImmediate(this.lfoGain);
      this.zeroGainImmediate(this.envelopeGain);
      this.zeroGainImmediate(this.baseFrequencyGain);

      // Prepare filter for modulation
      this.prepareFilterForModulation(this.wahFilter);

      // Reconnect modulation sources to filter (gains are zeroed, so this is safe)
      this.connectModulation();

      // Now restore modulation - gains will ramp up smoothly via setTargetAtTime
      this.updateMode();
    }
  }

  /**
   * Set the manual wah position (0 = heel, 1 = toe)
   */
  setPosition(position: number): void {
    this.settings.frequency = Math.max(0, Math.min(1, position));
    if (this.settings.mode === 'manual') {
      this.updateManualPosition();
    }
  }

  updateSettings(settings: Partial<WahSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.mode !== undefined) {
      this.updateMode();
    }

    if (settings.frequency !== undefined && this.settings.mode === 'manual') {
      this.updateManualPosition();
    }

    if (settings.rate !== undefined) {
      this.updateRate();
    }

    if (settings.depth !== undefined || settings.sensitivity !== undefined) {
      this.updateDepth();
    }

    if (settings.q !== undefined) {
      this.updateQ();
    }

    if (
      settings.sensitivity !== undefined ||
      settings.attack !== undefined ||
      settings.release !== undefined
    ) {
      this.updateEnvelopeSettings();
    }
  }

  getSettings(): WahSettings {
    return { ...this.settings };
  }

  dispose(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.lfo.stop();
    this.baseFrequencySource.stop();
    this.lfo.disconnect();
    this.lfoGain.disconnect();
    this.wahFilter.disconnect();
    this.envelopeInput.disconnect();
    this.envelopeRectifier.disconnect();
    this.envelopeSmoother.disconnect();
    this.envelopeGain.disconnect();
    this.baseFrequencySource.disconnect();
    this.baseFrequencyGain.disconnect();
    this.manualFrequencyGain.disconnect();
    super.dispose();
  }
}
