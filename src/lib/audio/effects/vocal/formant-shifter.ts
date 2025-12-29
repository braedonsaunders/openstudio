// Formant Shifter Effect Processor
// Shift vocal formants independently of pitch
// Creates voice character changes without changing pitch

import { BaseEffect } from '../base-effect';
import type { FormantShifterSettings } from '@/types';

export class FormantShifterProcessor extends BaseEffect {
  readonly name = 'Formant Shifter';

  private settings: FormantShifterSettings;

  // Formant filter bank (cascade of bandpass filters)
  private formantFilters: BiquadFilterNode[] = [];
  private formantGains: GainNode[] = [];

  // Typical formant frequencies for human voice
  // F1: 270-800 Hz, F2: 600-2700 Hz, F3: 1300-3500 Hz, F4: 2500-4500 Hz
  private baseFormants = [400, 1200, 2400, 3400];
  private formantBandwidths = [80, 120, 150, 200];

  // Mixing
  private dryGain: GainNode;
  private wetMasterGain: GainNode;

  // Anti-aliasing filter
  private lowPass: BiquadFilterNode;

  constructor(audioContext: AudioContext, settings?: Partial<FormantShifterSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      shift: 0, // -12 to +12 semitones
      gender: 0, // -100 to +100 (male to female character)
      preservePitch: true,
      mix: 100,
      ...settings,
    };

    // Create formant filter bank with safe initial values
    for (let i = 0; i < this.baseFormants.length; i++) {
      const filter = audioContext.createBiquadFilter();
      filter.type = 'bandpass';
      // Clamp frequency to safe range
      filter.frequency.value = Math.max(20, Math.min(20000, this.baseFormants[i]));
      // Clamp Q to safe range (0.0001-30)
      const q = this.baseFormants[i] / this.formantBandwidths[i];
      filter.Q.value = Math.max(0.0001, Math.min(30, q));
      this.formantFilters.push(filter);
      this.registerFilter(filter);

      const gain = audioContext.createGain();
      gain.gain.value = 1;
      this.formantGains.push(gain);
    }

    // Create dry/wet mixing
    this.dryGain = audioContext.createGain();
    this.wetMasterGain = audioContext.createGain();

    // Anti-aliasing low pass
    this.lowPass = audioContext.createBiquadFilter();
    this.lowPass.type = 'lowpass';
    this.lowPass.frequency.value = 10000;
    this.lowPass.Q.value = 0.7;
    this.registerFilter(this.lowPass);

    // Wire up signal chain
    // CRITICAL: Use getWetPathInput() to prevent filter instability when disabled
    // Dry path (goes through wetPathGate for proper bypass)
    this.getWetPathInput().connect(this.dryGain);
    this.dryGain.connect(this.wetGain);

    // Wet path - parallel formant filters
    for (let i = 0; i < this.formantFilters.length; i++) {
      this.getWetPathInput().connect(this.formantFilters[i]);
      this.formantFilters[i].connect(this.formantGains[i]);
      this.formantGains[i].connect(this.wetMasterGain);
    }

    this.wetMasterGain.connect(this.lowPass);
    this.lowPass.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Apply initial settings
    this.updateFormants();
    this.updateMix();
  }

  private updateFormants(): void {
    try {
      // Calculate shift ratio from semitones
      const shiftRatio = Math.pow(2, this.settings.shift / 12);

      // Gender affects formant spacing
      // Male voices have lower, more spaced formants
      // Female voices have higher, closer formants
      const genderShift = this.settings.gender / 100;
      const genderRatio = 1 + genderShift * 0.3; // ±30% frequency shift

      for (let i = 0; i < this.formantFilters.length; i++) {
        // Apply both shift and gender transformation
        const newFreq = this.baseFormants[i] * shiftRatio * genderRatio;

        // Use safe filter methods
        this.safeSetFilterFrequency(this.formantFilters[i], newFreq);

        // Adjust bandwidth based on frequency
        const clampedFreq = Math.max(20, Math.min(20000, newFreq));
        const newQ = clampedFreq / (this.formantBandwidths[i] * genderRatio);
        this.safeSetFilterQ(this.formantFilters[i], newQ);

        // Higher formants get progressively lower gain for natural sound
        const gainCompensation = 1 - (i * 0.15);
        const now = this.audioContext.currentTime;
        this.formantGains[i].gain.setTargetAtTime(gainCompensation, now, 0.02);
      }
    } catch (e) {
      console.warn('[Formant Shifter] Error updating formants:', e);
    }
  }

  private updateMix(): void {
    const now = this.audioContext.currentTime;
    const mix = this.settings.mix / 100;

    // Equal power crossfade
    this.dryGain.gain.setTargetAtTime(Math.sqrt(1 - mix), now, 0.01);
    this.wetMasterGain.gain.setTargetAtTime(Math.sqrt(mix) * 0.8, now, 0.01); // Slight reduction for summing
  }

  updateSettings(settings: Partial<FormantShifterSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.shift !== undefined || settings.gender !== undefined) {
      this.updateFormants();
    }

    if (settings.mix !== undefined) {
      this.updateMix();
    }
  }

  getSettings(): FormantShifterSettings {
    return { ...this.settings };
  }

  dispose(): void {
    for (const filter of this.formantFilters) {
      filter.disconnect();
    }
    for (const gain of this.formantGains) {
      gain.disconnect();
    }
    this.dryGain.disconnect();
    this.wetMasterGain.disconnect();
    this.lowPass.disconnect();
    super.dispose();
  }
}
