// Ring Modulator Effect Processor
// Carrier frequency multiplication for metallic/robotic tones
// Zero additional latency - uses native oscillator multiplication

import { BaseEffect } from '../base-effect';
import type { RingModulatorSettings } from '@/types';

export class RingModulatorProcessor extends BaseEffect {
  readonly name = 'Ring Modulator';

  private settings: RingModulatorSettings;

  // Carrier oscillator
  private carrier: OscillatorNode;
  private carrierGain: GainNode;

  // Ring modulation is achieved by multiplying input with carrier
  // In Web Audio, we use a gain node with the carrier as gain modulator

  // Dry/wet mixing
  private dryGain: GainNode;
  private modGain: GainNode;

  // Envelope follower for FM (optional)
  private envelopeFilter: BiquadFilterNode;

  constructor(audioContext: AudioContext, settings?: Partial<RingModulatorSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      frequency: 440, // Hz (20-5000)
      waveform: 'sine', // sine, square, triangle, sawtooth
      mix: 50, // 0-100
      lfoRate: 0, // 0-10 Hz (0 = no LFO)
      lfoDepth: 0, // 0-100
      ...settings,
    };

    // Create carrier oscillator
    this.carrier = audioContext.createOscillator();
    this.carrier.type = this.settings.waveform;
    this.carrier.frequency.value = this.settings.frequency;

    // Carrier gain (the modulator)
    this.carrierGain = audioContext.createGain();
    this.carrierGain.gain.value = 0; // Will be modulated by input

    // Connect carrier to gain control
    this.carrier.connect(this.carrierGain.gain);

    // Dry/wet
    this.dryGain = audioContext.createGain();
    this.modGain = audioContext.createGain();

    // Envelope follower for carrier AM
    this.envelopeFilter = audioContext.createBiquadFilter();
    this.envelopeFilter.type = 'lowpass';
    this.envelopeFilter.frequency.value = 50;

    // Wire up signal chain
    // Dry path
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.wetGain);

    // Ring modulation path
    // Input goes through carrierGain which is modulated by carrier oscillator
    this.inputGain.connect(this.carrierGain);
    this.carrierGain.connect(this.modGain);
    this.modGain.connect(this.wetGain);

    this.wetGain.connect(this.outputGain);

    // Start carrier
    this.carrier.start();

    // Apply initial settings
    this.updateFrequency();
    this.updateMix();
  }

  private updateFrequency(): void {
    const now = this.audioContext.currentTime;
    this.carrier.frequency.setTargetAtTime(this.settings.frequency, now, 0.01);
  }

  private updateWaveform(): void {
    this.carrier.type = this.settings.waveform;
  }

  private updateMix(): void {
    const now = this.audioContext.currentTime;
    const mix = this.settings.mix / 100;

    // Equal power crossfade
    this.dryGain.gain.setTargetAtTime(Math.sqrt(1 - mix), now, 0.01);
    this.modGain.gain.setTargetAtTime(Math.sqrt(mix), now, 0.01);
  }

  updateSettings(settings: Partial<RingModulatorSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.frequency !== undefined) {
      this.updateFrequency();
    }

    if (settings.waveform !== undefined) {
      this.updateWaveform();
    }

    if (settings.mix !== undefined) {
      this.updateMix();
    }
  }

  getSettings(): RingModulatorSettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.carrier.stop();
    this.carrier.disconnect();
    this.carrierGain.disconnect();
    this.dryGain.disconnect();
    this.modGain.disconnect();
    this.envelopeFilter.disconnect();
    super.dispose();
  }
}
