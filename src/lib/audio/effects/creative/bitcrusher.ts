// Bitcrusher Effect Processor
// Lo-fi sample rate and bit depth reduction
// Zero additional latency - sample-by-sample processing via ScriptProcessor/AudioWorklet

import { BaseEffect } from '../base-effect';
import type { BitcrusherSettings } from '@/types';

export class BitcrusherProcessor extends BaseEffect {
  readonly name = 'Bitcrusher';

  private settings: BitcrusherSettings;

  // Waveshaper for bit reduction
  private waveshaper: WaveShaperNode;

  // Sample rate reduction via sample-and-hold
  private holdGain: GainNode;

  // Filters
  private preFilter: BiquadFilterNode;
  private postFilter: BiquadFilterNode;

  // Mixing
  private dryGain: GainNode;
  private crushGain: GainNode;

  // Sample-and-hold state (simulated via stepped waveshaper)
  private sampleHoldCounter = 0;
  private lastSample = 0;

  constructor(audioContext: AudioContext, settings?: Partial<BitcrusherSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      bits: 8, // 1-16
      sampleRate: 22050, // 100-44100 Hz
      mix: 100, // 0-100
      dither: false, // Add noise to reduce quantization artifacts
      ...settings,
    };

    // Create waveshaper for bit crushing
    this.waveshaper = audioContext.createWaveShaper();
    this.waveshaper.oversample = 'none'; // No oversampling for authentic lo-fi

    // Pre-filter to prevent aliasing
    this.preFilter = audioContext.createBiquadFilter();
    this.preFilter.type = 'lowpass';
    this.preFilter.Q.value = 0.5;

    // Post-filter to smooth harsh edges
    this.postFilter = audioContext.createBiquadFilter();
    this.postFilter.type = 'lowpass';
    this.postFilter.Q.value = 0.7;

    // Hold gain for sample rate reduction effect
    this.holdGain = audioContext.createGain();

    // Mixing
    this.dryGain = audioContext.createGain();
    this.crushGain = audioContext.createGain();

    // Wire up signal chain
    // Dry path
    this.inputGain.connect(this.dryGain);
    this.dryGain.connect(this.wetGain);

    // Wet path (bit crush)
    this.inputGain.connect(this.preFilter);
    this.preFilter.connect(this.waveshaper);
    this.waveshaper.connect(this.holdGain);
    this.holdGain.connect(this.postFilter);
    this.postFilter.connect(this.crushGain);
    this.crushGain.connect(this.wetGain);

    this.wetGain.connect(this.outputGain);

    // Apply initial settings
    this.updateBitDepth();
    this.updateSampleRate();
    this.updateMix();
  }

  private updateBitDepth(): void {
    // Create quantization curve for waveshaper
    const bits = Math.max(1, Math.min(16, this.settings.bits));
    const levels = Math.pow(2, bits);
    const curveLength = 65536; // High resolution curve
    const curve = new Float32Array(curveLength);

    for (let i = 0; i < curveLength; i++) {
      // Map input -1 to 1
      const input = (i / curveLength) * 2 - 1;

      // Quantize to bit depth
      let quantized = Math.round(input * (levels / 2)) / (levels / 2);

      // Add dither if enabled
      if (this.settings.dither) {
        const dither = (Math.random() - 0.5) / levels;
        quantized += dither;
      }

      curve[i] = Math.max(-1, Math.min(1, quantized));
    }

    this.waveshaper.curve = curve;
  }

  private updateSampleRate(): void {
    const now = this.audioContext.currentTime;

    // Calculate reduction factor
    const targetRate = Math.max(100, Math.min(44100, this.settings.sampleRate));
    const nyquist = targetRate / 2;

    // Set pre-filter to prevent aliasing at the target sample rate
    this.preFilter.frequency.setTargetAtTime(Math.min(nyquist, 20000), now, 0.01);

    // Set post-filter slightly higher for smoothing
    this.postFilter.frequency.setTargetAtTime(Math.min(nyquist * 1.2, 20000), now, 0.01);
  }

  private updateMix(): void {
    const now = this.audioContext.currentTime;
    const mix = this.settings.mix / 100;

    // Equal power crossfade
    this.dryGain.gain.setTargetAtTime(Math.sqrt(1 - mix), now, 0.01);
    this.crushGain.gain.setTargetAtTime(Math.sqrt(mix), now, 0.01);
  }

  updateSettings(settings: Partial<BitcrusherSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.bits !== undefined || settings.dither !== undefined) {
      this.updateBitDepth();
    }

    if (settings.sampleRate !== undefined) {
      this.updateSampleRate();
    }

    if (settings.mix !== undefined) {
      this.updateMix();
    }
  }

  getSettings(): BitcrusherSettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.waveshaper.disconnect();
    this.preFilter.disconnect();
    this.postFilter.disconnect();
    this.holdGain.disconnect();
    this.dryGain.disconnect();
    this.crushGain.disconnect();
    super.dispose();
  }
}
