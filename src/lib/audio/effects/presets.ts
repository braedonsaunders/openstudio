// Effect presets - settings definitions for quick preset selection
// Actual effects processing is handled by native bridge

import type { ExtendedEffectsChain, TrackEffectsChain } from '@/types';
import { DEFAULT_UNIFIED_EFFECTS } from '../effects-defaults';

// Effect preset type
export interface EffectPreset {
  id: string;
  name: string;
  category: 'vocal' | 'guitar' | 'production' | 'creative';
  description?: string;
  effects: Partial<ExtendedEffectsChain>;
}

// Standard effect presets (mainly for vocals/general use)
export const EFFECT_PRESETS: EffectPreset[] = [
  {
    id: 'clean-vocal',
    name: 'Clean Vocal',
    category: 'vocal',
    description: 'Light processing for clean vocals',
    effects: {
      noiseGate: { ...DEFAULT_UNIFIED_EFFECTS.noiseGate, enabled: true, threshold: -45 },
      compressor: { ...DEFAULT_UNIFIED_EFFECTS.compressor, enabled: true, threshold: -18, ratio: 3, attack: 15, release: 150 },
      eq: { ...DEFAULT_UNIFIED_EFFECTS.eq, enabled: true },
    },
  },
  {
    id: 'warm-vocal',
    name: 'Warm Vocal',
    category: 'vocal',
    description: 'Warm, full-bodied vocal sound',
    effects: {
      noiseGate: { ...DEFAULT_UNIFIED_EFFECTS.noiseGate, enabled: true, threshold: -42 },
      compressor: { ...DEFAULT_UNIFIED_EFFECTS.compressor, enabled: true, threshold: -16, ratio: 4, attack: 10, release: 120 },
      eq: { ...DEFAULT_UNIFIED_EFFECTS.eq, enabled: true },
      reverb: { ...DEFAULT_UNIFIED_EFFECTS.reverb, enabled: true, type: 'room', decay: 1.2, mix: 0.15 },
    },
  },
  {
    id: 'broadcast-vocal',
    name: 'Broadcast',
    category: 'vocal',
    description: 'Radio/podcast style processing',
    effects: {
      noiseGate: { ...DEFAULT_UNIFIED_EFFECTS.noiseGate, enabled: true, threshold: -38 },
      compressor: { ...DEFAULT_UNIFIED_EFFECTS.compressor, enabled: true, threshold: -14, ratio: 5, attack: 5, release: 80 },
      eq: { ...DEFAULT_UNIFIED_EFFECTS.eq, enabled: true },
      limiter: { ...DEFAULT_UNIFIED_EFFECTS.limiter, enabled: true, threshold: -3, ceiling: -0.5 },
    },
  },
  {
    id: 'airy-vocal',
    name: 'Airy Vocal',
    category: 'vocal',
    description: 'Bright, breathy vocal sound',
    effects: {
      noiseGate: { ...DEFAULT_UNIFIED_EFFECTS.noiseGate, enabled: true, threshold: -44 },
      compressor: { ...DEFAULT_UNIFIED_EFFECTS.compressor, enabled: true, threshold: -20, ratio: 3, attack: 20, release: 200 },
      eq: { ...DEFAULT_UNIFIED_EFFECTS.eq, enabled: true },
      reverb: { ...DEFAULT_UNIFIED_EFFECTS.reverb, enabled: true, type: 'plate', decay: 1.8, mix: 0.2 },
    },
  },
  {
    id: 'intimate-vocal',
    name: 'Intimate',
    category: 'vocal',
    description: 'Close, intimate vocal sound',
    effects: {
      noiseGate: { ...DEFAULT_UNIFIED_EFFECTS.noiseGate, enabled: true, threshold: -50 },
      compressor: { ...DEFAULT_UNIFIED_EFFECTS.compressor, enabled: true, threshold: -22, ratio: 2.5, attack: 25, release: 180 },
      eq: { ...DEFAULT_UNIFIED_EFFECTS.eq, enabled: true },
      reverb: { ...DEFAULT_UNIFIED_EFFECTS.reverb, enabled: true, type: 'room', decay: 0.8, mix: 0.1 },
    },
  },
  {
    id: 'modern-pop',
    name: 'Modern Pop',
    category: 'production',
    description: 'Contemporary pop vocal processing',
    effects: {
      noiseGate: { ...DEFAULT_UNIFIED_EFFECTS.noiseGate, enabled: true, threshold: -40 },
      compressor: { ...DEFAULT_UNIFIED_EFFECTS.compressor, enabled: true, threshold: -12, ratio: 6, attack: 5, release: 60 },
      eq: { ...DEFAULT_UNIFIED_EFFECTS.eq, enabled: true },
      delay: { ...DEFAULT_UNIFIED_EFFECTS.delay, enabled: true, time: 0.25, feedback: 0.15, mix: 0.12 },
      reverb: { ...DEFAULT_UNIFIED_EFFECTS.reverb, enabled: true, type: 'plate', decay: 1.5, mix: 0.18 },
    },
  },
  {
    id: 'lo-fi',
    name: 'Lo-Fi',
    category: 'creative',
    description: 'Vintage, lo-fi character',
    effects: {
      eq: { ...DEFAULT_UNIFIED_EFFECTS.eq, enabled: true },
      compressor: { ...DEFAULT_UNIFIED_EFFECTS.compressor, enabled: true, threshold: -18, ratio: 4 },
      chorus: { ...DEFAULT_UNIFIED_EFFECTS.chorus, enabled: true, rate: 0.3, depth: 0.15, mix: 0.2 },
    },
  },
  {
    id: 'ethereal',
    name: 'Ethereal',
    category: 'creative',
    description: 'Dreamy, atmospheric sound',
    effects: {
      compressor: { ...DEFAULT_UNIFIED_EFFECTS.compressor, enabled: true, threshold: -24, ratio: 2.5 },
      chorus: { ...DEFAULT_UNIFIED_EFFECTS.chorus, enabled: true, rate: 0.4, depth: 0.4, mix: 0.35 },
      delay: { ...DEFAULT_UNIFIED_EFFECTS.delay, enabled: true, time: 0.5, feedback: 0.4, mix: 0.25 },
      reverb: { ...DEFAULT_UNIFIED_EFFECTS.reverb, enabled: true, type: 'hall', decay: 4, mix: 0.4 },
    },
  },
];

// Default effects chain for loops (simpler than full effects)
export const DEFAULT_EFFECTS_CHAIN: TrackEffectsChain = {
  noiseGate: {
    enabled: false,
    threshold: -40,
    attack: 1,
    hold: 50,
    release: 100,
    range: -80,
  },
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
    threshold: -20,
    ratio: 4,
    attack: 10,
    release: 100,
    knee: 6,
    makeupGain: 0,
  },
  reverb: {
    enabled: false,
    type: 'hall',
    mix: 0.3,
    decay: 2,
    preDelay: 20,
    highCut: 8000,
    lowCut: 100,
  },
  limiter: {
    enabled: false,
    threshold: -3,
    release: 100,
    ceiling: -0.3,
  },
};

// Helper to get presets by category
export function getPresetsByCategory(category: EffectPreset['category']): EffectPreset[] {
  return EFFECT_PRESETS.filter((p) => p.category === category);
}
