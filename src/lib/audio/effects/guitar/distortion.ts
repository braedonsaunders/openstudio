// Distortion Effect Processor
// Hard clipping distortion with multiple voicing options
// Algorithm based on Tone.js Distortion and classic pedal circuits

import { BaseEffect } from '../base-effect';
import type { DistortionSettings } from '@/types';

export type DistortionType = 'classic' | 'hard' | 'fuzz' | 'asymmetric' | 'rectifier';

export class DistortionProcessor extends BaseEffect {
  readonly name = 'Distortion';
  private waveshaper: WaveShaperNode;
  private preGain: GainNode;
  private postGain: GainNode;
  private toneFilter: BiquadFilterNode;
  private highPassFilter: BiquadFilterNode;
  private settings: DistortionSettings;

  constructor(audioContext: AudioContext, settings?: Partial<DistortionSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      amount: 0.5, // 0-1, distortion intensity
      type: 'classic',
      tone: 0.5, // 0-1, brightness
      level: 0.5, // 0-1, output level
      ...settings,
    };

    // Create nodes
    this.waveshaper = audioContext.createWaveShaper();
    this.preGain = audioContext.createGain();
    this.postGain = audioContext.createGain();
    this.toneFilter = audioContext.createBiquadFilter();
    this.highPassFilter = audioContext.createBiquadFilter();

    // Configure filters
    this.toneFilter.type = 'lowpass';
    this.toneFilter.Q.value = 0.7;

    // High pass to remove mud
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = 80;
    this.highPassFilter.Q.value = 0.7;

    // Use 4x oversampling to reduce aliasing
    this.waveshaper.oversample = '4x';

    // Wire up: input -> highPass -> preGain -> waveshaper -> toneFilter -> postGain -> wetGain
    this.inputGain.connect(this.highPassFilter);
    this.highPassFilter.connect(this.preGain);
    this.preGain.connect(this.waveshaper);
    this.waveshaper.connect(this.toneFilter);
    this.toneFilter.connect(this.postGain);
    this.postGain.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Apply initial settings
    this.updateDistortion();
    this.updateTone();
    this.updateLevel();
  }

  /**
   * Generate distortion curve based on type
   * Inspired by Tone.js distortion algorithm with additional voicings
   */
  private generateDistortionCurve(amount: number, type: DistortionType): Float32Array<ArrayBuffer> {
    const samples = 8192;
    const buffer = new ArrayBuffer(samples * 4);
    const curve = new Float32Array(buffer);
    const deg = Math.PI / 180;

    // Scale amount for proper intensity (Tone.js uses *100)
    const k = amount * 100;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;

      switch (type) {
        case 'classic':
          // Classic Tone.js algorithm - smooth musical distortion
          if (Math.abs(x) < 0.001) {
            curve[i] = 0;
          } else {
            curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
          }
          break;

        case 'hard':
          // Hard clipping - more aggressive, transistor-like
          const threshold = 1 / (1 + k * 0.1);
          if (x > threshold) {
            curve[i] = threshold + (1 - threshold) * Math.tanh((x - threshold) * 10);
          } else if (x < -threshold) {
            curve[i] = -threshold + (-1 + threshold) * Math.tanh((x + threshold) * 10);
          } else {
            curve[i] = x;
          }
          break;

        case 'fuzz':
          // Fuzz - extreme clipping with octave harmonics
          const fuzzK = 1 + k * 0.5;
          const fuzzed = Math.sign(x) * Math.pow(Math.abs(x), 0.3);
          curve[i] = Math.tanh(fuzzK * fuzzed);
          break;

        case 'asymmetric':
          // Asymmetric clipping - like real tube amps
          // Positive side clips harder than negative
          if (x >= 0) {
            const posK = k * 1.5;
            curve[i] = Math.tanh(posK * x * 0.8);
          } else {
            const negK = k * 0.8;
            curve[i] = Math.tanh(negK * x);
          }
          break;

        case 'rectifier':
          // Rectifier style - modern high gain
          const rectK = 1 + k * 0.2;
          // Multiple stages of soft clipping
          let signal = x * rectK;
          signal = Math.tanh(signal * 2);
          signal = Math.tanh(signal * 1.5);
          curve[i] = signal;
          break;
      }
    }

    // Normalize the curve to prevent clipping
    let maxVal = 0;
    for (let i = 0; i < samples; i++) {
      maxVal = Math.max(maxVal, Math.abs(curve[i]));
    }
    if (maxVal > 0) {
      for (let i = 0; i < samples; i++) {
        curve[i] = curve[i] / maxVal;
      }
    }

    return curve;
  }

  private updateDistortion(): void {
    this.waveshaper.curve = this.generateDistortionCurve(
      this.settings.amount,
      this.settings.type
    );

    // Adjust pre-gain based on distortion amount
    const preGainValue = 1 + this.settings.amount * 3;
    const now = this.audioContext.currentTime;
    this.preGain.gain.setTargetAtTime(preGainValue, now, 0.01);
  }

  private updateTone(): void {
    // Map tone 0-1 to frequency 1000Hz - 10000Hz
    const frequency = 1000 + this.settings.tone * 9000;
    this.safeSetFilterFrequency(this.toneFilter, frequency);
  }

  private updateLevel(): void {
    // Compensate for increased gain from distortion
    const compensation = 1 / (1 + this.settings.amount * 2);
    const level = this.settings.level * compensation;
    const now = this.audioContext.currentTime;
    this.postGain.gain.setTargetAtTime(level, now, 0.01);
  }

  updateSettings(settings: Partial<DistortionSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.amount !== undefined || settings.type !== undefined) {
      this.updateDistortion();
      this.updateLevel();
    }

    if (settings.tone !== undefined) {
      this.updateTone();
    }

    if (settings.level !== undefined) {
      this.updateLevel();
    }
  }

  getSettings(): DistortionSettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.waveshaper.disconnect();
    this.preGain.disconnect();
    this.postGain.disconnect();
    this.toneFilter.disconnect();
    this.highPassFilter.disconnect();
    super.dispose();
  }
}
