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
  overdrive: { enabled: false, drive: 30, tone: 50, level: 70, asymmetry: 0.2 },
  distortion: { enabled: false, type: 'classic', gain: 50, tone: 50, level: 70, presence: 50 },
  ampSimulator: { enabled: false, type: 'clean', gain: 50, bass: 50, mid: 50, treble: 50, presence: 50, master: 70 },
  cabinet: { enabled: false, type: 'combo', size: 'medium', character: 'balanced', highCut: 8000, lowCut: 80 },
  noiseGate: { enabled: false, threshold: -40, attack: 1, hold: 50, release: 100, range: 80 },
  eq: { enabled: false, lowShelfFreq: 80, lowShelfGain: 0, lowMidFreq: 250, lowMidGain: 0, lowMidQ: 1, midFreq: 1000, midGain: 0, midQ: 1, highMidFreq: 3000, highMidGain: 0, highMidQ: 1, highShelfFreq: 8000, highShelfGain: 0 },
  compressor: { enabled: false, threshold: -20, ratio: 4, attack: 10, release: 100, knee: 6, makeupGain: 0, mix: 100 },
  chorus: { enabled: false, rate: 0.5, depth: 30, delay: 10, feedback: 20, mix: 50, stereoWidth: 100 },
  flanger: { enabled: false, rate: 0.3, depth: 50, delay: 2, feedback: 60, mix: 50, stereoPhase: 90 },
  phaser: { enabled: false, rate: 0.5, depth: 50, stages: 4, feedback: 50, mix: 50, stereoPhase: 90 },
  delay: { enabled: false, delayType: 'digital', time: 0.375, feedback: 30, mix: 30, tone: 80, modulation: 10, pingPong: false, tempoSync: false, subdivision: '1/4' },
  tremolo: { enabled: false, rate: 4, depth: 50, waveform: 'sine', stereoPhase: 0, tempoSync: false, subdivision: '1/8' },
  reverb: { enabled: false, type: 'hall', size: 50, decay: 2, damping: 50, predelay: 20, mix: 30, highCut: 8000, lowCut: 100, modulation: 20, stereoWidth: 100 },
  limiter: { enabled: false, threshold: -3, release: 100, lookahead: 5, ceiling: -0.3, linkChannels: true },
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
  granularDelay: { enabled: false, delayTime: 250, grainSize: 100, pitch: 0, spread: 50, texture: 50, mix: 50, feedback: 30 },
  rotarySpeaker: { enabled: false, speed: 'slow', hornLevel: 100, drumLevel: 100, drive: 0, mix: 100, acceleration: 50 },
  autoPan: { enabled: false, rate: 1, depth: 50, waveform: 'sine', phase: 0, tempoSync: false, subdivision: '1/4' },
  multiFilter: { enabled: false, filterType: 'lowpass', frequency: 1000, resonance: 1, drive: 0, envelope: 0, lfoRate: 0, lfoDepth: 0, mix: 100 },
  vibrato: { enabled: false, rate: 5, depth: 30, waveform: 'sine', stereo: false },
  transientShaper: { enabled: false, attack: 0, sustain: 0, attackTime: 10, releaseTime: 50, mix: 100, sensitivity: 50 },
  stereoImager: { enabled: false, width: 100, centerFocus: 0, lowWidth: 100, midWidth: 100, highWidth: 100, crossoverLow: 200, crossoverHigh: 4000 },
  exciter: { enabled: false, frequency: 3000, harmonics: 50, mix: 50, drive: 0 },
  multibandCompressor: { enabled: false, lowThreshold: -20, lowRatio: 3, lowAttack: 10, lowRelease: 100, lowGain: 0, midThreshold: -20, midRatio: 3, midAttack: 10, midRelease: 100, midGain: 0, highThreshold: -20, highRatio: 3, highAttack: 10, highRelease: 100, highGain: 0, crossoverLow: 200, crossoverHigh: 4000, solo: 'none' },
  stereoDelay: { enabled: false, leftTime: 250, rightTime: 375, leftFeedback: 30, rightFeedback: 30, crossFeedback: 0, highCut: 8000, lowCut: 100, mix: 30, tempoSync: false, leftSubdivision: '1/4', rightSubdivision: '1/4 dot' },
  roomSimulator: { enabled: false, roomType: 'studio', size: 50, damping: 50, earlyLevel: 70, lateLevel: 50, predelay: 10, mix: 30 },
  shimmerReverb: { enabled: false, size: 70, decay: 4, shimmer: 50, pitch: 12, damping: 50, predelay: 30, mix: 40, modulation: 30 },
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
    lowShelfFreq: 80,
    lowShelfGain: 0,
    lowMidFreq: 250,
    lowMidGain: 0,
    lowMidQ: 1,
    midFreq: 1000,
    midGain: 0,
    midQ: 1,
    highMidFreq: 3000,
    highMidGain: 0,
    highMidQ: 1,
    highShelfFreq: 8000,
    highShelfGain: 0,
  },
  compressor: {
    enabled: false,
    threshold: -12,
    ratio: 2,
    attack: 20,
    release: 200,
    knee: 10,
    makeupGain: 0,
    mix: 100,
  },
  reverb: {
    enabled: false,
    type: 'hall',
    size: 50,
    decay: 2,
    damping: 50,
    predelay: 20,
    mix: 15,
    highCut: 8000,
    lowCut: 100,
    modulation: 20,
    stereoWidth: 100,
  },
  limiter: {
    enabled: true, // Limiter on by default for safety
    threshold: -1,
    release: 100,
    lookahead: 5,
    ceiling: -0.3,
    linkChannels: true,
  },
};
