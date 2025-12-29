// Exciter / Harmonic Enhancer Effect Processor
// Adds harmonic content for presence and clarity
// Zero latency

import { BaseEffect } from '../base-effect';
import type { ExciterSettings } from '@/types';

export class ExciterProcessor extends BaseEffect {
  readonly name = 'Exciter';

  private settings: ExciterSettings;

  // Frequency isolation
  private highPass: BiquadFilterNode;
  private lowPass: BiquadFilterNode;

  // Harmonic generation
  private waveshaper: WaveShaperNode;
  private saturationGain: GainNode;

  // Post-processing
  private harmonicsFilter: BiquadFilterNode;
  private harmonicsGain: GainNode;

  // Mixing
  private dryGain: GainNode;
  private exciteGain: GainNode;

  constructor(audioContext: AudioContext, settings?: Partial<ExciterSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      frequency: 3000, // Hz (1000-10000) - above which to excite
      amount: 30, // 0-100
      harmonics: 'odd', // 'odd', 'even', 'both'
      color: 50, // 0-100 (dark to bright)
      mix: 50, // 0-100
      ...settings,
    };

    // High-pass to isolate frequencies to excite
    this.highPass = audioContext.createBiquadFilter();
    this.highPass.type = 'highpass';
    this.highPass.Q.value = 0.7;
    this.registerFilter(this.highPass);

    // Low-pass for color control
    this.lowPass = audioContext.createBiquadFilter();
    this.lowPass.type = 'lowpass';
    this.lowPass.frequency.value = 15000;
    this.lowPass.Q.value = 0.5;
    this.registerFilter(this.lowPass);

    // Waveshaper for harmonic generation
    this.waveshaper = audioContext.createWaveShaper();
    this.waveshaper.oversample = '4x'; // High quality

    // Saturation input gain
    this.saturationGain = audioContext.createGain();

    // High-pass filter after saturation to remove added low frequencies
    this.harmonicsFilter = audioContext.createBiquadFilter();
    this.harmonicsFilter.type = 'highpass';
    this.harmonicsFilter.Q.value = 0.5;
    this.registerFilter(this.harmonicsFilter);

    // Harmonics output gain
    this.harmonicsGain = audioContext.createGain();

    // Dry/wet mixing
    this.dryGain = audioContext.createGain();
    this.exciteGain = audioContext.createGain();

    // Wire up signal chain
    // Dry path - routes through wetGain so it's blocked when effect is disabled
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.wetGain);

    // Exciter path - starts from wetPathGate to block filters when disabled
    this.getWetPathInput().connect(this.highPass);
    this.highPass.connect(this.saturationGain);
    this.saturationGain.connect(this.waveshaper);
    this.waveshaper.connect(this.harmonicsFilter);
    this.harmonicsFilter.connect(this.lowPass);
    this.lowPass.connect(this.harmonicsGain);
    this.harmonicsGain.connect(this.exciteGain);
    this.exciteGain.connect(this.wetGain);

    this.wetGain.connect(this.outputGain);

    // Apply initial settings
    this.updateFrequency();
    this.updateAmount();
    this.updateHarmonics();
    this.updateColor();
    this.updateMix();
  }

  private updateFrequency(): void {
    const now = this.audioContext.currentTime;
    this.highPass.frequency.setTargetAtTime(this.settings.frequency, now, 0.01);
    this.harmonicsFilter.frequency.setTargetAtTime(this.settings.frequency * 0.8, now, 0.01);
  }

  private updateAmount(): void {
    const now = this.audioContext.currentTime;

    // More amount = more saturation and higher output
    const amount = this.settings.amount / 100;
    this.saturationGain.gain.setTargetAtTime(1 + amount * 5, now, 0.01);
    this.harmonicsGain.gain.setTargetAtTime(amount, now, 0.01);
  }

  private updateHarmonics(): void {
    const curveLength = 8192;
    const curve = new Float32Array(curveLength);

    for (let i = 0; i < curveLength; i++) {
      const x = (i / curveLength) * 2 - 1;

      switch (this.settings.harmonics) {
        case 'odd':
          // Soft clipping creates primarily odd harmonics
          curve[i] = Math.tanh(x * 2);
          break;

        case 'even':
          // Asymmetric clipping creates even harmonics
          curve[i] = x >= 0
            ? Math.tanh(x * 1.5)
            : Math.tanh(x * 2.5);
          break;

        case 'both':
          // Combined harmonic generation
          const odd = Math.tanh(x * 2);
          const even = x >= 0 ? x * x : -x * x;
          curve[i] = (odd + even * 0.3) / 1.3;
          break;

        default:
          curve[i] = Math.tanh(x * 2);
      }
    }

    this.waveshaper.curve = curve;
  }

  private updateColor(): void {
    const now = this.audioContext.currentTime;

    // Color controls the brightness of the harmonics
    // 0 = dark (lower LPF), 100 = bright (higher LPF)
    const color = this.settings.color / 100;
    const lpfFreq = 5000 + color * 15000; // 5k - 20k Hz

    this.lowPass.frequency.setTargetAtTime(lpfFreq, now, 0.01);
  }

  private updateMix(): void {
    const now = this.audioContext.currentTime;
    const mix = this.settings.mix / 100;

    // Keep full dry signal, add excited signal on top
    this.dryGain.gain.setTargetAtTime(1, now, 0.01);
    this.exciteGain.gain.setTargetAtTime(mix, now, 0.01);
  }

  updateSettings(settings: Partial<ExciterSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.frequency !== undefined) {
      this.updateFrequency();
    }

    if (settings.amount !== undefined) {
      this.updateAmount();
    }

    if (settings.harmonics !== undefined) {
      this.updateHarmonics();
    }

    if (settings.color !== undefined) {
      this.updateColor();
    }

    if (settings.mix !== undefined) {
      this.updateMix();
    }
  }

  getSettings(): ExciterSettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.highPass.disconnect();
    this.lowPass.disconnect();
    this.waveshaper.disconnect();
    this.saturationGain.disconnect();
    this.harmonicsFilter.disconnect();
    this.harmonicsGain.disconnect();
    this.dryGain.disconnect();
    this.exciteGain.disconnect();
    super.dispose();
  }
}
