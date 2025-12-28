// Vibrato Effect Processor
// Pitch-only modulation (no amplitude component)
// Very low latency - uses short modulated delay line

import { BaseEffect } from '../base-effect';
import type { VibratoSettings } from '@/types';

export class VibratoProcessor extends BaseEffect {
  readonly name = 'Vibrato';

  private settings: VibratoSettings;

  // Modulated delay for pitch shift
  private delayL: DelayNode;
  private delayR: DelayNode;

  // LFO
  private lfo: OscillatorNode;
  private lfoGainL: GainNode;
  private lfoGainR: GainNode;

  // Tempo sync
  private currentBpm: number = 120;

  constructor(audioContext: AudioContext, settings?: Partial<VibratoSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      rate: 5, // Hz (0.1-20)
      depth: 50, // 0-100
      waveform: 'sine',
      stereo: 0, // phase offset 0-180 degrees
      tempoSync: false,
      subdivision: '1/8',
      ...settings,
    };

    // Create delay lines (short for vibrato)
    this.delayL = audioContext.createDelay(0.05); // 50ms max
    this.delayR = audioContext.createDelay(0.05);

    // Base delay time (center point for modulation)
    const baseDelay = 0.007; // 7ms
    this.delayL.delayTime.value = baseDelay;
    this.delayR.delayTime.value = baseDelay;

    // Create LFO
    this.lfo = audioContext.createOscillator();
    this.lfo.type = this.settings.waveform;

    // LFO gains (control depth per channel)
    this.lfoGainL = audioContext.createGain();
    this.lfoGainR = audioContext.createGain();

    // Wire up LFO to delay modulation
    this.lfo.connect(this.lfoGainL);
    this.lfo.connect(this.lfoGainR);
    this.lfoGainL.connect(this.delayL.delayTime);
    this.lfoGainR.connect(this.delayR.delayTime);

    // Create channel splitter/merger for stereo
    const splitter = audioContext.createChannelSplitter(2);
    const merger = audioContext.createChannelMerger(2);

    // Wire up stereo signal path
    this.inputGain.connect(splitter);
    splitter.connect(this.delayL, 0);
    splitter.connect(this.delayR, 1);
    this.delayL.connect(merger, 0, 0);
    this.delayR.connect(merger, 0, 1);
    merger.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Start LFO
    this.lfo.start();

    // Apply initial settings
    this.updateRate();
    this.updateDepth();
  }

  private updateRate(): void {
    const now = this.audioContext.currentTime;

    let rate: number;
    if (this.settings.tempoSync && this.currentBpm > 0) {
      const beatDuration = 60 / this.currentBpm;
      const subdivisionMultiplier = this.getSubdivisionMultiplier();
      rate = 1 / (beatDuration * subdivisionMultiplier);
    } else {
      rate = this.settings.rate;
    }

    this.lfo.frequency.setTargetAtTime(rate, now, 0.01);
  }

  private getSubdivisionMultiplier(): number {
    switch (this.settings.subdivision) {
      case '1/1': return 4;
      case '1/2': return 2;
      case '1/4': return 1;
      case '1/8': return 0.5;
      case '1/16': return 0.25;
      default: return 0.5;
    }
  }

  private updateDepth(): void {
    const now = this.audioContext.currentTime;

    // Convert depth to delay modulation amount
    // More depth = more pitch variation
    const maxModulation = 0.003; // 3ms max modulation
    const modulation = (this.settings.depth / 100) * maxModulation;

    // Apply stereo phase offset
    const stereoPhase = this.settings.stereo * Math.PI / 180;

    // Left channel
    this.lfoGainL.gain.setTargetAtTime(modulation, now, 0.01);

    // Right channel (inverted based on stereo setting)
    const rightMod = modulation * Math.cos(stereoPhase);
    this.lfoGainR.gain.setTargetAtTime(rightMod, now, 0.01);
  }

  private updateWaveform(): void {
    this.lfo.type = this.settings.waveform;
  }

  setTempo(bpm: number): void {
    this.currentBpm = bpm;
    if (this.settings.tempoSync) {
      this.updateRate();
    }
  }

  updateSettings(settings: Partial<VibratoSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.rate !== undefined ||
        settings.tempoSync !== undefined ||
        settings.subdivision !== undefined) {
      this.updateRate();
    }

    if (settings.depth !== undefined || settings.stereo !== undefined) {
      this.updateDepth();
    }

    if (settings.waveform !== undefined) {
      this.updateWaveform();
    }
  }

  getSettings(): VibratoSettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.lfo.stop();
    this.lfo.disconnect();
    this.lfoGainL.disconnect();
    this.lfoGainR.disconnect();
    this.delayL.disconnect();
    this.delayR.disconnect();
    super.dispose();
  }
}
