// Effect presets - settings definitions for quick preset selection
// Actual effects processing is handled by native bridge

import type { ExtendedEffectsChain, TrackEffectsChain } from '@/types';
import { DEFAULT_FULL_EFFECTS, DEFAULT_UNIFIED_EFFECTS } from '../effects-defaults';

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
      eq: { ...DEFAULT_UNIFIED_EFFECTS.eq, enabled: true, highShelfGain: 2, lowShelfGain: -2 },
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
      eq: { ...DEFAULT_UNIFIED_EFFECTS.eq, enabled: true, lowShelfGain: 3, midGain: 1, highShelfGain: 1 },
      reverb: { ...DEFAULT_UNIFIED_EFFECTS.reverb, enabled: true, type: 'room', size: 30, decay: 1.2, mix: 15 },
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
      eq: { ...DEFAULT_UNIFIED_EFFECTS.eq, enabled: true, lowShelfFreq: 100, lowShelfGain: -4, midFreq: 2500, midGain: 3, highShelfGain: 2 },
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
      eq: { ...DEFAULT_UNIFIED_EFFECTS.eq, enabled: true, highMidGain: 2, highShelfGain: 4 },
      reverb: { ...DEFAULT_UNIFIED_EFFECTS.reverb, enabled: true, type: 'plate', size: 40, decay: 1.8, mix: 20 },
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
      eq: { ...DEFAULT_UNIFIED_EFFECTS.eq, enabled: true, lowMidGain: 2, highShelfGain: -1 },
      reverb: { ...DEFAULT_UNIFIED_EFFECTS.reverb, enabled: true, type: 'room', size: 20, decay: 0.8, mix: 10 },
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
      eq: { ...DEFAULT_UNIFIED_EFFECTS.eq, enabled: true, lowShelfGain: -3, midGain: 2, highMidGain: 3, highShelfGain: 2 },
      delay: { ...DEFAULT_UNIFIED_EFFECTS.delay, enabled: true, time: 0.25, feedback: 15, mix: 12 },
      reverb: { ...DEFAULT_UNIFIED_EFFECTS.reverb, enabled: true, type: 'plate', size: 35, decay: 1.5, mix: 18 },
    },
  },
  {
    id: 'lo-fi',
    name: 'Lo-Fi',
    category: 'creative',
    description: 'Vintage, lo-fi character',
    effects: {
      eq: { ...DEFAULT_UNIFIED_EFFECTS.eq, enabled: true, lowShelfGain: 2, highShelfFreq: 6000, highShelfGain: -6 },
      compressor: { ...DEFAULT_UNIFIED_EFFECTS.compressor, enabled: true, threshold: -18, ratio: 4 },
      chorus: { ...DEFAULT_UNIFIED_EFFECTS.chorus, enabled: true, rate: 0.3, depth: 15, mix: 20 },
    },
  },
  {
    id: 'ethereal',
    name: 'Ethereal',
    category: 'creative',
    description: 'Dreamy, atmospheric sound',
    effects: {
      compressor: { ...DEFAULT_UNIFIED_EFFECTS.compressor, enabled: true, threshold: -24, ratio: 2.5 },
      chorus: { ...DEFAULT_UNIFIED_EFFECTS.chorus, enabled: true, rate: 0.4, depth: 40, mix: 35 },
      delay: { ...DEFAULT_UNIFIED_EFFECTS.delay, enabled: true, time: 0.5, feedback: 40, mix: 25 },
      reverb: { ...DEFAULT_UNIFIED_EFFECTS.reverb, enabled: true, type: 'hall', size: 80, decay: 4, mix: 40 },
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
    range: 80,
  },
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
    threshold: -20,
    ratio: 4,
    attack: 10,
    release: 100,
    knee: 6,
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
    mix: 30,
    highCut: 8000,
    lowCut: 100,
    modulation: 20,
    stereoWidth: 100,
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
