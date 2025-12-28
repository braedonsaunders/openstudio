// Instrument Registry - Extensible sound/instrument management
// Adding new instruments is as simple as calling registerInstrument()

import type { SynthConfig, DrumKitConfig } from '@/types/loops';

// =============================================================================
// Instrument Types
// =============================================================================

export type InstrumentType = 'synth' | 'drums' | 'sampler';

export interface InstrumentDefinition {
  id: string;
  name: string;
  category: string;
  type: InstrumentType;
  icon: string;
  description?: string;
  tags: string[];

  // For synths
  synthConfig?: SynthConfig;

  // For drums - note number to name mapping for display
  drumMap?: Record<number, { name: string; shortName: string }>;

  // Default note range for grid display
  noteRange?: { min: number; max: number };

  // Whether this instrument uses a piano-style layout or drum pad layout
  layout: 'piano' | 'drums' | 'pads';
}

export interface InstrumentCategory {
  id: string;
  name: string;
  icon: string;
  order: number;
}

// =============================================================================
// Registry State
// =============================================================================

const instruments = new Map<string, InstrumentDefinition>();
const categories = new Map<string, InstrumentCategory>();

// =============================================================================
// Registration Functions
// =============================================================================

/**
 * Register a new instrument - the primary extension point
 * Call this to add new instruments to the system
 */
export function registerInstrument(instrument: InstrumentDefinition): void {
  instruments.set(instrument.id, instrument);
}

/**
 * Register a new instrument category
 */
export function registerCategory(category: InstrumentCategory): void {
  categories.set(category.id, category);
}

/**
 * Batch register multiple instruments at once
 */
export function registerInstruments(instrumentList: InstrumentDefinition[]): void {
  for (const instrument of instrumentList) {
    registerInstrument(instrument);
  }
}

// =============================================================================
// Query Functions
// =============================================================================

export function getInstrument(id: string): InstrumentDefinition | undefined {
  return instruments.get(id);
}

export function getAllInstruments(): InstrumentDefinition[] {
  return Array.from(instruments.values());
}

export function getInstrumentsByCategory(categoryId: string): InstrumentDefinition[] {
  return Array.from(instruments.values()).filter(i => i.category === categoryId);
}

export function getInstrumentsByType(type: InstrumentType): InstrumentDefinition[] {
  return Array.from(instruments.values()).filter(i => i.type === type);
}

export function getAllCategories(): InstrumentCategory[] {
  return Array.from(categories.values()).sort((a, b) => a.order - b.order);
}

export function searchInstruments(query: string): InstrumentDefinition[] {
  const lowerQuery = query.toLowerCase();
  return Array.from(instruments.values()).filter(
    i =>
      i.name.toLowerCase().includes(lowerQuery) ||
      i.tags.some(t => t.toLowerCase().includes(lowerQuery)) ||
      i.category.toLowerCase().includes(lowerQuery)
  );
}

// =============================================================================
// Default Instruments
// =============================================================================

// Standard GM Drum Map
export const GM_DRUM_MAP: Record<number, { name: string; shortName: string }> = {
  36: { name: 'Kick', shortName: 'KCK' },
  37: { name: 'Rimshot', shortName: 'RIM' },
  38: { name: 'Snare', shortName: 'SNR' },
  39: { name: 'Clap', shortName: 'CLP' },
  40: { name: 'Snare Alt', shortName: 'SN2' },
  41: { name: 'Tom Low', shortName: 'TL' },
  42: { name: 'Hi-Hat Closed', shortName: 'HHC' },
  43: { name: 'Tom Low 2', shortName: 'TL2' },
  44: { name: 'Hi-Hat Pedal', shortName: 'HHP' },
  45: { name: 'Tom Mid', shortName: 'TM' },
  46: { name: 'Hi-Hat Open', shortName: 'HHO' },
  47: { name: 'Tom Mid 2', shortName: 'TM2' },
  48: { name: 'Tom High', shortName: 'TH' },
  49: { name: 'Crash', shortName: 'CRS' },
  50: { name: 'Tom High 2', shortName: 'TH2' },
  51: { name: 'Ride', shortName: 'RDE' },
  52: { name: 'China', shortName: 'CHN' },
  53: { name: 'Ride Bell', shortName: 'RBL' },
  54: { name: 'Tambourine', shortName: 'TMB' },
  55: { name: 'Splash', shortName: 'SPL' },
  56: { name: 'Cowbell', shortName: 'COW' },
};

// Register default categories
registerCategory({ id: 'drums', name: 'Drums & Percussion', icon: '🥁', order: 1 });
registerCategory({ id: 'bass', name: 'Bass', icon: '🎸', order: 2 });
registerCategory({ id: 'keys', name: 'Keys & Pads', icon: '🎹', order: 3 });
registerCategory({ id: 'lead', name: 'Lead & Melody', icon: '🎵', order: 4 });
registerCategory({ id: 'fx', name: 'FX & Atmosphere', icon: '✨', order: 5 });

// Register default instruments
registerInstruments([
  // Drums
  {
    id: 'drums/acoustic-kit',
    name: 'Acoustic Kit',
    category: 'drums',
    type: 'drums',
    icon: '🥁',
    description: 'Classic acoustic drum kit sound',
    tags: ['acoustic', 'rock', 'pop', 'jazz'],
    drumMap: GM_DRUM_MAP,
    noteRange: { min: 36, max: 56 },
    layout: 'drums',
  },
  {
    id: 'drums/808-kit',
    name: '808 Kit',
    category: 'drums',
    type: 'drums',
    icon: '🔊',
    description: 'Classic TR-808 electronic drums',
    tags: ['electronic', '808', 'hip-hop', 'trap'],
    drumMap: GM_DRUM_MAP,
    noteRange: { min: 36, max: 56 },
    layout: 'drums',
  },
  {
    id: 'drums/electronic-kit',
    name: 'Electronic Kit',
    category: 'drums',
    type: 'drums',
    icon: '⚡',
    description: 'Modern electronic drum sounds',
    tags: ['electronic', 'edm', 'dance'],
    drumMap: GM_DRUM_MAP,
    noteRange: { min: 36, max: 56 },
    layout: 'drums',
  },

  // Bass
  {
    id: 'bass/synth-bass-1',
    name: 'Synth Bass 1',
    category: 'bass',
    type: 'synth',
    icon: '🎸',
    description: 'Warm analog-style synth bass',
    tags: ['synth', 'warm', 'analog'],
    noteRange: { min: 24, max: 60 },
    layout: 'piano',
    synthConfig: {
      oscillators: [
        { type: 'sawtooth', detune: 0, gain: 0.5 },
        { type: 'square', detune: -5, gain: 0.3 },
      ],
      filter: { type: 'lowpass', cutoff: 800, resonance: 4, envAmount: 2000 },
      ampEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.1 },
      filterEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.2 },
    },
  },
  {
    id: 'bass/synth-bass-2',
    name: 'Synth Bass 2',
    category: 'bass',
    type: 'synth',
    icon: '🎸',
    description: 'Punchy square wave bass',
    tags: ['synth', 'punchy', 'square'],
    noteRange: { min: 24, max: 60 },
    layout: 'piano',
    synthConfig: {
      oscillators: [
        { type: 'square', detune: 0, gain: 0.6 },
      ],
      filter: { type: 'lowpass', cutoff: 600, resonance: 6, envAmount: 1500 },
      ampEnvelope: { attack: 0.005, decay: 0.15, sustain: 0.8, release: 0.08 },
      filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.3, release: 0.15 },
    },
  },
  {
    id: 'bass/808-sub',
    name: '808 Sub Bass',
    category: 'bass',
    type: 'synth',
    icon: '🔈',
    description: 'Deep 808-style sub bass',
    tags: ['808', 'sub', 'trap', 'hip-hop'],
    noteRange: { min: 24, max: 48 },
    layout: 'piano',
    synthConfig: {
      oscillators: [
        { type: 'sine', detune: 0, gain: 1 },
      ],
      filter: { type: 'lowpass', cutoff: 200, resonance: 0, envAmount: 0 },
      ampEnvelope: { attack: 0.01, decay: 0.8, sustain: 0.3, release: 0.5 },
    },
  },

  // Keys
  {
    id: 'keys/synth-pad',
    name: 'Synth Pad',
    category: 'keys',
    type: 'synth',
    icon: '🎹',
    description: 'Lush atmospheric synth pad',
    tags: ['pad', 'atmospheric', 'ambient'],
    noteRange: { min: 36, max: 84 },
    layout: 'piano',
    synthConfig: {
      oscillators: [
        { type: 'sawtooth', detune: -7, gain: 0.3 },
        { type: 'sawtooth', detune: 7, gain: 0.3 },
        { type: 'triangle', detune: 0, gain: 0.2 },
      ],
      filter: { type: 'lowpass', cutoff: 2000, resonance: 2, envAmount: 1000 },
      ampEnvelope: { attack: 0.5, decay: 0.5, sustain: 0.8, release: 1.5 },
      filterEnvelope: { attack: 0.8, decay: 1.0, sustain: 0.6, release: 1.0 },
    },
  },
  {
    id: 'keys/synth-pluck',
    name: 'Synth Pluck',
    category: 'keys',
    type: 'synth',
    icon: '🎹',
    description: 'Short plucky synth sound',
    tags: ['pluck', 'stab', 'house'],
    noteRange: { min: 36, max: 84 },
    layout: 'piano',
    synthConfig: {
      oscillators: [
        { type: 'triangle', detune: 0, gain: 0.6 },
        { type: 'sawtooth', detune: 3, gain: 0.2 },
      ],
      filter: { type: 'lowpass', cutoff: 4000, resonance: 1, envAmount: 3000 },
      ampEnvelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
      filterEnvelope: { attack: 0.001, decay: 0.15, sustain: 0.1, release: 0.2 },
    },
  },
  {
    id: 'keys/organ',
    name: 'Organ',
    category: 'keys',
    type: 'synth',
    icon: '🎹',
    description: 'Classic organ sound',
    tags: ['organ', 'classic', 'gospel'],
    noteRange: { min: 36, max: 84 },
    layout: 'piano',
    synthConfig: {
      oscillators: [
        { type: 'sine', detune: 0, gain: 0.4 },
        { type: 'sine', detune: 1200, gain: 0.3 },
        { type: 'sine', detune: 1900, gain: 0.2 },
      ],
      filter: { type: 'lowpass', cutoff: 5000, resonance: 0, envAmount: 0 },
      ampEnvelope: { attack: 0.05, decay: 0.1, sustain: 0.9, release: 0.1 },
    },
  },

  // Lead
  {
    id: 'lead/synth-lead',
    name: 'Synth Lead',
    category: 'lead',
    type: 'synth',
    icon: '🎵',
    description: 'Bright melodic synth lead',
    tags: ['lead', 'melody', 'bright'],
    noteRange: { min: 48, max: 96 },
    layout: 'piano',
    synthConfig: {
      oscillators: [
        { type: 'sawtooth', detune: 0, gain: 0.5 },
        { type: 'square', detune: 12, gain: 0.3 },
      ],
      filter: { type: 'lowpass', cutoff: 3000, resonance: 3, envAmount: 2000 },
      ampEnvelope: { attack: 0.02, decay: 0.1, sustain: 0.7, release: 0.2 },
      filterEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.3 },
    },
  },
]);

// =============================================================================
// Helper: Get sound preset ID from instrument ID
// =============================================================================

export function getSoundPresetFromInstrument(instrumentId: string): string {
  // Instrument IDs are formatted as "category/name" which matches sound preset format
  return instrumentId;
}

// =============================================================================
// Helper: Get note name from MIDI number
// =============================================================================

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiToNoteName(midiNote: number): string {
  const octave = Math.floor(midiNote / 12) - 1;
  const noteName = NOTE_NAMES[midiNote % 12];
  return `${noteName}${octave}`;
}

export function noteNameToMidi(noteName: string): number {
  const match = noteName.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return 60; // Default to C4

  const note = match[1];
  const octave = parseInt(match[2]);
  const noteIndex = NOTE_NAMES.indexOf(note);

  return (octave + 1) * 12 + noteIndex;
}
