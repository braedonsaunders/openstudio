// Compressor Effect Processor
// Professional dynamics processor with makeup gain

import { BaseEffect } from './base-effect';
import type { CompressorSettings } from '@/types';

export class CompressorProcessor extends BaseEffect {
  readonly name = 'Compressor';
  private compressor: DynamicsCompressorNode;
  private makeupGain: GainNode;
  private settings: CompressorSettings;

  constructor(audioContext: AudioContext, settings?: Partial<CompressorSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      threshold: -24,
      ratio: 4,
      attack: 10,
      release: 100,
      knee: 10,
      makeupGain: 0,
      ...settings,
    };

    // Create compressor
    this.compressor = audioContext.createDynamicsCompressor();
    this.updateCompressor();

    // Create makeup gain
    this.makeupGain = audioContext.createGain();
    this.makeupGain.gain.value = this.dbToLinear(this.settings.makeupGain);

    // Wire up: input -> compressor -> makeupGain -> wetGain -> output
    this.inputGain.connect(this.compressor);
    this.compressor.connect(this.makeupGain);
    this.makeupGain.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);
  }

  private updateCompressor(): void {
    const now = this.audioContext.currentTime;

    this.compressor.threshold.setTargetAtTime(this.settings.threshold, now, 0.01);
    this.compressor.knee.setTargetAtTime(this.settings.knee, now, 0.01);
    this.compressor.ratio.setTargetAtTime(this.settings.ratio, now, 0.01);
    // Attack and release are in seconds for Web Audio API
    this.compressor.attack.setTargetAtTime(this.settings.attack / 1000, now, 0.01);
    this.compressor.release.setTargetAtTime(this.settings.release / 1000, now, 0.01);
  }

  updateSettings(settings: Partial<CompressorSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    this.updateCompressor();

    if (settings.makeupGain !== undefined) {
      const now = this.audioContext.currentTime;
      this.makeupGain.gain.setTargetAtTime(
        this.dbToLinear(settings.makeupGain),
        now,
        0.01
      );
    }
  }

  getSettings(): CompressorSettings {
    return { ...this.settings };
  }

  // Get current gain reduction in dB for metering
  getGainReduction(): number {
    return this.compressor.reduction;
  }

  dispose(): void {
    this.compressor.disconnect();
    this.makeupGain.disconnect();
    super.dispose();
  }
}
