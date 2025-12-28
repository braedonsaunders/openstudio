// Auto-Pan Effect Processor
// Stereo field movement synchronized to tempo
// Zero latency - uses native StereoPannerNode with LFO

import { BaseEffect } from '../base-effect';
import type { AutoPanSettings } from '@/types';

export class AutoPanProcessor extends BaseEffect {
  readonly name = 'Auto-Pan';

  private settings: AutoPanSettings;

  // Stereo panner
  private panner: StereoPannerNode;

  // LFO for panning
  private lfo: OscillatorNode;
  private lfoGain: GainNode;

  // Tempo sync
  private currentBpm: number = 120;

  constructor(audioContext: AudioContext, settings?: Partial<AutoPanSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      rate: 2, // Hz (0.1-20)
      depth: 100, // 0-100
      waveform: 'sine', // sine, triangle, square, sawtooth
      phase: 0, // 0-360 degrees
      tempoSync: false,
      subdivision: '1/4', // note subdivision for tempo sync
      width: 100, // stereo width 0-100
      ...settings,
    };

    // Create stereo panner
    this.panner = audioContext.createStereoPanner();

    // Create LFO
    this.lfo = audioContext.createOscillator();
    this.lfo.type = this.settings.waveform;
    this.lfo.frequency.value = this.settings.rate;

    // LFO gain (depth control)
    this.lfoGain = audioContext.createGain();

    // Wire up
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.panner.pan);

    // Signal path
    this.inputGain.connect(this.panner);
    this.panner.connect(this.wetGain);
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
      // Calculate rate from tempo and subdivision
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
      case '1/2D': return 3; // Dotted half
      case '1/4': return 1;
      case '1/4D': return 1.5;
      case '1/4T': return 2/3; // Triplet
      case '1/8': return 0.5;
      case '1/8D': return 0.75;
      case '1/8T': return 1/3;
      case '1/16': return 0.25;
      case '1/16D': return 0.375;
      case '1/16T': return 1/6;
      default: return 1;
    }
  }

  private updateDepth(): void {
    const now = this.audioContext.currentTime;
    const depth = (this.settings.depth / 100) * (this.settings.width / 100);
    this.lfoGain.gain.setTargetAtTime(depth, now, 0.01);
  }

  private updateWaveform(): void {
    this.lfo.type = this.settings.waveform;
  }

  // Set tempo from global session
  setTempo(bpm: number): void {
    this.currentBpm = bpm;
    if (this.settings.tempoSync) {
      this.updateRate();
    }
  }

  updateSettings(settings: Partial<AutoPanSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.rate !== undefined ||
        settings.tempoSync !== undefined ||
        settings.subdivision !== undefined) {
      this.updateRate();
    }

    if (settings.depth !== undefined || settings.width !== undefined) {
      this.updateDepth();
    }

    if (settings.waveform !== undefined) {
      this.updateWaveform();
    }
  }

  getSettings(): AutoPanSettings {
    return { ...this.settings };
  }

  dispose(): void {
    this.lfo.stop();
    this.lfo.disconnect();
    this.lfoGain.disconnect();
    this.panner.disconnect();
    super.dispose();
  }
}
