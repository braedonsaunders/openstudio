// Guitar effect presets - settings definitions for guitar amp/effects simulation
// Actual effects processing is handled by native bridge

import type { GuitarEffectPreset, GuitarEffectsChain, GuitarPresetCategory } from '@/types';

// Default guitar effects settings
const DEFAULT_WAH = { enabled: false, mode: 'manual' as const, position: 50, frequency: 800, resonance: 2, sensitivity: 70, attackTime: 1, releaseTime: 50, minFreq: 400, maxFreq: 2000, lfoRate: 1 };
const DEFAULT_OVERDRIVE = { enabled: false, drive: 30, tone: 50, level: 70, asymmetry: 0.2 };
const DEFAULT_DISTORTION = { enabled: false, type: 'classic' as const, gain: 50, tone: 50, level: 70, presence: 50 };
const DEFAULT_AMP = { enabled: false, type: 'clean' as const, gain: 50, bass: 50, mid: 50, treble: 50, presence: 50, master: 70 };
const DEFAULT_CABINET = { enabled: false, type: 'combo' as const, size: 'medium' as const, character: 'balanced' as const, highCut: 8000, lowCut: 80 };
const DEFAULT_CHORUS = { enabled: false, rate: 0.5, depth: 30, delay: 10, feedback: 20, mix: 50, stereoWidth: 100 };
const DEFAULT_FLANGER = { enabled: false, rate: 0.3, depth: 50, delay: 2, feedback: 60, mix: 50, stereoPhase: 90 };
const DEFAULT_PHASER = { enabled: false, rate: 0.5, depth: 50, stages: 4, feedback: 50, mix: 50, stereoPhase: 90 };
const DEFAULT_DELAY = { enabled: false, delayType: 'digital' as const, time: 0.375, feedback: 30, mix: 30, tone: 80, modulation: 10, pingPong: false, tempoSync: false, subdivision: '1/4' as const };
const DEFAULT_TREMOLO = { enabled: false, rate: 4, depth: 50, waveform: 'sine' as const, spread: 0 };

// Base guitar effects chain
const BASE_GUITAR_EFFECTS: GuitarEffectsChain = {
  wah: DEFAULT_WAH,
  overdrive: DEFAULT_OVERDRIVE,
  distortion: DEFAULT_DISTORTION,
  ampSimulator: DEFAULT_AMP,
  cabinet: DEFAULT_CABINET,
  chorus: DEFAULT_CHORUS,
  flanger: DEFAULT_FLANGER,
  phaser: DEFAULT_PHASER,
  delay: DEFAULT_DELAY,
  tremolo: DEFAULT_TREMOLO,
};

// Guitar presets
export const GUITAR_PRESETS: GuitarEffectPreset[] = [
  // Clean tones
  {
    id: 'clean-warm',
    name: 'Clean Warm',
    category: 'clean',
    description: 'Warm, jazzy clean tone',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'clean', gain: 35, bass: 55, mid: 50, treble: 45, master: 65 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'combo', character: 'warm' },
    },
  },
  {
    id: 'clean-bright',
    name: 'Clean Bright',
    category: 'clean',
    description: 'Bright, sparkly clean tone',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'clean', gain: 40, bass: 45, mid: 50, treble: 60, presence: 55, master: 65 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'combo', character: 'bright' },
      chorus: { ...DEFAULT_CHORUS, enabled: true, rate: 0.4, depth: 25, mix: 30 },
    },
  },
  {
    id: 'clean-chimey',
    name: 'Chimey Clean',
    category: 'clean',
    description: 'Bell-like clean with chorus',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'clean', gain: 30, bass: 40, mid: 55, treble: 65, presence: 60, master: 60 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'combo', character: 'bright' },
      chorus: { ...DEFAULT_CHORUS, enabled: true, rate: 0.6, depth: 35, mix: 40 },
      delay: { ...DEFAULT_DELAY, enabled: true, time: 0.3, feedback: 20, mix: 15 },
    },
  },

  // Crunch tones
  {
    id: 'crunch-classic',
    name: 'Classic Crunch',
    category: 'crunch',
    description: 'Edge-of-breakup classic rock tone',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'crunch', gain: 55, bass: 50, mid: 55, treble: 55, master: 70 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'stack4x12', character: 'balanced' },
    },
  },
  {
    id: 'crunch-modern',
    name: 'Modern Crunch',
    category: 'crunch',
    description: 'Tight, modern crunch tone',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      overdrive: { ...DEFAULT_OVERDRIVE, enabled: true, drive: 40, tone: 55, level: 75 },
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'crunch', gain: 50, bass: 45, mid: 60, treble: 55, presence: 55, master: 65 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'stack4x12', character: 'tight' },
    },
  },

  // High gain
  {
    id: 'high-gain-modern',
    name: 'Modern High Gain',
    category: 'high-gain',
    description: 'Tight, modern high gain',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      overdrive: { ...DEFAULT_OVERDRIVE, enabled: true, drive: 50, tone: 60, level: 80 },
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'highgain', gain: 70, bass: 45, mid: 55, treble: 55, presence: 60, master: 70 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'stack4x12', character: 'tight' },
    },
  },
  {
    id: 'high-gain-lead',
    name: 'Lead Tone',
    category: 'high-gain',
    description: 'Smooth lead tone with sustain',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      overdrive: { ...DEFAULT_OVERDRIVE, enabled: true, drive: 55, tone: 50, level: 75 },
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'highgain', gain: 65, bass: 50, mid: 60, treble: 50, presence: 55, master: 70 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'stack4x12', character: 'warm' },
      delay: { ...DEFAULT_DELAY, enabled: true, time: 0.35, feedback: 25, mix: 20 },
    },
  },

  // Metal
  {
    id: 'metal-rhythm',
    name: 'Metal Rhythm',
    category: 'metal',
    description: 'Tight, aggressive rhythm tone',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      overdrive: { ...DEFAULT_OVERDRIVE, enabled: true, drive: 60, tone: 65, level: 85 },
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'highgain', gain: 80, bass: 50, mid: 45, treble: 60, presence: 65, master: 75 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'stack4x12', character: 'tight' },
    },
  },
  {
    id: 'metal-lead',
    name: 'Metal Lead',
    category: 'metal',
    description: 'Screaming metal lead tone',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      overdrive: { ...DEFAULT_OVERDRIVE, enabled: true, drive: 70, tone: 55, level: 80 },
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'highgain', gain: 85, bass: 45, mid: 60, treble: 55, presence: 60, master: 70 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'stack4x12', character: 'balanced' },
      delay: { ...DEFAULT_DELAY, enabled: true, time: 0.4, feedback: 30, mix: 25 },
    },
  },

  // Blues
  {
    id: 'blues-clean',
    name: 'Blues Clean',
    category: 'blues',
    description: 'Warm, bluesy clean tone',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'clean', gain: 45, bass: 55, mid: 55, treble: 50, master: 65 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'combo', character: 'warm' },
      tremolo: { ...DEFAULT_TREMOLO, enabled: true, rate: 3, depth: 30 },
    },
  },
  {
    id: 'blues-driven',
    name: 'Blues Driven',
    category: 'blues',
    description: 'Classic blues breakup',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      overdrive: { ...DEFAULT_OVERDRIVE, enabled: true, drive: 45, tone: 45, level: 70 },
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'crunch', gain: 50, bass: 50, mid: 55, treble: 50, master: 70 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'combo', character: 'warm' },
    },
  },

  // Classic Rock
  {
    id: 'classic-rock-rhythm',
    name: 'Classic Rock Rhythm',
    category: 'classic-rock',
    description: '70s rock rhythm tone',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'crunch', gain: 60, bass: 55, mid: 55, treble: 55, master: 70 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'stack4x12', character: 'vintage' },
    },
  },
  {
    id: 'classic-rock-lead',
    name: 'Classic Rock Lead',
    category: 'classic-rock',
    description: '70s rock lead with sustain',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      overdrive: { ...DEFAULT_OVERDRIVE, enabled: true, drive: 50, tone: 50, level: 75 },
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'crunch', gain: 65, bass: 50, mid: 60, treble: 55, master: 70 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'stack4x12', character: 'vintage' },
      delay: { ...DEFAULT_DELAY, enabled: true, time: 0.35, feedback: 25, mix: 20 },
    },
  },

  // Modern Rock
  {
    id: 'modern-rock-clean',
    name: 'Alt Rock Clean',
    category: 'modern-rock',
    description: 'Modern alternative clean',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'clean', gain: 40, bass: 45, mid: 55, treble: 55, master: 65 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'combo', character: 'balanced' },
      chorus: { ...DEFAULT_CHORUS, enabled: true, rate: 0.5, depth: 30, mix: 35 },
      delay: { ...DEFAULT_DELAY, enabled: true, time: 0.4, feedback: 30, mix: 25 },
    },
  },
  {
    id: 'modern-rock-driven',
    name: 'Alt Rock Drive',
    category: 'modern-rock',
    description: 'Modern alternative driven tone',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      overdrive: { ...DEFAULT_OVERDRIVE, enabled: true, drive: 55, tone: 55, level: 75 },
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'highgain', gain: 60, bass: 50, mid: 55, treble: 55, presence: 55, master: 70 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'stack4x12', character: 'balanced' },
    },
  },

  // Funk
  {
    id: 'funk-clean',
    name: 'Funk Clean',
    category: 'funk',
    description: 'Snappy funk clean tone',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'clean', gain: 35, bass: 40, mid: 55, treble: 60, presence: 55, master: 65 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'combo', character: 'bright' },
    },
  },
  {
    id: 'funk-wah',
    name: 'Funk Wah',
    category: 'funk',
    description: 'Auto-wah funk tone',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      wah: { ...DEFAULT_WAH, enabled: true, mode: 'auto', sensitivity: 75, minFreq: 350, maxFreq: 2500 },
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'clean', gain: 40, bass: 45, mid: 55, treble: 55, master: 65 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'combo', character: 'balanced' },
    },
  },

  // Ambient
  {
    id: 'ambient-shimmer',
    name: 'Shimmer',
    category: 'ambient',
    description: 'Ethereal shimmer textures',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'clean', gain: 30, bass: 40, mid: 50, treble: 55, master: 60 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'combo', character: 'warm' },
      chorus: { ...DEFAULT_CHORUS, enabled: true, rate: 0.3, depth: 45, mix: 40 },
      delay: { ...DEFAULT_DELAY, enabled: true, time: 0.5, feedback: 50, mix: 40 },
    },
  },
  {
    id: 'ambient-swell',
    name: 'Volume Swells',
    category: 'ambient',
    description: 'Ambient pad-like swells',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'clean', gain: 35, bass: 45, mid: 50, treble: 50, master: 60 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'combo', character: 'warm' },
      tremolo: { ...DEFAULT_TREMOLO, enabled: true, rate: 0.5, depth: 80 },
      delay: { ...DEFAULT_DELAY, enabled: true, time: 0.6, feedback: 55, mix: 45 },
    },
  },

  // Acoustic sim
  {
    id: 'acoustic-sim-bright',
    name: 'Acoustic Bright',
    category: 'acoustic-sim',
    description: 'Bright acoustic simulation',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'acoustic', gain: 30, bass: 40, mid: 55, treble: 65, presence: 55, master: 60 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'combo', character: 'bright', highCut: 12000 },
    },
  },
  {
    id: 'acoustic-sim-warm',
    name: 'Acoustic Warm',
    category: 'acoustic-sim',
    description: 'Warm acoustic simulation',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'acoustic', gain: 35, bass: 50, mid: 55, treble: 50, master: 60 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: 'combo', character: 'warm', highCut: 8000 },
      chorus: { ...DEFAULT_CHORUS, enabled: true, rate: 0.4, depth: 20, mix: 20 },
    },
  },
];

// Helper to get presets by category
export function getPresetsByCategory(category: GuitarPresetCategory): GuitarEffectPreset[] {
  return GUITAR_PRESETS.filter((p) => p.category === category);
}

// Get default guitar effects chain
export function getDefaultGuitarEffects(): GuitarEffectsChain {
  return { ...BASE_GUITAR_EFFECTS };
}
