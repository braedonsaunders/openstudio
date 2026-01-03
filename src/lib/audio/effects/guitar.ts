// Guitar effect presets - settings definitions for guitar amp/effects simulation
// Actual effects processing is handled by native bridge

import type { GuitarEffectPreset, GuitarEffectsChain, GuitarPresetCategory } from '@/types';

// Default guitar effects settings (must match type definitions)
const DEFAULT_WAH = { enabled: false, mode: 'manual' as const, frequency: 0.5, rate: 1, depth: 0.7, baseFrequency: 400, maxFrequency: 2000, q: 2, sensitivity: 0.7, attack: 0.01, release: 0.05, mix: 1 };
const DEFAULT_OVERDRIVE = { enabled: false, drive: 0.3, tone: 0.5, level: 0.7 };
const DEFAULT_DISTORTION = { enabled: false, type: 'classic' as const, amount: 0.5, tone: 0.5, level: 0.7 };
const DEFAULT_AMP = { enabled: false, type: 'clean' as const, gain: 0.5, bass: 0.5, mid: 0.5, treble: 0.5, presence: 0.5, master: 0.7 };
const DEFAULT_CABINET = { enabled: false, type: '2x12' as const, micPosition: 'center' as const, mix: 1, roomLevel: 0.2 };
const DEFAULT_CHORUS = { enabled: false, rate: 0.5, depth: 0.3, delay: 10, feedback: 0.2, spread: 90, mix: 0.5 };
const DEFAULT_FLANGER = { enabled: false, rate: 0.3, depth: 0.5, delay: 2, feedback: 0.6, mix: 0.5, negative: false };
const DEFAULT_PHASER = { enabled: false, rate: 0.5, depth: 0.5, baseFrequency: 1000, octaves: 2, stages: 4, feedback: 0.5, q: 1, mix: 0.5 };
const DEFAULT_DELAY = { enabled: false, type: 'digital' as const, time: 0.375, feedback: 0.3, mix: 0.3, tone: 0.8, modulation: 0.1, pingPongSpread: 0.5, tempo: 120, tempoSync: false, subdivision: '1/4' as const };
const DEFAULT_TREMOLO = { enabled: false, rate: 4, depth: 0.5, spread: 0, waveform: 'sine' as const };

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

// Guitar presets (values normalized to 0-1 range)
export const GUITAR_PRESETS: GuitarEffectPreset[] = [
  // Clean tones
  {
    id: 'clean-warm',
    name: 'Clean Warm',
    category: 'clean',
    description: 'Warm, jazzy clean tone',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'clean', gain: 0.35, bass: 0.55, mid: 0.5, treble: 0.45, master: 0.65 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '1x12' },
    },
  },
  {
    id: 'clean-bright',
    name: 'Clean Bright',
    category: 'clean',
    description: 'Bright, sparkly clean tone',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'clean', gain: 0.4, bass: 0.45, mid: 0.5, treble: 0.6, presence: 0.55, master: 0.65 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '1x12' },
      chorus: { ...DEFAULT_CHORUS, enabled: true, rate: 0.4, depth: 0.25, mix: 0.3 },
    },
  },
  {
    id: 'clean-chimey',
    name: 'Chimey Clean',
    category: 'clean',
    description: 'Bell-like clean with chorus',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'clean', gain: 0.3, bass: 0.4, mid: 0.55, treble: 0.65, presence: 0.6, master: 0.6 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '1x12' },
      chorus: { ...DEFAULT_CHORUS, enabled: true, rate: 0.6, depth: 0.35, mix: 0.4 },
      delay: { ...DEFAULT_DELAY, enabled: true, time: 0.3, feedback: 0.2, mix: 0.15 },
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
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'crunch', gain: 0.55, bass: 0.5, mid: 0.55, treble: 0.55, master: 0.7 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '4x12' },
    },
  },
  {
    id: 'crunch-modern',
    name: 'Modern Crunch',
    category: 'crunch',
    description: 'Tight, modern crunch tone',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      overdrive: { ...DEFAULT_OVERDRIVE, enabled: true, drive: 0.4, tone: 0.55, level: 0.75 },
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'crunch', gain: 0.5, bass: 0.45, mid: 0.6, treble: 0.55, presence: 0.55, master: 0.65 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '4x12' },
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
      overdrive: { ...DEFAULT_OVERDRIVE, enabled: true, drive: 0.5, tone: 0.6, level: 0.8 },
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'highgain', gain: 0.7, bass: 0.45, mid: 0.55, treble: 0.55, presence: 0.6, master: 0.7 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '4x12' },
    },
  },
  {
    id: 'high-gain-lead',
    name: 'Lead Tone',
    category: 'high-gain',
    description: 'Smooth lead tone with sustain',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      overdrive: { ...DEFAULT_OVERDRIVE, enabled: true, drive: 0.55, tone: 0.5, level: 0.75 },
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'highgain', gain: 0.65, bass: 0.5, mid: 0.6, treble: 0.5, presence: 0.55, master: 0.7 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '4x12' },
      delay: { ...DEFAULT_DELAY, enabled: true, time: 0.35, feedback: 0.25, mix: 0.2 },
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
      overdrive: { ...DEFAULT_OVERDRIVE, enabled: true, drive: 0.6, tone: 0.65, level: 0.85 },
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'highgain', gain: 0.8, bass: 0.5, mid: 0.45, treble: 0.6, presence: 0.65, master: 0.75 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '4x12' },
    },
  },
  {
    id: 'metal-lead',
    name: 'Metal Lead',
    category: 'metal',
    description: 'Screaming metal lead tone',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      overdrive: { ...DEFAULT_OVERDRIVE, enabled: true, drive: 0.7, tone: 0.55, level: 0.8 },
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'highgain', gain: 0.85, bass: 0.45, mid: 0.6, treble: 0.55, presence: 0.6, master: 0.7 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '4x12' },
      delay: { ...DEFAULT_DELAY, enabled: true, time: 0.4, feedback: 0.3, mix: 0.25 },
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
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'clean', gain: 0.45, bass: 0.55, mid: 0.55, treble: 0.5, master: 0.65 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '1x12' },
      tremolo: { ...DEFAULT_TREMOLO, enabled: true, rate: 3, depth: 0.3 },
    },
  },
  {
    id: 'blues-driven',
    name: 'Blues Driven',
    category: 'blues',
    description: 'Classic blues breakup',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      overdrive: { ...DEFAULT_OVERDRIVE, enabled: true, drive: 0.45, tone: 0.45, level: 0.7 },
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'crunch', gain: 0.5, bass: 0.5, mid: 0.55, treble: 0.5, master: 0.7 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '1x12' },
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
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'crunch', gain: 0.6, bass: 0.55, mid: 0.55, treble: 0.55, master: 0.7 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '4x12' },
    },
  },
  {
    id: 'classic-rock-lead',
    name: 'Classic Rock Lead',
    category: 'classic-rock',
    description: '70s rock lead with sustain',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      overdrive: { ...DEFAULT_OVERDRIVE, enabled: true, drive: 0.5, tone: 0.5, level: 0.75 },
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'crunch', gain: 0.65, bass: 0.5, mid: 0.6, treble: 0.55, master: 0.7 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '4x12' },
      delay: { ...DEFAULT_DELAY, enabled: true, time: 0.35, feedback: 0.25, mix: 0.2 },
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
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'clean', gain: 0.4, bass: 0.45, mid: 0.55, treble: 0.55, master: 0.65 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '2x12' },
      chorus: { ...DEFAULT_CHORUS, enabled: true, rate: 0.5, depth: 0.3, mix: 0.35 },
      delay: { ...DEFAULT_DELAY, enabled: true, time: 0.4, feedback: 0.3, mix: 0.25 },
    },
  },
  {
    id: 'modern-rock-driven',
    name: 'Alt Rock Drive',
    category: 'modern-rock',
    description: 'Modern alternative driven tone',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      overdrive: { ...DEFAULT_OVERDRIVE, enabled: true, drive: 0.55, tone: 0.55, level: 0.75 },
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'highgain', gain: 0.6, bass: 0.5, mid: 0.55, treble: 0.55, presence: 0.55, master: 0.7 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '4x12' },
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
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'clean', gain: 0.35, bass: 0.4, mid: 0.55, treble: 0.6, presence: 0.55, master: 0.65 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '1x12' },
    },
  },
  {
    id: 'funk-wah',
    name: 'Funk Wah',
    category: 'funk',
    description: 'Auto-wah funk tone',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      wah: { ...DEFAULT_WAH, enabled: true, mode: 'auto', sensitivity: 0.75, baseFrequency: 350, maxFrequency: 2500 },
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'clean', gain: 0.4, bass: 0.45, mid: 0.55, treble: 0.55, master: 0.65 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '1x12' },
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
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'clean', gain: 0.3, bass: 0.4, mid: 0.5, treble: 0.55, master: 0.6 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '1x12' },
      chorus: { ...DEFAULT_CHORUS, enabled: true, rate: 0.3, depth: 0.45, mix: 0.4 },
      delay: { ...DEFAULT_DELAY, enabled: true, time: 0.5, feedback: 0.5, mix: 0.4 },
    },
  },
  {
    id: 'ambient-swell',
    name: 'Volume Swells',
    category: 'ambient',
    description: 'Ambient pad-like swells',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'clean', gain: 0.35, bass: 0.45, mid: 0.5, treble: 0.5, master: 0.6 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '1x12' },
      tremolo: { ...DEFAULT_TREMOLO, enabled: true, rate: 0.5, depth: 0.8 },
      delay: { ...DEFAULT_DELAY, enabled: true, time: 0.6, feedback: 0.55, mix: 0.45 },
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
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'clean', gain: 0.3, bass: 0.4, mid: 0.55, treble: 0.65, presence: 0.55, master: 0.6 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '1x12' },
    },
  },
  {
    id: 'acoustic-sim-warm',
    name: 'Acoustic Warm',
    category: 'acoustic-sim',
    description: 'Warm acoustic simulation',
    effects: {
      ...BASE_GUITAR_EFFECTS,
      ampSimulator: { ...DEFAULT_AMP, enabled: true, type: 'clean', gain: 0.35, bass: 0.5, mid: 0.55, treble: 0.5, master: 0.6 },
      cabinet: { ...DEFAULT_CABINET, enabled: true, type: '1x12' },
      chorus: { ...DEFAULT_CHORUS, enabled: true, rate: 0.4, depth: 0.2, mix: 0.2 },
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
