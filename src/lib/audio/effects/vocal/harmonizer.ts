// Harmonizer Effect Processor
// Generate harmonies based on input pitch
// Reads global key from session tempo store for scale-correct intervals

import { BaseEffect } from '../base-effect';
import type { HarmonizerSettings } from '@/types';

// Interval definitions in semitones
const HARMONY_INTERVALS: Record<string, number[]> = {
  octave: [12],
  fifth: [7],
  fourth: [5],
  third: [4],
  minorThird: [3],
  sixth: [9],
  powerChord: [7, 12],
  majorChord: [4, 7],
  minorChord: [3, 7],
  thirdAndFifth: [4, 7],
  thirdBelow: [-4],
  fifthBelow: [-5],
  octaveBelow: [-12],
  custom: [], // User defined
};

// Scale-aware interval adjustments
const MAJOR_SCALE_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10];

const NOTE_TO_SEMITONE: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
};

export class HarmonizerProcessor extends BaseEffect {
  readonly name = 'Harmonizer';

  private settings: HarmonizerSettings;

  // Pitch detection
  private analyser: AnalyserNode;
  private fftSize = 2048;
  private timeData: Float32Array;

  // Harmony voices (simulated via delay-based pitch shifting)
  private harmonyDelays: DelayNode[] = [];
  private harmonyGains: GainNode[] = [];
  private harmonyLFOs: OscillatorNode[] = [];
  private harmonyLFOGains: GainNode[] = [];

  // Mixing
  private dryGain: GainNode;
  private harmonyMasterGain: GainNode;

  // Stereo spread
  private panners: StereoPannerNode[] = [];

  // State
  private currentPitch: number = 0;
  private targetIntervals: number[] = [];
  private animationFrameId: number | null = null;

  private maxVoices = 4;

  constructor(audioContext: AudioContext, settings?: Partial<HarmonizerSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      key: 'C',
      scale: 'major',
      harmonyType: 'third',
      customIntervals: [4], // Semitones
      voices: 1, // 1-4
      spread: 50, // Stereo spread 0-100
      shift: 0, // Pitch shift in cents (-1200 to +1200)
      mix: 50, // 0-100
      keyLock: true, // Snap to scale
      ...settings,
    };

    // Create analyser for pitch detection
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.8;
    this.timeData = new Float32Array(this.fftSize);

    // Create dry/wet mixing
    this.dryGain = audioContext.createGain();
    this.harmonyMasterGain = audioContext.createGain();

    // Create harmony voices
    for (let i = 0; i < this.maxVoices; i++) {
      // Delay for pitch shift simulation
      const delay = audioContext.createDelay(0.1);
      this.harmonyDelays.push(delay);

      // Gain for voice level
      const gain = audioContext.createGain();
      gain.gain.value = 0;
      this.harmonyGains.push(gain);

      // LFO for pitch shift (modulates delay time)
      const lfo = audioContext.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 3 + i * 0.5; // Different rates for each voice
      this.harmonyLFOs.push(lfo);

      const lfoGain = audioContext.createGain();
      lfoGain.gain.value = 0.002; // 2ms modulation range
      this.harmonyLFOGains.push(lfoGain);

      // Stereo panner
      const panner = audioContext.createStereoPanner();
      this.panners.push(panner);

      // Wire up voice
      lfo.connect(lfoGain);
      lfoGain.connect(delay.delayTime);
      delay.connect(gain);
      gain.connect(panner);
      panner.connect(this.harmonyMasterGain);

      lfo.start();
    }

    // Wire up main signal chain
    this.inputGain.connect(this.analyser); // For pitch detection
    this.inputGain.connect(this.dryGain);

    // Connect input to all harmony delays
    for (const delay of this.harmonyDelays) {
      this.inputGain.connect(delay);
    }

    this.dryGain.connect(this.wetGain);
    this.harmonyMasterGain.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Apply initial settings
    this.updateHarmony();
    this.updateMix();
    this.updateSpread();

    if (this.settings.enabled) {
      this.startPitchTracking();
    }
  }

  private startPitchTracking(): void {
    if (this.animationFrameId !== null) return;

    const track = () => {
      this.analyser.getFloatTimeDomainData(this.timeData);
      const pitch = this.detectPitch(this.timeData);

      if (pitch > 0) {
        this.currentPitch = pitch;
        this.updateHarmonyPitches(pitch);
      }

      this.animationFrameId = requestAnimationFrame(track);
    };
    track();
  }

  private stopPitchTracking(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private detectPitch(buffer: Float32Array): number {
    const sampleRate = this.audioContext.sampleRate;
    const minPeriod = Math.floor(sampleRate / 1000);
    const maxPeriod = Math.floor(sampleRate / 50);

    // Calculate RMS
    let rms = 0;
    for (let i = 0; i < buffer.length; i++) {
      rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / buffer.length);
    if (rms < 0.01) return 0;

    // Autocorrelation
    let bestPeriod = 0;
    let bestCorrelation = 0;

    for (let period = minPeriod; period < maxPeriod; period++) {
      let correlation = 0;
      for (let i = 0; i < buffer.length - period; i++) {
        correlation += buffer[i] * buffer[i + period];
      }
      correlation /= (buffer.length - period);

      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestPeriod = period;
      }
    }

    if (bestCorrelation < 0.3) return 0;
    return sampleRate / bestPeriod;
  }

  private updateHarmonyPitches(_inputPitch: number): void {
    const intervals = this.getIntervals();

    for (let i = 0; i < this.maxVoices; i++) {
      if (i < intervals.length && i < this.settings.voices) {
        let interval = intervals[i] + this.settings.shift / 100;

        // Adjust for key if keyLock is enabled
        if (this.settings.keyLock && this.settings.scale) {
          interval = this.snapIntervalToScale(interval);
        }

        // Update LFO gain based on interval (larger intervals = more modulation)
        const lfoGain = 0.001 + Math.abs(interval) * 0.0002;
        this.harmonyLFOGains[i].gain.value = lfoGain;

        // Update voice gain
        this.harmonyGains[i].gain.value = 1 / this.settings.voices;
      } else {
        this.harmonyGains[i].gain.value = 0;
      }
    }
  }

  private getIntervals(): number[] {
    if (this.settings.harmonyType === 'custom') {
      return this.settings.customIntervals;
    }
    return HARMONY_INTERVALS[this.settings.harmonyType] || [4];
  }

  private snapIntervalToScale(interval: number): number {
    const scaleIntervals = this.settings.scale === 'minor'
      ? MINOR_SCALE_INTERVALS
      : MAJOR_SCALE_INTERVALS;

    const rootOffset = NOTE_TO_SEMITONE[this.settings.key] || 0;
    const targetSemitone = ((interval % 12) + 12) % 12;

    // Find closest scale degree
    let closest = 0;
    let minDist = 12;

    for (const scaleDegree of scaleIntervals) {
      const adjustedDegree = (scaleDegree + rootOffset) % 12;
      const dist = Math.min(
        Math.abs(targetSemitone - adjustedDegree),
        12 - Math.abs(targetSemitone - adjustedDegree)
      );
      if (dist < minDist) {
        minDist = dist;
        closest = adjustedDegree;
      }
    }

    // Return adjusted interval
    const octaves = Math.floor(interval / 12);
    return octaves * 12 + closest - NOTE_TO_SEMITONE[this.settings.key];
  }

  private updateHarmony(): void {
    const now = this.audioContext.currentTime;
    const intervals = this.getIntervals();

    for (let i = 0; i < this.maxVoices; i++) {
      if (i < intervals.length && i < this.settings.voices) {
        // Base delay time (affects pitch)
        const baseDelay = 0.02 + i * 0.005; // 20-40ms range
        this.harmonyDelays[i].delayTime.setTargetAtTime(baseDelay, now, 0.01);
        this.harmonyGains[i].gain.setTargetAtTime(1 / this.settings.voices, now, 0.01);
      } else {
        this.harmonyGains[i].gain.setTargetAtTime(0, now, 0.01);
      }
    }
  }

  private updateMix(): void {
    const now = this.audioContext.currentTime;
    const mix = this.settings.mix / 100;

    this.dryGain.gain.setTargetAtTime(Math.sqrt(1 - mix), now, 0.01);
    this.harmonyMasterGain.gain.setTargetAtTime(Math.sqrt(mix), now, 0.01);
  }

  private updateSpread(): void {
    const spread = this.settings.spread / 100;

    for (let i = 0; i < this.maxVoices; i++) {
      const pan = ((i / (this.maxVoices - 1)) * 2 - 1) * spread;
      this.panners[i].pan.value = pan;
    }
  }

  setEnabled(enabled: boolean): void {
    super.setEnabled(enabled);

    if (enabled) {
      this.startPitchTracking();
    } else {
      this.stopPitchTracking();
    }
  }

  // Set key from global session
  setKey(key: string, scale: 'major' | 'minor' = 'major'): void {
    this.settings.key = key;
    this.settings.scale = scale;
  }

  updateSettings(settings: Partial<HarmonizerSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.harmonyType !== undefined ||
        settings.customIntervals !== undefined ||
        settings.voices !== undefined) {
      this.updateHarmony();
    }

    if (settings.mix !== undefined) {
      this.updateMix();
    }

    if (settings.spread !== undefined) {
      this.updateSpread();
    }
  }

  getSettings(): HarmonizerSettings {
    return { ...this.settings };
  }

  getPitchInfo(): { current: number } {
    return { current: this.currentPitch };
  }

  dispose(): void {
    this.stopPitchTracking();

    for (const lfo of this.harmonyLFOs) {
      lfo.stop();
      lfo.disconnect();
    }
    for (const lfoGain of this.harmonyLFOGains) {
      lfoGain.disconnect();
    }
    for (const delay of this.harmonyDelays) {
      delay.disconnect();
    }
    for (const gain of this.harmonyGains) {
      gain.disconnect();
    }
    for (const panner of this.panners) {
      panner.disconnect();
    }

    this.analyser.disconnect();
    this.dryGain.disconnect();
    this.harmonyMasterGain.disconnect();
    super.dispose();
  }
}
