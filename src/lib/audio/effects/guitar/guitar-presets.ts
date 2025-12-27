// Guitar Effect Presets
// A collection of professionally crafted presets for various guitar tones

import type { GuitarEffectPreset, GuitarEffectsChain } from '@/types';
import { DEFAULT_GUITAR_EFFECTS } from './guitar-effects-processor';

// Helper to create a preset by merging with defaults
function createPreset(
  id: string,
  name: string,
  category: GuitarEffectPreset['category'],
  description: string,
  overrides: Partial<GuitarEffectsChain>
): GuitarEffectPreset {
  return {
    id,
    name,
    category,
    description,
    effects: {
      wah: { ...DEFAULT_GUITAR_EFFECTS.wah, ...overrides.wah },
      overdrive: { ...DEFAULT_GUITAR_EFFECTS.overdrive, ...overrides.overdrive },
      distortion: { ...DEFAULT_GUITAR_EFFECTS.distortion, ...overrides.distortion },
      ampSimulator: { ...DEFAULT_GUITAR_EFFECTS.ampSimulator, ...overrides.ampSimulator },
      cabinet: { ...DEFAULT_GUITAR_EFFECTS.cabinet, ...overrides.cabinet },
      chorus: { ...DEFAULT_GUITAR_EFFECTS.chorus, ...overrides.chorus },
      flanger: { ...DEFAULT_GUITAR_EFFECTS.flanger, ...overrides.flanger },
      phaser: { ...DEFAULT_GUITAR_EFFECTS.phaser, ...overrides.phaser },
      delay: { ...DEFAULT_GUITAR_EFFECTS.delay, ...overrides.delay },
      tremolo: { ...DEFAULT_GUITAR_EFFECTS.tremolo, ...overrides.tremolo },
    },
  };
}

export const GUITAR_PRESETS: GuitarEffectPreset[] = [
  // ============================================================================
  // CLEAN PRESETS
  // ============================================================================
  createPreset(
    'clean-sparkle',
    'Clean Sparkle',
    'clean',
    'Crystal clear clean tone with subtle chorus for shimmer',
    {
      ampSimulator: {
        enabled: true,
        type: 'american',
        gain: 0.2,
        bass: 0.4,
        mid: 0.5,
        treble: 0.7,
        presence: 0.6,
        master: 0.5,
      },
      cabinet: {
        enabled: true,
        type: '2x12',
        micPosition: 'center',
        mix: 1.0,
        roomLevel: 0.1,
      },
      chorus: {
        enabled: true,
        rate: 1.0,
        depth: 0.3,
        delay: 4,
        feedback: 0,
        spread: 120,
        mix: 0.25,
      },
    }
  ),

  createPreset(
    'clean-jazz',
    'Jazz Clean',
    'clean',
    'Warm, round jazz tone with rolled-off highs',
    {
      ampSimulator: {
        enabled: true,
        type: 'american',
        gain: 0.15,
        bass: 0.6,
        mid: 0.4,
        treble: 0.3,
        presence: 0.3,
        master: 0.5,
      },
      cabinet: {
        enabled: true,
        type: '1x15',
        micPosition: 'edge',
        mix: 1.0,
        roomLevel: 0.2,
      },
    }
  ),

  createPreset(
    'clean-funk',
    'Funk Quack',
    'funk',
    'Percussive clean tone with auto-wah for funky rhythm',
    {
      wah: {
        enabled: true,
        mode: 'envelope',
        frequency: 0.5,
        rate: 2,
        depth: 0.9,
        baseFrequency: 400,
        maxFrequency: 3000,
        q: 8,
        sensitivity: 0.7,
        attack: 0.02,
        release: 0.15,
        mix: 1,
      },
      ampSimulator: {
        enabled: true,
        type: 'american',
        gain: 0.25,
        bass: 0.5,
        mid: 0.6,
        treble: 0.6,
        presence: 0.5,
        master: 0.5,
      },
      cabinet: {
        enabled: true,
        type: '2x10',
        micPosition: 'center',
        mix: 1.0,
        roomLevel: 0.1,
      },
    }
  ),

  // ============================================================================
  // CRUNCH PRESETS
  // ============================================================================
  createPreset(
    'crunch-blues',
    'Blues Crunch',
    'blues',
    'Warm, responsive blues tone with just enough breakup',
    {
      overdrive: {
        enabled: true,
        drive: 0.4,
        tone: 0.5,
        level: 0.6,
      },
      ampSimulator: {
        enabled: true,
        type: 'british',
        gain: 0.4,
        bass: 0.5,
        mid: 0.6,
        treble: 0.5,
        presence: 0.4,
        master: 0.5,
      },
      cabinet: {
        enabled: true,
        type: '2x12',
        micPosition: 'blend',
        mix: 1.0,
        roomLevel: 0.2,
      },
      delay: {
        enabled: true,
        type: 'analog',
        time: 0.35,
        feedback: 0.25,
        mix: 0.2,
        tone: 0.6,
        modulation: 0.2,
        pingPongSpread: 0.5,
        tempo: 120,
        tempoSync: false,
        subdivision: '1/4',
      },
    }
  ),

  createPreset(
    'crunch-classic-rock',
    'Classic Rock',
    'classic-rock',
    'The iconic 70s/80s rock crunch tone',
    {
      overdrive: {
        enabled: true,
        drive: 0.5,
        tone: 0.55,
        level: 0.6,
      },
      ampSimulator: {
        enabled: true,
        type: 'british',
        gain: 0.55,
        bass: 0.5,
        mid: 0.65,
        treble: 0.55,
        presence: 0.5,
        master: 0.55,
      },
      cabinet: {
        enabled: true,
        type: '4x12',
        micPosition: 'center',
        mix: 1.0,
        roomLevel: 0.15,
      },
    }
  ),

  createPreset(
    'crunch-edge',
    'The Edge',
    'classic-rock',
    'Chimey crunch with rhythmic delay for U2-style tones',
    {
      overdrive: {
        enabled: true,
        drive: 0.35,
        tone: 0.6,
        level: 0.55,
      },
      ampSimulator: {
        enabled: true,
        type: 'british',
        gain: 0.35,
        bass: 0.4,
        mid: 0.5,
        treble: 0.65,
        presence: 0.6,
        master: 0.5,
      },
      cabinet: {
        enabled: true,
        type: '4x12',
        micPosition: 'center',
        mix: 1.0,
        roomLevel: 0.1,
      },
      delay: {
        enabled: true,
        type: 'digital',
        time: 0.375,
        feedback: 0.4,
        mix: 0.35,
        tone: 0.8,
        modulation: 0,
        pingPongSpread: 0.5,
        tempo: 120,
        tempoSync: true,
        subdivision: '1/8D',
      },
    }
  ),

  // ============================================================================
  // HIGH GAIN PRESETS
  // ============================================================================
  createPreset(
    'highgain-modern-rock',
    'Modern Rock',
    'modern-rock',
    'Tight, aggressive modern rock tone',
    {
      distortion: {
        enabled: true,
        amount: 0.6,
        type: 'rectifier',
        tone: 0.55,
        level: 0.55,
      },
      ampSimulator: {
        enabled: true,
        type: 'modern',
        gain: 0.65,
        bass: 0.55,
        mid: 0.5,
        treble: 0.6,
        presence: 0.55,
        master: 0.5,
      },
      cabinet: {
        enabled: true,
        type: '4x12',
        micPosition: 'center',
        mix: 1.0,
        roomLevel: 0.1,
      },
    }
  ),

  createPreset(
    'highgain-metal',
    'Metal Machine',
    'metal',
    'Crushing high-gain metal tone with scooped mids',
    {
      distortion: {
        enabled: true,
        amount: 0.8,
        type: 'rectifier',
        tone: 0.5,
        level: 0.5,
      },
      ampSimulator: {
        enabled: true,
        type: 'modern',
        gain: 0.8,
        bass: 0.7,
        mid: 0.35,
        treble: 0.65,
        presence: 0.6,
        master: 0.5,
      },
      cabinet: {
        enabled: true,
        type: '4x12',
        micPosition: 'center',
        mix: 1.0,
        roomLevel: 0.05,
      },
    }
  ),

  createPreset(
    'highgain-djent',
    'Djent',
    'metal',
    'Ultra-tight progressive metal tone for palm-muted riffs',
    {
      distortion: {
        enabled: true,
        amount: 0.75,
        type: 'rectifier',
        tone: 0.6,
        level: 0.5,
      },
      ampSimulator: {
        enabled: true,
        type: 'modern',
        gain: 0.7,
        bass: 0.5,
        mid: 0.55,
        treble: 0.7,
        presence: 0.7,
        master: 0.5,
      },
      cabinet: {
        enabled: true,
        type: '4x12',
        micPosition: 'center',
        mix: 1.0,
        roomLevel: 0,
      },
    }
  ),

  // ============================================================================
  // AMBIENT PRESETS
  // ============================================================================
  createPreset(
    'ambient-shimmer',
    'Shimmer Pad',
    'ambient',
    'Ethereal ambient texture with modulation and long delays',
    {
      ampSimulator: {
        enabled: true,
        type: 'clean',
        gain: 0.2,
        bass: 0.4,
        mid: 0.5,
        treble: 0.6,
        presence: 0.5,
        master: 0.5,
      },
      cabinet: {
        enabled: true,
        type: '2x12',
        micPosition: 'room',
        mix: 1.0,
        roomLevel: 0.4,
      },
      chorus: {
        enabled: true,
        rate: 0.8,
        depth: 0.5,
        delay: 5,
        feedback: 0.1,
        spread: 180,
        mix: 0.4,
      },
      delay: {
        enabled: true,
        type: 'digital',
        time: 0.5,
        feedback: 0.6,
        mix: 0.45,
        tone: 0.7,
        modulation: 0,
        pingPongSpread: 0.8,
        tempo: 120,
        tempoSync: false,
        subdivision: '1/4',
      },
      tremolo: {
        enabled: true,
        rate: 3,
        depth: 0.2,
        spread: 180,
        waveform: 'sine',
      },
    }
  ),

  createPreset(
    'ambient-swell',
    'Volume Swell',
    'ambient',
    'Slow attack for violin-like swells with lush reverb',
    {
      ampSimulator: {
        enabled: true,
        type: 'clean',
        gain: 0.2,
        bass: 0.5,
        mid: 0.5,
        treble: 0.5,
        presence: 0.4,
        master: 0.5,
      },
      cabinet: {
        enabled: true,
        type: '2x12',
        micPosition: 'room',
        mix: 1.0,
        roomLevel: 0.5,
      },
      chorus: {
        enabled: true,
        rate: 0.5,
        depth: 0.4,
        delay: 6,
        feedback: 0,
        spread: 160,
        mix: 0.3,
      },
      delay: {
        enabled: true,
        type: 'analog',
        time: 0.6,
        feedback: 0.5,
        mix: 0.4,
        tone: 0.6,
        modulation: 0.3,
        pingPongSpread: 0.6,
        tempo: 120,
        tempoSync: false,
        subdivision: '1/4',
      },
    }
  ),

  // ============================================================================
  // SPECIAL EFFECTS PRESETS
  // ============================================================================
  createPreset(
    'special-hendrix',
    'Purple Haze',
    'classic-rock',
    'Classic 60s psychedelic tone with fuzz and wah',
    {
      wah: {
        enabled: true,
        mode: 'auto',
        frequency: 0.5,
        rate: 0.8,
        depth: 0.7,
        baseFrequency: 400,
        maxFrequency: 2000,
        q: 6,
        sensitivity: 0.5,
        attack: 0.05,
        release: 0.2,
        mix: 1,
      },
      distortion: {
        enabled: true,
        amount: 0.7,
        type: 'fuzz',
        tone: 0.5,
        level: 0.5,
      },
      ampSimulator: {
        enabled: true,
        type: 'british',
        gain: 0.5,
        bass: 0.5,
        mid: 0.6,
        treble: 0.5,
        presence: 0.4,
        master: 0.5,
      },
      cabinet: {
        enabled: true,
        type: '4x12',
        micPosition: 'edge',
        mix: 1.0,
        roomLevel: 0.2,
      },
    }
  ),

  createPreset(
    'special-gilmour',
    'Comfortably Numb',
    'classic-rock',
    'Soaring lead tone with smooth sustain and lush delay',
    {
      overdrive: {
        enabled: true,
        drive: 0.55,
        tone: 0.5,
        level: 0.6,
      },
      distortion: {
        enabled: true,
        amount: 0.35,
        type: 'classic',
        tone: 0.55,
        level: 0.55,
      },
      ampSimulator: {
        enabled: true,
        type: 'british',
        gain: 0.45,
        bass: 0.5,
        mid: 0.55,
        treble: 0.5,
        presence: 0.45,
        master: 0.5,
      },
      cabinet: {
        enabled: true,
        type: '4x12',
        micPosition: 'blend',
        mix: 1.0,
        roomLevel: 0.2,
      },
      delay: {
        enabled: true,
        type: 'analog',
        time: 0.44,
        feedback: 0.35,
        mix: 0.3,
        tone: 0.6,
        modulation: 0.15,
        pingPongSpread: 0.5,
        tempo: 120,
        tempoSync: false,
        subdivision: '1/4',
      },
    }
  ),

  createPreset(
    'special-80s-synth',
    '80s Synth Guitar',
    'ambient',
    'Chorus and compression for that 80s clean synth-guitar sound',
    {
      ampSimulator: {
        enabled: true,
        type: 'american',
        gain: 0.25,
        bass: 0.4,
        mid: 0.5,
        treble: 0.65,
        presence: 0.6,
        master: 0.5,
      },
      cabinet: {
        enabled: true,
        type: '2x12',
        micPosition: 'center',
        mix: 1.0,
        roomLevel: 0.15,
      },
      chorus: {
        enabled: true,
        rate: 1.2,
        depth: 0.7,
        delay: 4,
        feedback: 0.1,
        spread: 180,
        mix: 0.6,
      },
      delay: {
        enabled: true,
        type: 'digital',
        time: 0.3,
        feedback: 0.3,
        mix: 0.25,
        tone: 0.85,
        modulation: 0,
        pingPongSpread: 0.7,
        tempo: 120,
        tempoSync: false,
        subdivision: '1/8',
      },
    }
  ),

  createPreset(
    'special-surf',
    'Surf Rock',
    'clean',
    'Wet spring reverb and tremolo for classic surf tones',
    {
      ampSimulator: {
        enabled: true,
        type: 'american',
        gain: 0.3,
        bass: 0.5,
        mid: 0.5,
        treble: 0.7,
        presence: 0.5,
        master: 0.5,
      },
      cabinet: {
        enabled: true,
        type: '2x10',
        micPosition: 'center',
        mix: 1.0,
        roomLevel: 0.1,
      },
      tremolo: {
        enabled: true,
        rate: 6,
        depth: 0.6,
        spread: 0,
        waveform: 'sine',
      },
    }
  ),

  createPreset(
    'special-jet-flanger',
    'Jet Flanger',
    'ambient',
    'Intense flanging effect for psychedelic textures',
    {
      ampSimulator: {
        enabled: true,
        type: 'clean',
        gain: 0.25,
        bass: 0.5,
        mid: 0.5,
        treble: 0.6,
        presence: 0.5,
        master: 0.5,
      },
      cabinet: {
        enabled: true,
        type: '2x12',
        micPosition: 'center',
        mix: 1.0,
        roomLevel: 0.1,
      },
      flanger: {
        enabled: true,
        rate: 0.15,
        depth: 0.8,
        delay: 3,
        feedback: 0.7,
        mix: 0.6,
        negative: false,
      },
    }
  ),

  createPreset(
    'special-phase-90',
    'Phase Shifter',
    'classic-rock',
    'Classic phaser for swirling rhythms',
    {
      ampSimulator: {
        enabled: true,
        type: 'british',
        gain: 0.35,
        bass: 0.5,
        mid: 0.55,
        treble: 0.55,
        presence: 0.5,
        master: 0.5,
      },
      cabinet: {
        enabled: true,
        type: '4x12',
        micPosition: 'center',
        mix: 1.0,
        roomLevel: 0.1,
      },
      phaser: {
        enabled: true,
        rate: 0.4,
        depth: 0.6,
        baseFrequency: 400,
        octaves: 3,
        stages: 4,
        feedback: 0.5,
        q: 1,
        mix: 0.5,
      },
    }
  ),

  // ============================================================================
  // ACOUSTIC SIMULATION
  // ============================================================================
  createPreset(
    'acoustic-sim',
    'Acoustic Simulator',
    'acoustic-sim',
    'Transform electric guitar into acoustic-like tone',
    {
      ampSimulator: {
        enabled: true,
        type: 'clean',
        gain: 0.15,
        bass: 0.3,
        mid: 0.4,
        treble: 0.75,
        presence: 0.65,
        master: 0.5,
      },
      cabinet: {
        enabled: true,
        type: '1x12',
        micPosition: 'edge',
        mix: 0.7,
        roomLevel: 0.3,
      },
      chorus: {
        enabled: true,
        rate: 0.8,
        depth: 0.15,
        delay: 3,
        feedback: 0,
        spread: 90,
        mix: 0.15,
      },
    }
  ),
];

/**
 * Get a guitar preset by ID
 */
export function getGuitarPreset(id: string): GuitarEffectPreset | undefined {
  return GUITAR_PRESETS.find((preset) => preset.id === id);
}

/**
 * Get all presets in a category
 */
export function getPresetsByCategory(
  category: GuitarEffectPreset['category']
): GuitarEffectPreset[] {
  return GUITAR_PRESETS.filter((preset) => preset.category === category);
}

/**
 * Get all preset categories with counts
 */
export function getPresetCategories(): { category: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const preset of GUITAR_PRESETS) {
    counts.set(preset.category, (counts.get(preset.category) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}
