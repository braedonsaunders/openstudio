// Default effects settings - used for initialization and presets
// Actual effects processing is handled by native bridge

import type {
  UnifiedEffectsChain,
  ExtendedEffectsChain,
  MasterEffectsChain,
} from '@/types';

// Default settings for the 15 unified effects (guitar + track effects)
export const DEFAULT_UNIFIED_EFFECTS: UnifiedEffectsChain = {
  wah: { enabled: false, mode: 'manual', frequency: 0.5, rate: 1, depth: 0.7, baseFrequency: 400, maxFrequency: 2000, q: 2, sensitivity: 0.7, attack: 0.01, release: 0.05, mix: 1 },
  overdrive: { enabled: false, drive: 0.3, tone: 0.5, level: 0.7 },
  distortion: { enabled: false, type: 'classic', amount: 0.5, tone: 0.5, level: 0.7 },
  ampSimulator: { enabled: false, type: 'clean', gain: 0.5, bass: 0.5, mid: 0.5, treble: 0.5, presence: 0.5, master: 0.7 },
  cabinet: { enabled: false, type: '2x12', micPosition: 'center', mix: 1, roomLevel: 0.2 },
  noiseGate: { enabled: false, threshold: -40, attack: 1, hold: 50, release: 100, range: -80 },
  eq: { enabled: false, bands: [{ frequency: 80, gain: 0, q: 1, type: 'lowshelf' }, { frequency: 250, gain: 0, q: 1, type: 'peaking' }, { frequency: 1000, gain: 0, q: 1, type: 'peaking' }, { frequency: 3000, gain: 0, q: 1, type: 'peaking' }, { frequency: 8000, gain: 0, q: 1, type: 'highshelf' }] },
  compressor: { enabled: false, threshold: -20, ratio: 4, attack: 10, release: 100, knee: 6, makeupGain: 0 },
  chorus: { enabled: false, rate: 0.5, depth: 0.3, delay: 10, feedback: 0.2, spread: 90, mix: 0.5 },
  flanger: { enabled: false, rate: 0.3, depth: 0.5, delay: 2, feedback: 0.6, mix: 0.5, negative: false },
  phaser: { enabled: false, rate: 0.5, depth: 0.5, baseFrequency: 1000, octaves: 2, stages: 4, feedback: 0.5, q: 1, mix: 0.5 },
  delay: { enabled: false, type: 'digital', time: 0.375, feedback: 0.3, mix: 0.3, tone: 0.8, modulation: 0.1, pingPongSpread: 0.5, tempo: 120, tempoSync: false, subdivision: '1/4' },
  tremolo: { enabled: false, rate: 4, depth: 0.5, spread: 0, waveform: 'sine' },
  reverb: { enabled: false, type: 'hall', mix: 0.3, decay: 2, preDelay: 20, highCut: 8000, lowCut: 100 },
  limiter: { enabled: false, threshold: -3, release: 100, ceiling: -0.3 },
};

// Extended effects (new effects on top of unified)
export const DEFAULT_EXTENDED_EFFECTS: Omit<ExtendedEffectsChain, keyof typeof DEFAULT_UNIFIED_EFFECTS> = {
  pitchCorrection: { enabled: false, key: 'C', scale: 'major', speed: 50, humanize: 30, formantPreserve: true, detune: 0, mix: 100 },
  vocalDoubler: { enabled: false, detune: 8, delay: 15, spread: 50, depth: 20, mix: 50, voices: 2 },
  deEsser: { enabled: false, frequency: 6000, threshold: -20, reduction: 6, range: 12, attack: 0.5, release: 50, mode: 'split', listenMode: false },
  formantShifter: { enabled: false, shift: 0, gender: 0, preservePitch: true, mix: 100 },
  harmonizer: { enabled: false, key: 'C', scale: 'major', harmonyType: 'third', customIntervals: [], voices: 1, spread: 50, shift: 0, mix: 50, keyLock: true },
  bitcrusher: { enabled: false, bits: 8, sampleRate: 22050, mix: 100, dither: false },
  ringModulator: { enabled: false, frequency: 440, waveform: 'sine', mix: 50, lfoRate: 0, lfoDepth: 0 },
  frequencyShifter: { enabled: false, shift: 0, feedback: 0, mix: 100, direction: 'up' },
  granularDelay: { enabled: false, grainSize: 100, density: 50, pitch: 0, pitchRandom: 0, position: 250, positionRandom: 0, feedback: 30, spread: 50, reverse: 0, mix: 50, freeze: false },
  rotarySpeaker: { enabled: false, speed: 'slow', hornLevel: 100, drumLevel: 100, distance: 50, drive: 0, mix: 100 },
  autoPan: { enabled: false, rate: 1, depth: 50, waveform: 'sine', phase: 0, tempoSync: false, subdivision: '1/4', width: 100 },
  multiFilter: { enabled: false, type: 'lowpass', frequency: 1000, resonance: 1, drive: 0, lfoRate: 0, lfoDepth: 0, lfoWaveform: 'sine', envelopeAmount: 0, envelopeSensitivity: 50, envelopeAttack: 10, envelopeRelease: 100, keyTrack: 0, tempoSync: false, subdivision: '1/4', mix: 100 },
  vibrato: { enabled: false, rate: 5, depth: 30, waveform: 'sine', stereo: 0, tempoSync: false, subdivision: '1/4' },
  transientShaper: { enabled: false, attack: 0, sustain: 0, attackTime: 10, releaseTime: 50, output: 0 },
  stereoImager: { enabled: false, width: 100, midLevel: 0, sideLevel: 0, bassMonoFreq: 100, bassMonoAmount: 0, balance: 0 },
  exciter: { enabled: false, frequency: 3000, amount: 50, harmonics: 'both', color: 50, mix: 50 },
  multibandCompressor: { enabled: false, lowCrossover: 200, highCrossover: 4000, low: { threshold: -20, ratio: 3, attack: 10, release: 100, gain: 0, solo: false, bypass: false }, mid: { threshold: -20, ratio: 3, attack: 10, release: 100, gain: 0, solo: false, bypass: false }, high: { threshold: -20, ratio: 3, attack: 10, release: 100, gain: 0, solo: false, bypass: false }, outputGain: 0 },
  stereoDelay: { enabled: false, leftTime: 250, rightTime: 375, leftFeedback: 30, rightFeedback: 30, crossFeed: 0, tone: 80, tempoSync: false, leftSubdivision: '1/4', rightSubdivision: '1/4 dot', pingPong: false, mix: 30 },
  roomSimulator: { enabled: false, size: 'medium', damping: 50, earlyLevel: 70, lateLevel: 50, decay: 1.5, preDelay: 10, diffusion: 70, modulation: 20, mix: 30 },
  shimmerReverb: { enabled: false, decay: 4, shimmer: 50, pitch: 12, damping: 50, tone: 70, modulation: 30, preDelay: 30, diffusion: 80, mix: 40 },
};

// Full effects chain (unified + extended)
export const DEFAULT_FULL_EFFECTS: ExtendedEffectsChain = {
  ...DEFAULT_UNIFIED_EFFECTS,
  ...DEFAULT_EXTENDED_EFFECTS,
};

// Master effects chain defaults
export const DEFAULT_MASTER_EFFECTS: MasterEffectsChain = {
  eq: {
    enabled: false,
    bands: [
      { frequency: 80, gain: 0, q: 1, type: 'lowshelf' },
      { frequency: 250, gain: 0, q: 1, type: 'peaking' },
      { frequency: 1000, gain: 0, q: 1, type: 'peaking' },
      { frequency: 3000, gain: 0, q: 1, type: 'peaking' },
      { frequency: 8000, gain: 0, q: 1, type: 'highshelf' },
    ],
  },
  compressor: {
    enabled: false,
    threshold: -12,
    ratio: 2,
    attack: 20,
    release: 200,
    knee: 10,
    makeupGain: 0,
  },
  reverb: {
    enabled: false,
    type: 'hall',
    mix: 0.15,
    decay: 2,
    preDelay: 20,
    highCut: 8000,
    lowCut: 100,
  },
  limiter: {
    enabled: true, // Limiter on by default for safety
    threshold: -1,
    release: 100,
    ceiling: -0.3,
    lookahead: 5,
    linkChannels: true,
  },
};
