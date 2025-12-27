// Limiter Effect Processor
// Brickwall limiter for final stage protection

import { BaseEffect } from './base-effect';
import type { LimiterSettings } from '@/types';

export class LimiterProcessor extends BaseEffect {
  readonly name = 'Limiter';
  private compressor: DynamicsCompressorNode;
  private ceilingGain: GainNode;
  private settings: LimiterSettings;

  constructor(audioContext: AudioContext, settings?: Partial<LimiterSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      threshold: -3,
      release: 100,
      ceiling: -0.3,
      ...settings,
    };

    // Use compressor with very high ratio as limiter
    this.compressor = audioContext.createDynamicsCompressor();
    this.compressor.threshold.value = this.settings.threshold;
    this.compressor.knee.value = 0; // Hard knee for brickwall limiting
    this.compressor.ratio.value = 20; // Very high ratio
    this.compressor.attack.value = 0.001; // Very fast attack (1ms)
    this.compressor.release.value = this.settings.release / 1000;

    // Ceiling gain to ensure output doesn't exceed ceiling
    this.ceilingGain = audioContext.createGain();
    this.ceilingGain.gain.value = this.dbToLinear(this.settings.ceiling);

    // Wire up: input -> compressor -> ceilingGain -> wetGain -> output
    this.inputGain.connect(this.compressor);
    this.compressor.connect(this.ceilingGain);
    this.ceilingGain.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);
  }

  updateSettings(settings: Partial<LimiterSettings>): void {
    this.settings = { ...this.settings, ...settings };
    const now = this.audioContext.currentTime;

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.threshold !== undefined) {
      this.compressor.threshold.setTargetAtTime(settings.threshold, now, 0.01);
    }

    if (settings.release !== undefined) {
      this.compressor.release.setTargetAtTime(settings.release / 1000, now, 0.01);
    }

    if (settings.ceiling !== undefined) {
      this.ceilingGain.gain.setTargetAtTime(this.dbToLinear(settings.ceiling), now, 0.01);
    }
  }

  getSettings(): LimiterSettings {
    return { ...this.settings };
  }

  // Get current gain reduction in dB for metering
  getGainReduction(): number {
    return this.compressor.reduction;
  }

  dispose(): void {
    this.compressor.disconnect();
    this.ceilingGain.disconnect();
    super.dispose();
  }
}
