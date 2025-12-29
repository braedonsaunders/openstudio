// Overdrive Effect Processor
// Soft clipping distortion that emulates tube amplifier saturation
// Algorithm inspired by Tone.js and classic tube amp circuits

import { BaseEffect } from '../base-effect';
import type { OverdriveSettings } from '@/types';

export class OverdriveProcessor extends BaseEffect {
  readonly name = 'Overdrive';
  private waveshaper: WaveShaperNode;
  private preGain: GainNode;
  private postGain: GainNode;
  private toneFilter: BiquadFilterNode;
  private settings: OverdriveSettings;

  constructor(audioContext: AudioContext, settings?: Partial<OverdriveSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      drive: 0.5, // 0-1 range
      tone: 0.5, // 0-1, controls high frequency content
      level: 0.5, // 0-1, output level
      ...settings,
    };

    // Create nodes
    this.waveshaper = audioContext.createWaveShaper();
    this.preGain = audioContext.createGain();
    this.postGain = audioContext.createGain();
    this.toneFilter = audioContext.createBiquadFilter();

    // Configure tone filter (low-pass to tame harsh highs)
    this.toneFilter.type = 'lowpass';
    this.toneFilter.Q.value = 0.7;
    this.registerFilter(this.toneFilter);

    // Set oversample for better quality (reduces aliasing)
    this.waveshaper.oversample = '4x';

    // Wire up: input -> preGain -> waveshaper -> toneFilter -> postGain -> wetGain -> output
    // CRITICAL: Use getWetPathInput() to prevent filter instability when disabled
    this.getWetPathInput().connect(this.preGain);
    this.preGain.connect(this.waveshaper);
    this.waveshaper.connect(this.toneFilter);
    this.toneFilter.connect(this.postGain);
    this.postGain.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Apply initial settings
    this.updateDrive();
    this.updateTone();
    this.updateLevel();
  }

  /**
   * Generate soft clipping curve for tube-like overdrive
   * Uses a tanh-based curve for smooth, musical saturation
   */
  private generateOverdriveCurve(drive: number): Float32Array<ArrayBuffer> {
    const samples = 8192;
    const buffer = new ArrayBuffer(samples * 4);
    const curve = new Float32Array(buffer);

    // Map drive 0-1 to actual gain factor
    // Low drive = 1, high drive = 50 (like real amp preamp)
    const k = 1 + drive * 49;

    for (let i = 0; i < samples; i++) {
      // Map sample index to -1 to 1 range
      const x = (i * 2) / samples - 1;

      // Soft clipping using tanh (tube-like saturation)
      // tanh naturally provides smooth saturation
      curve[i] = Math.tanh(k * x) / Math.tanh(k);
    }

    return curve;
  }

  private updateDrive(): void {
    this.waveshaper.curve = this.generateOverdriveCurve(this.settings.drive);

    // Adjust pre-gain based on drive to maintain consistent perceived loudness
    const preGainValue = 1 + this.settings.drive * 2;
    const now = this.audioContext.currentTime;
    this.preGain.gain.setTargetAtTime(preGainValue, now, 0.01);
  }

  private updateTone(): void {
    // Map tone 0-1 to frequency 800Hz - 8000Hz
    const frequency = 800 + this.settings.tone * 7200;
    this.safeSetFilterFrequency(this.toneFilter, frequency);
  }

  private updateLevel(): void {
    // Compensate for increased gain from drive
    const compensation = 1 / (1 + this.settings.drive);
    const level = this.settings.level * compensation;
    const now = this.audioContext.currentTime;
    this.postGain.gain.setTargetAtTime(level, now, 0.01);
  }

  updateSettings(settings: Partial<OverdriveSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.drive !== undefined) {
      this.updateDrive();
      this.updateLevel(); // Level compensation depends on drive
    }

    if (settings.tone !== undefined) {
      this.updateTone();
    }

    if (settings.level !== undefined) {
      this.updateLevel();
    }
  }

  getSettings(): OverdriveSettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.waveshaper.disconnect();
    this.preGain.disconnect();
    this.postGain.disconnect();
    this.toneFilter.disconnect();
    super.dispose();
  }
}
