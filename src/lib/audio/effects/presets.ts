// Effect Presets - Professional presets for various instruments and use cases

import type {
  TrackEffectsChain,
  EffectPreset,
  EffectPresetType,
  NoiseGateSettings,
  EQSettings,
  CompressorSettings,
  ReverbSettings,
  LimiterSettings,
} from '@/types';

// Default settings for each effect
export const DEFAULT_NOISE_GATE: NoiseGateSettings = {
  enabled: false,
  threshold: -40,
  attack: 1,
  hold: 50,
  release: 100,
  range: -80,
};

export const DEFAULT_EQ: EQSettings = {
  enabled: false,
  bands: [
    { frequency: 80, gain: 0, q: 0.7, type: 'lowshelf' },
    { frequency: 400, gain: 0, q: 1.0, type: 'peaking' },
    { frequency: 2500, gain: 0, q: 1.0, type: 'peaking' },
    { frequency: 8000, gain: 0, q: 0.7, type: 'highshelf' },
  ],
};

export const DEFAULT_COMPRESSOR: CompressorSettings = {
  enabled: false,
  threshold: -24,
  ratio: 4,
  attack: 10,
  release: 100,
  knee: 10,
  makeupGain: 0,
};

export const DEFAULT_REVERB: ReverbSettings = {
  enabled: false,
  type: 'room',
  mix: 0.2,
  decay: 1.5,
  preDelay: 20,
  highCut: 8000,
  lowCut: 200,
};

export const DEFAULT_LIMITER: LimiterSettings = {
  enabled: false,
  threshold: -3,
  release: 100,
  ceiling: -0.3,
};

// Default effects chain (all effects disabled)
export const DEFAULT_EFFECTS_CHAIN: TrackEffectsChain = {
  noiseGate: DEFAULT_NOISE_GATE,
  eq: DEFAULT_EQ,
  compressor: DEFAULT_COMPRESSOR,
  reverb: DEFAULT_REVERB,
  limiter: DEFAULT_LIMITER,
};

// Professional presets
export const EFFECT_PRESETS: EffectPreset[] = [
  // Clean - No processing
  {
    id: 'clean',
    name: 'Clean',
    type: 'clean',
    effects: DEFAULT_EFFECTS_CHAIN,
  },

  // Vocal preset
  {
    id: 'vocal-warm',
    name: 'Warm Vocal',
    type: 'vocal',
    effects: {
      noiseGate: {
        enabled: true,
        threshold: -45,
        attack: 0.5,
        hold: 30,
        release: 80,
        range: -60,
      },
      eq: {
        enabled: true,
        bands: [
          { frequency: 80, gain: -6, q: 0.7, type: 'highpass' }, // Remove rumble
          { frequency: 200, gain: 2, q: 0.8, type: 'peaking' }, // Add warmth
          { frequency: 3000, gain: 3, q: 1.2, type: 'peaking' }, // Presence
          { frequency: 10000, gain: 2, q: 0.7, type: 'highshelf' }, // Air
        ],
      },
      compressor: {
        enabled: true,
        threshold: -18,
        ratio: 3,
        attack: 15,
        release: 150,
        knee: 10,
        makeupGain: 4,
      },
      reverb: {
        enabled: true,
        type: 'room',
        mix: 0.15,
        decay: 1.2,
        preDelay: 25,
        highCut: 7000,
        lowCut: 300,
      },
      limiter: {
        enabled: true,
        threshold: -2,
        release: 50,
        ceiling: -0.3,
      },
    },
  },

  // Bright vocal
  {
    id: 'vocal-bright',
    name: 'Bright Vocal',
    type: 'vocal',
    effects: {
      noiseGate: {
        enabled: true,
        threshold: -42,
        attack: 0.5,
        hold: 25,
        release: 60,
        range: -50,
      },
      eq: {
        enabled: true,
        bands: [
          { frequency: 100, gain: -8, q: 0.7, type: 'highpass' },
          { frequency: 400, gain: -2, q: 1.0, type: 'peaking' }, // Reduce mud
          { frequency: 4000, gain: 4, q: 1.5, type: 'peaking' }, // Presence
          { frequency: 12000, gain: 3, q: 0.7, type: 'highshelf' }, // Brilliance
        ],
      },
      compressor: {
        enabled: true,
        threshold: -20,
        ratio: 4,
        attack: 8,
        release: 120,
        knee: 6,
        makeupGain: 5,
      },
      reverb: {
        enabled: true,
        type: 'plate',
        mix: 0.2,
        decay: 1.8,
        preDelay: 30,
        highCut: 10000,
        lowCut: 400,
      },
      limiter: {
        enabled: true,
        threshold: -1,
        release: 40,
        ceiling: -0.2,
      },
    },
  },

  // Electric guitar
  {
    id: 'guitar-clean',
    name: 'Clean Guitar',
    type: 'guitar',
    effects: {
      noiseGate: {
        enabled: true,
        threshold: -50,
        attack: 1,
        hold: 40,
        release: 100,
        range: -70,
      },
      eq: {
        enabled: true,
        bands: [
          { frequency: 80, gain: -4, q: 0.7, type: 'lowshelf' },
          { frequency: 250, gain: 1, q: 0.8, type: 'peaking' },
          { frequency: 2000, gain: 2, q: 1.0, type: 'peaking' },
          { frequency: 6000, gain: 3, q: 0.7, type: 'highshelf' },
        ],
      },
      compressor: {
        enabled: true,
        threshold: -15,
        ratio: 2.5,
        attack: 20,
        release: 200,
        knee: 15,
        makeupGain: 3,
      },
      reverb: {
        enabled: true,
        type: 'spring',
        mix: 0.25,
        decay: 1.0,
        preDelay: 10,
        highCut: 5000,
        lowCut: 150,
      },
      limiter: DEFAULT_LIMITER,
    },
  },

  // Acoustic guitar
  {
    id: 'acoustic',
    name: 'Acoustic Guitar',
    type: 'acoustic',
    effects: {
      noiseGate: {
        enabled: true,
        threshold: -55,
        attack: 0.5,
        hold: 30,
        release: 80,
        range: -60,
      },
      eq: {
        enabled: true,
        bands: [
          { frequency: 80, gain: -3, q: 0.7, type: 'lowshelf' },
          { frequency: 200, gain: -2, q: 1.2, type: 'peaking' }, // Reduce boominess
          { frequency: 3500, gain: 3, q: 1.0, type: 'peaking' }, // String presence
          { frequency: 10000, gain: 2, q: 0.7, type: 'highshelf' }, // Shimmer
        ],
      },
      compressor: {
        enabled: true,
        threshold: -18,
        ratio: 3,
        attack: 25,
        release: 250,
        knee: 12,
        makeupGain: 4,
      },
      reverb: {
        enabled: true,
        type: 'room',
        mix: 0.2,
        decay: 1.3,
        preDelay: 15,
        highCut: 9000,
        lowCut: 200,
      },
      limiter: DEFAULT_LIMITER,
    },
  },

  // Bass
  {
    id: 'bass-punchy',
    name: 'Punchy Bass',
    type: 'bass',
    effects: {
      noiseGate: {
        enabled: true,
        threshold: -55,
        attack: 2,
        hold: 50,
        release: 120,
        range: -70,
      },
      eq: {
        enabled: true,
        bands: [
          { frequency: 40, gain: 3, q: 0.7, type: 'lowshelf' }, // Sub bass
          { frequency: 150, gain: 2, q: 1.0, type: 'peaking' }, // Fundamental
          { frequency: 800, gain: -3, q: 1.5, type: 'peaking' }, // Reduce mud
          { frequency: 2500, gain: 4, q: 1.0, type: 'peaking' }, // Attack/definition
        ],
      },
      compressor: {
        enabled: true,
        threshold: -12,
        ratio: 5,
        attack: 5,
        release: 80,
        knee: 6,
        makeupGain: 6,
      },
      reverb: {
        enabled: false,
        type: 'room',
        mix: 0.05,
        decay: 0.5,
        preDelay: 0,
        highCut: 2000,
        lowCut: 150,
      },
      limiter: {
        enabled: true,
        threshold: -4,
        release: 60,
        ceiling: -0.5,
      },
    },
  },

  // Drums/Percussion
  {
    id: 'drums',
    name: 'Drums',
    type: 'drums',
    effects: {
      noiseGate: {
        enabled: true,
        threshold: -35,
        attack: 0.2,
        hold: 20,
        release: 50,
        range: -50,
      },
      eq: {
        enabled: true,
        bands: [
          { frequency: 60, gain: 4, q: 0.8, type: 'lowshelf' }, // Kick punch
          { frequency: 400, gain: -2, q: 1.0, type: 'peaking' }, // Reduce boxiness
          { frequency: 3000, gain: 3, q: 1.2, type: 'peaking' }, // Snare crack
          { frequency: 10000, gain: 4, q: 0.7, type: 'highshelf' }, // Cymbals
        ],
      },
      compressor: {
        enabled: true,
        threshold: -16,
        ratio: 4,
        attack: 2,
        release: 60,
        knee: 3,
        makeupGain: 5,
      },
      reverb: {
        enabled: true,
        type: 'room',
        mix: 0.1,
        decay: 0.8,
        preDelay: 5,
        highCut: 6000,
        lowCut: 200,
      },
      limiter: {
        enabled: true,
        threshold: -3,
        release: 30,
        ceiling: -0.3,
      },
    },
  },

  // Keys/Piano
  {
    id: 'keys',
    name: 'Keys/Piano',
    type: 'keys',
    effects: {
      noiseGate: DEFAULT_NOISE_GATE,
      eq: {
        enabled: true,
        bands: [
          { frequency: 80, gain: -2, q: 0.7, type: 'lowshelf' },
          { frequency: 300, gain: 1, q: 0.8, type: 'peaking' },
          { frequency: 2500, gain: 2, q: 1.0, type: 'peaking' },
          { frequency: 8000, gain: 2, q: 0.7, type: 'highshelf' },
        ],
      },
      compressor: {
        enabled: true,
        threshold: -20,
        ratio: 2,
        attack: 30,
        release: 200,
        knee: 20,
        makeupGain: 2,
      },
      reverb: {
        enabled: true,
        type: 'hall',
        mix: 0.25,
        decay: 2.0,
        preDelay: 30,
        highCut: 10000,
        lowCut: 150,
      },
      limiter: DEFAULT_LIMITER,
    },
  },
];

// Helper function to get preset by type
export function getPresetByType(type: EffectPresetType): EffectPreset | undefined {
  return EFFECT_PRESETS.find((p) => p.type === type);
}

// Helper function to get preset by ID
export function getPresetById(id: string): EffectPreset | undefined {
  return EFFECT_PRESETS.find((p) => p.id === id);
}

// Get all presets grouped by type
export function getPresetsByType(): Map<EffectPresetType, EffectPreset[]> {
  const grouped = new Map<EffectPresetType, EffectPreset[]>();
  for (const preset of EFFECT_PRESETS) {
    const existing = grouped.get(preset.type) || [];
    grouped.set(preset.type, [...existing, preset]);
  }
  return grouped;
}
