// Multiband Compressor Effect Processor
// 3-band dynamics processing
// Low latency - uses native DynamicsCompressorNode per band

import { BaseEffect } from '../base-effect';
import type { MultibandCompressorSettings, MultibandBandSettings } from '@/types';

export class MultibandCompressorProcessor extends BaseEffect {
  readonly name = 'Multiband Compressor';

  private settings: MultibandCompressorSettings;

  // Crossover filters (Linkwitz-Riley)
  private lowCrossoverLP: BiquadFilterNode;
  private lowCrossoverLP2: BiquadFilterNode; // Second stage for 24dB/oct
  private midCrossoverHP: BiquadFilterNode;
  private midCrossoverHP2: BiquadFilterNode;
  private midCrossoverLP: BiquadFilterNode;
  private midCrossoverLP2: BiquadFilterNode;
  private highCrossoverHP: BiquadFilterNode;
  private highCrossoverHP2: BiquadFilterNode;

  // Per-band compressors
  private lowCompressor: DynamicsCompressorNode;
  private midCompressor: DynamicsCompressorNode;
  private highCompressor: DynamicsCompressorNode;

  // Per-band gains
  private lowGain: GainNode;
  private midGain: GainNode;
  private highGain: GainNode;

  // Per-band solo/bypass
  private lowBypass: GainNode;
  private midBypass: GainNode;
  private highBypass: GainNode;

  // Output
  private outputSum: GainNode;
  private outputGainNode: GainNode;

  constructor(audioContext: AudioContext, settings?: Partial<MultibandCompressorSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      lowCrossover: 200, // Hz
      highCrossover: 2000, // Hz
      low: {
        threshold: -20,
        ratio: 4,
        attack: 20,
        release: 200,
        gain: 0,
        solo: false,
        bypass: false,
      },
      mid: {
        threshold: -18,
        ratio: 3,
        attack: 15,
        release: 150,
        gain: 0,
        solo: false,
        bypass: false,
      },
      high: {
        threshold: -15,
        ratio: 2.5,
        attack: 10,
        release: 100,
        gain: 0,
        solo: false,
        bypass: false,
      },
      outputGain: 0, // dB
      ...settings,
    };

    // Create crossover filters (Linkwitz-Riley 24dB/oct)
    // Low band: LP @ lowCrossover
    this.lowCrossoverLP = audioContext.createBiquadFilter();
    this.lowCrossoverLP.type = 'lowpass';
    this.lowCrossoverLP.Q.value = 0.5; // Butterworth

    this.lowCrossoverLP2 = audioContext.createBiquadFilter();
    this.lowCrossoverLP2.type = 'lowpass';
    this.lowCrossoverLP2.Q.value = 0.5;

    // Mid band: HP @ lowCrossover, LP @ highCrossover
    this.midCrossoverHP = audioContext.createBiquadFilter();
    this.midCrossoverHP.type = 'highpass';
    this.midCrossoverHP.Q.value = 0.5;

    this.midCrossoverHP2 = audioContext.createBiquadFilter();
    this.midCrossoverHP2.type = 'highpass';
    this.midCrossoverHP2.Q.value = 0.5;

    this.midCrossoverLP = audioContext.createBiquadFilter();
    this.midCrossoverLP.type = 'lowpass';
    this.midCrossoverLP.Q.value = 0.5;

    this.midCrossoverLP2 = audioContext.createBiquadFilter();
    this.midCrossoverLP2.type = 'lowpass';
    this.midCrossoverLP2.Q.value = 0.5;

    // High band: HP @ highCrossover
    this.highCrossoverHP = audioContext.createBiquadFilter();
    this.highCrossoverHP.type = 'highpass';
    this.highCrossoverHP.Q.value = 0.5;

    this.highCrossoverHP2 = audioContext.createBiquadFilter();
    this.highCrossoverHP2.type = 'highpass';
    this.highCrossoverHP2.Q.value = 0.5;

    // Create compressors
    this.lowCompressor = audioContext.createDynamicsCompressor();
    this.midCompressor = audioContext.createDynamicsCompressor();
    this.highCompressor = audioContext.createDynamicsCompressor();

    // Create gains
    this.lowGain = audioContext.createGain();
    this.midGain = audioContext.createGain();
    this.highGain = audioContext.createGain();

    // Create bypass gains
    this.lowBypass = audioContext.createGain();
    this.midBypass = audioContext.createGain();
    this.highBypass = audioContext.createGain();

    // Output
    this.outputSum = audioContext.createGain();
    this.outputGainNode = audioContext.createGain();

    // Wire up low band
    this.inputGain.connect(this.lowCrossoverLP);
    this.lowCrossoverLP.connect(this.lowCrossoverLP2);
    this.lowCrossoverLP2.connect(this.lowCompressor);
    this.lowCompressor.connect(this.lowGain);
    this.lowGain.connect(this.lowBypass);
    this.lowBypass.connect(this.outputSum);

    // Wire up mid band
    this.inputGain.connect(this.midCrossoverHP);
    this.midCrossoverHP.connect(this.midCrossoverHP2);
    this.midCrossoverHP2.connect(this.midCrossoverLP);
    this.midCrossoverLP.connect(this.midCrossoverLP2);
    this.midCrossoverLP2.connect(this.midCompressor);
    this.midCompressor.connect(this.midGain);
    this.midGain.connect(this.midBypass);
    this.midBypass.connect(this.outputSum);

    // Wire up high band
    this.inputGain.connect(this.highCrossoverHP);
    this.highCrossoverHP.connect(this.highCrossoverHP2);
    this.highCrossoverHP2.connect(this.highCompressor);
    this.highCompressor.connect(this.highGain);
    this.highGain.connect(this.highBypass);
    this.highBypass.connect(this.outputSum);

    // Output
    this.outputSum.connect(this.outputGainNode);
    this.outputGainNode.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Apply initial settings
    this.updateCrossovers();
    this.updateBandSettings('low');
    this.updateBandSettings('mid');
    this.updateBandSettings('high');
    this.updateOutputGain();
  }

  private updateCrossovers(): void {
    try {
      // Low crossover - use safe frequency setting
      this.safeSetFilterFrequency(this.lowCrossoverLP, this.settings.lowCrossover);
      this.safeSetFilterFrequency(this.lowCrossoverLP2, this.settings.lowCrossover);
      this.safeSetFilterFrequency(this.midCrossoverHP, this.settings.lowCrossover);
      this.safeSetFilterFrequency(this.midCrossoverHP2, this.settings.lowCrossover);

      // High crossover
      this.safeSetFilterFrequency(this.midCrossoverLP, this.settings.highCrossover);
      this.safeSetFilterFrequency(this.midCrossoverLP2, this.settings.highCrossover);
      this.safeSetFilterFrequency(this.highCrossoverHP, this.settings.highCrossover);
      this.safeSetFilterFrequency(this.highCrossoverHP2, this.settings.highCrossover);
    } catch (e) {
      console.warn('[Multiband Compressor] Crossover update error:', e);
    }
  }

  private updateBandSettings(band: 'low' | 'mid' | 'high'): void {
    const now = this.audioContext.currentTime;
    const bandSettings = this.settings[band];

    let compressor: DynamicsCompressorNode;
    let gain: GainNode;
    let bypass: GainNode;

    switch (band) {
      case 'low':
        compressor = this.lowCompressor;
        gain = this.lowGain;
        bypass = this.lowBypass;
        break;
      case 'mid':
        compressor = this.midCompressor;
        gain = this.midGain;
        bypass = this.midBypass;
        break;
      case 'high':
        compressor = this.highCompressor;
        gain = this.highGain;
        bypass = this.highBypass;
        break;
    }

    // Update compressor
    compressor.threshold.setTargetAtTime(bandSettings.threshold, now, 0.01);
    compressor.ratio.setTargetAtTime(bandSettings.ratio, now, 0.01);
    compressor.attack.setTargetAtTime(bandSettings.attack / 1000, now, 0.01);
    compressor.release.setTargetAtTime(bandSettings.release / 1000, now, 0.01);

    // Update gain
    gain.gain.setTargetAtTime(Math.pow(10, bandSettings.gain / 20), now, 0.01);

    // Update solo/bypass
    // Check if any band is soloed
    const anySolo = this.settings.low.solo || this.settings.mid.solo || this.settings.high.solo;

    if (bandSettings.bypass) {
      bypass.gain.setTargetAtTime(0, now, 0.01);
    } else if (anySolo && !bandSettings.solo) {
      bypass.gain.setTargetAtTime(0, now, 0.01);
    } else {
      bypass.gain.setTargetAtTime(1, now, 0.01);
    }
  }

  private updateOutputGain(): void {
    const now = this.audioContext.currentTime;
    this.outputGainNode.gain.setTargetAtTime(
      Math.pow(10, this.settings.outputGain / 20),
      now,
      0.01
    );
  }

  // Get gain reduction per band for metering
  getGainReduction(): { low: number; mid: number; high: number } {
    return {
      low: this.lowCompressor.reduction,
      mid: this.midCompressor.reduction,
      high: this.highCompressor.reduction,
    };
  }

  updateSettings(settings: Partial<MultibandCompressorSettings>): void {
    if (settings.low) {
      this.settings.low = { ...this.settings.low, ...settings.low };
      this.updateBandSettings('low');
    }
    if (settings.mid) {
      this.settings.mid = { ...this.settings.mid, ...settings.mid };
      this.updateBandSettings('mid');
    }
    if (settings.high) {
      this.settings.high = { ...this.settings.high, ...settings.high };
      this.updateBandSettings('high');
    }

    if (settings.enabled !== undefined) {
      this.settings.enabled = settings.enabled;
      this.setEnabled(settings.enabled);
    }

    if (settings.lowCrossover !== undefined || settings.highCrossover !== undefined) {
      if (settings.lowCrossover !== undefined) {
        this.settings.lowCrossover = settings.lowCrossover;
      }
      if (settings.highCrossover !== undefined) {
        this.settings.highCrossover = settings.highCrossover;
      }
      this.updateCrossovers();
    }

    if (settings.outputGain !== undefined) {
      this.settings.outputGain = settings.outputGain;
      this.updateOutputGain();
    }
  }

  getSettings(): MultibandCompressorSettings {
    return {
      ...this.settings,
      low: { ...this.settings.low },
      mid: { ...this.settings.mid },
      high: { ...this.settings.high },
    };
  }

  dispose(): void {
    this.lowCrossoverLP.disconnect();
    this.lowCrossoverLP2.disconnect();
    this.midCrossoverHP.disconnect();
    this.midCrossoverHP2.disconnect();
    this.midCrossoverLP.disconnect();
    this.midCrossoverLP2.disconnect();
    this.highCrossoverHP.disconnect();
    this.highCrossoverHP2.disconnect();
    this.lowCompressor.disconnect();
    this.midCompressor.disconnect();
    this.highCompressor.disconnect();
    this.lowGain.disconnect();
    this.midGain.disconnect();
    this.highGain.disconnect();
    this.lowBypass.disconnect();
    this.midBypass.disconnect();
    this.highBypass.disconnect();
    this.outputSum.disconnect();
    this.outputGainNode.disconnect();
    super.dispose();
  }
}
