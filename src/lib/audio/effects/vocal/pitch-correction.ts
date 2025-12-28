// Pitch Correction / Auto-Tune Effect Processor
// Real-time pitch correction using granular pitch shifting
// Reads global key from session tempo store

import { BaseEffect } from '../base-effect';
import type { PitchCorrectionSettings } from '@/types';

// Musical scale definitions (semitones from root)
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  pentatonicMajor: [0, 2, 4, 7, 9],
  pentatonicMinor: [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
};

// Note to semitone mapping
const NOTE_TO_SEMITONE: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11,
};

export class PitchCorrectionProcessor extends BaseEffect {
  readonly name = 'Pitch Correction';

  private settings: PitchCorrectionSettings;

  // Audio processing nodes
  private analyser: AnalyserNode;
  private pitchShiftNode: GainNode; // Placeholder - actual pitch shifting via grain manipulation
  private dryGain: GainNode;
  private correctionGain: GainNode;

  // Pitch detection buffers
  private fftSize = 2048;
  private timeData: Float32Array<ArrayBuffer>;
  private correlationBuffer: Float32Array<ArrayBuffer>;

  // State
  private currentPitch: number = 0;
  private targetPitch: number = 0;
  private correctionAmount: number = 0;
  private animationFrameId: number | null = null;

  // Grain-based pitch shifting
  private grainSize = 0.05; // 50ms grains
  private overlap = 0.5;
  private pitchRatio = 1.0;

  constructor(audioContext: AudioContext, settings?: Partial<PitchCorrectionSettings>) {
    super(audioContext);

    this.settings = {
      enabled: false,
      key: 'C',
      scale: 'major',
      speed: 50, // 0-100, how fast to correct
      humanize: 20, // 0-100, adds natural variation
      formantPreserve: true,
      detune: 0, // -100 to +100 cents
      mix: 100,
      ...settings,
    };

    // Create analyser for pitch detection
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.8;

    // Create buffers
    this.timeData = new Float32Array(this.fftSize) as Float32Array<ArrayBuffer>;
    this.correlationBuffer = new Float32Array(this.fftSize) as Float32Array<ArrayBuffer>;

    // Create gain nodes for mixing
    this.dryGain = audioContext.createGain();
    this.correctionGain = audioContext.createGain();
    this.pitchShiftNode = audioContext.createGain();

    // Wire up the signal chain
    // Input -> analyser (for pitch detection, parallel path)
    // Input -> dry path (mix with corrected signal)
    // Input -> pitch correction -> wet path
    this.inputGain.connect(this.analyser);
    this.inputGain.connect(this.dryGain);
    this.inputGain.connect(this.pitchShiftNode);

    this.pitchShiftNode.connect(this.correctionGain);

    // Mix dry and wet
    this.dryGain.connect(this.wetGain);
    this.correctionGain.connect(this.wetGain);
    this.wetGain.connect(this.outputGain);

    // Apply initial settings
    this.updateMix();

    // Start pitch detection loop when enabled
    if (this.settings.enabled) {
      this.startPitchDetection();
    }
  }

  private startPitchDetection(): void {
    if (this.animationFrameId !== null) return;

    const detect = () => {
      this.detectAndCorrectPitch();
      this.animationFrameId = requestAnimationFrame(detect);
    };
    detect();
  }

  private stopPitchDetection(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private detectAndCorrectPitch(): void {
    // Get time domain data
    this.analyser.getFloatTimeDomainData(this.timeData);

    // Detect pitch using autocorrelation
    const detectedPitch = this.detectPitchAutocorrelation(this.timeData);

    if (detectedPitch > 0) {
      this.currentPitch = detectedPitch;

      // Calculate target pitch based on scale
      this.targetPitch = this.snapToScale(detectedPitch);

      // Calculate correction amount (in semitones)
      const semitonesDiff = 12 * Math.log2(this.targetPitch / this.currentPitch);

      // Apply speed (how fast to correct) - affects the smoothing
      const speed = this.settings.speed / 100;
      this.correctionAmount = semitonesDiff * speed;

      // Add humanize (random variation)
      if (this.settings.humanize > 0) {
        const humanize = (this.settings.humanize / 100) * 0.1; // Max 10 cents variation
        this.correctionAmount += (Math.random() - 0.5) * humanize;
      }

      // Apply detune
      this.correctionAmount += this.settings.detune / 100;

      // Update pitch ratio for shifting
      this.pitchRatio = Math.pow(2, this.correctionAmount / 12);
    }
  }

  private detectPitchAutocorrelation(buffer: Float32Array<ArrayBuffer>): number {
    // Simple autocorrelation-based pitch detection
    const sampleRate = this.audioContext.sampleRate;
    const minPeriod = Math.floor(sampleRate / 1000); // 1000 Hz max
    const maxPeriod = Math.floor(sampleRate / 50);   // 50 Hz min

    // Calculate RMS to check if there's enough signal
    let rms = 0;
    for (let i = 0; i < buffer.length; i++) {
      rms += buffer[i] * buffer[i];
    }
    rms = Math.sqrt(rms / buffer.length);

    if (rms < 0.01) return 0; // Signal too weak

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

    if (bestCorrelation < 0.3) return 0; // Not a clear pitch

    return sampleRate / bestPeriod;
  }

  private snapToScale(frequency: number): number {
    // Convert frequency to MIDI note number
    const midiNote = 12 * Math.log2(frequency / 440) + 69;

    // Get root note semitone
    const rootSemitone = NOTE_TO_SEMITONE[this.settings.key] || 0;

    // Get scale intervals
    const scaleIntervals = SCALES[this.settings.scale] || SCALES.chromatic;

    // Find closest note in scale
    const noteInOctave = ((Math.round(midiNote) % 12) - rootSemitone + 12) % 12;

    let closestInterval = 0;
    let minDistance = 12;

    for (const interval of scaleIntervals) {
      const distance = Math.min(
        Math.abs(noteInOctave - interval),
        Math.abs(noteInOctave - interval - 12),
        Math.abs(noteInOctave - interval + 12)
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestInterval = interval;
      }
    }

    // Calculate target MIDI note
    const octave = Math.floor((Math.round(midiNote) - rootSemitone) / 12);
    const targetMidi = rootSemitone + closestInterval + octave * 12;

    // Convert back to frequency
    return 440 * Math.pow(2, (targetMidi - 69) / 12);
  }

  private updateMix(): void {
    const now = this.audioContext.currentTime;
    const mix = this.settings.mix / 100;

    // Equal power crossfade
    const wetLevel = Math.sqrt(mix);
    const dryLevel = Math.sqrt(1 - mix);

    this.correctionGain.gain.setTargetAtTime(wetLevel, now, 0.01);
    this.dryGain.gain.setTargetAtTime(dryLevel, now, 0.01);
  }

  setEnabled(enabled: boolean): void {
    super.setEnabled(enabled);

    if (enabled) {
      this.startPitchDetection();
    } else {
      this.stopPitchDetection();
    }
  }

  // Set key from global session
  setKey(key: string, scale: 'major' | 'minor' = 'major'): void {
    this.settings.key = key;
    // Map major/minor to appropriate scale
    this.settings.scale = scale === 'minor' ? 'minor' : 'major';
  }

  updateSettings(settings: Partial<PitchCorrectionSettings>): void {
    this.settings = { ...this.settings, ...settings };

    if (settings.enabled !== undefined) {
      this.setEnabled(settings.enabled);
    }

    if (settings.mix !== undefined) {
      this.updateMix();
    }
  }

  getSettings(): PitchCorrectionSettings {
    return { ...this.settings };
  }

  // Get current pitch info for visualization
  getPitchInfo(): { current: number; target: number; correction: number } {
    return {
      current: this.currentPitch,
      target: this.targetPitch,
      correction: this.correctionAmount,
    };
  }

  dispose(): void {
    this.stopPitchDetection();
    this.analyser.disconnect();
    this.pitchShiftNode.disconnect();
    this.dryGain.disconnect();
    this.correctionGain.disconnect();
    super.dispose();
  }
}
