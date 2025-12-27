// Loop Library - Prebuilt MIDI loop patterns
// Lightweight, fully self-contained loop definitions

import type { LoopDefinition, LoopCategoryInfo, InstantBandPreset, MidiNote } from '@/types/loops';

// =============================================================================
// Loop Categories
// =============================================================================

export const LOOP_CATEGORIES: LoopCategoryInfo[] = [
  {
    id: 'drums',
    name: 'Drums & Percussion',
    icon: '🥁',
    subcategories: [
      { id: 'rock-drums', name: 'Rock Kits', loopCount: 8 },
      { id: 'electronic-drums', name: 'Electronic', loopCount: 8 },
      { id: 'hip-hop-drums', name: 'Hip Hop', loopCount: 8 },
      { id: 'jazz-drums', name: 'Jazz', loopCount: 4 },
    ],
  },
  {
    id: 'bass',
    name: 'Bass Lines',
    icon: '🎸',
    subcategories: [
      { id: 'synth-bass', name: 'Synth Bass', loopCount: 8 },
      { id: 'funk-bass', name: 'Funk Bass', loopCount: 4 },
    ],
  },
  {
    id: 'keys',
    name: 'Keys & Pads',
    icon: '🎹',
    subcategories: [
      { id: 'chords', name: 'Chord Progressions', loopCount: 8 },
      { id: 'pads', name: 'Ambient Pads', loopCount: 4 },
    ],
  },
  {
    id: 'full-beats',
    name: 'Full Arrangements',
    icon: '🎵',
    subcategories: [
      { id: 'lofi', name: 'Lo-Fi Chill', loopCount: 4 },
      { id: 'edm', name: 'EDM/Dance', loopCount: 4 },
    ],
  },
];

// =============================================================================
// Drum Pattern Helpers (GM MIDI notes)
// =============================================================================

const KICK = 36;
const SNARE = 38;
const CLAP = 39;
const CLOSED_HH = 42;
const OPEN_HH = 46;
const TOM_LOW = 41;
const TOM_MID = 45;
const TOM_HIGH = 48;
const CRASH = 49;
const RIDE = 51;

// Helper to create a note at a specific beat position
const note = (beat: number, n: number, v: number = 100, d: number = 0.1, totalBeats: number = 4): MidiNote => ({
  t: beat / totalBeats,
  n,
  v,
  d: d / totalBeats,
});

// =============================================================================
// DRUM LOOPS
// =============================================================================

const DRUM_LOOPS: LoopDefinition[] = [
  // ROCK DRUMS
  {
    id: 'rock-basic-4-4',
    name: 'Basic Rock Beat',
    category: 'drums',
    subcategory: 'rock-drums',
    bpm: 120,
    bars: 1,
    timeSignature: [4, 4],
    soundPreset: 'drums/acoustic-kit',
    tags: ['rock', 'basic', 'driving'],
    intensity: 3,
    complexity: 1,
    midiData: [
      note(0, KICK, 110), note(0, CLOSED_HH, 80),
      note(0.5, CLOSED_HH, 60),
      note(1, SNARE, 100), note(1, CLOSED_HH, 80),
      note(1.5, CLOSED_HH, 60),
      note(2, KICK, 100), note(2, CLOSED_HH, 80),
      note(2.5, CLOSED_HH, 60),
      note(3, SNARE, 100), note(3, CLOSED_HH, 80),
      note(3.5, CLOSED_HH, 60),
    ],
  },
  {
    id: 'rock-driving-8th',
    name: 'Driving 8ths',
    category: 'drums',
    subcategory: 'rock-drums',
    bpm: 130,
    bars: 1,
    timeSignature: [4, 4],
    soundPreset: 'drums/acoustic-kit',
    tags: ['rock', 'energetic', 'driving'],
    intensity: 4,
    complexity: 2,
    midiData: [
      note(0, KICK, 120), note(0, CRASH, 90),
      note(0.5, CLOSED_HH, 70),
      note(1, SNARE, 110), note(1, CLOSED_HH, 80),
      note(1.5, CLOSED_HH, 70),
      note(2, KICK, 100), note(2, CLOSED_HH, 80),
      note(2.5, KICK, 90), note(2.5, CLOSED_HH, 70),
      note(3, SNARE, 110), note(3, CLOSED_HH, 80),
      note(3.5, CLOSED_HH, 70),
    ],
  },
  {
    id: 'rock-half-time',
    name: 'Half Time Feel',
    category: 'drums',
    subcategory: 'rock-drums',
    bpm: 140,
    bars: 2,
    timeSignature: [4, 4],
    soundPreset: 'drums/acoustic-kit',
    tags: ['rock', 'heavy', 'half-time'],
    intensity: 4,
    complexity: 2,
    midiData: [
      note(0, KICK, 120, 0.1, 8), note(0, CRASH, 80, 0.1, 8),
      note(1, CLOSED_HH, 60, 0.1, 8),
      note(2, SNARE, 110, 0.1, 8), note(2, CLOSED_HH, 70, 0.1, 8),
      note(3, CLOSED_HH, 60, 0.1, 8),
      note(4, KICK, 100, 0.1, 8), note(4, CLOSED_HH, 70, 0.1, 8),
      note(5, CLOSED_HH, 60, 0.1, 8),
      note(6, SNARE, 110, 0.1, 8), note(6, CLOSED_HH, 70, 0.1, 8),
      note(6.5, KICK, 80, 0.1, 8),
      note(7, CLOSED_HH, 60, 0.1, 8),
      note(7.5, KICK, 90, 0.1, 8),
    ],
  },
  {
    id: 'rock-fill-1',
    name: 'Rock Fill 1',
    category: 'drums',
    subcategory: 'rock-drums',
    bpm: 120,
    bars: 1,
    timeSignature: [4, 4],
    soundPreset: 'drums/acoustic-kit',
    tags: ['rock', 'fill', 'toms'],
    intensity: 5,
    complexity: 3,
    midiData: [
      note(0, TOM_HIGH, 100),
      note(0.25, TOM_HIGH, 90),
      note(0.5, TOM_MID, 100),
      note(0.75, TOM_MID, 90),
      note(1, TOM_LOW, 100),
      note(1.25, TOM_LOW, 90),
      note(1.5, TOM_LOW, 100),
      note(2, SNARE, 110),
      note(2.5, SNARE, 100),
      note(3, KICK, 120), note(3, CRASH, 100),
      note(3.5, KICK, 100),
    ],
  },

  // ELECTRONIC DRUMS
  {
    id: 'electro-four-floor',
    name: 'Four on Floor',
    category: 'drums',
    subcategory: 'electronic-drums',
    bpm: 128,
    bars: 1,
    timeSignature: [4, 4],
    soundPreset: 'drums/808-kit',
    tags: ['electronic', 'house', 'dance'],
    intensity: 3,
    complexity: 1,
    midiData: [
      note(0, KICK, 120), note(0, CLOSED_HH, 60),
      note(0.5, CLOSED_HH, 70),
      note(1, KICK, 110), note(1, CLAP, 90), note(1, CLOSED_HH, 60),
      note(1.5, CLOSED_HH, 70),
      note(2, KICK, 110), note(2, CLOSED_HH, 60),
      note(2.5, CLOSED_HH, 70),
      note(3, KICK, 110), note(3, CLAP, 90), note(3, CLOSED_HH, 60),
      note(3.5, OPEN_HH, 80),
    ],
  },
  {
    id: 'electro-tech-house',
    name: 'Tech House Groove',
    category: 'drums',
    subcategory: 'electronic-drums',
    bpm: 125,
    bars: 2,
    timeSignature: [4, 4],
    soundPreset: 'drums/808-kit',
    tags: ['electronic', 'tech-house', 'groovy'],
    intensity: 3,
    complexity: 3,
    midiData: [
      note(0, KICK, 120, 0.1, 8),
      note(0.5, CLOSED_HH, 50, 0.1, 8),
      note(0.75, CLOSED_HH, 40, 0.1, 8),
      note(1, KICK, 100, 0.1, 8), note(1, CLAP, 80, 0.1, 8),
      note(1.5, CLOSED_HH, 60, 0.1, 8),
      note(2, KICK, 110, 0.1, 8),
      note(2.5, CLOSED_HH, 50, 0.1, 8),
      note(2.75, KICK, 70, 0.1, 8),
      note(3, CLAP, 85, 0.1, 8),
      note(3.5, CLOSED_HH, 60, 0.1, 8),
      note(3.75, OPEN_HH, 70, 0.1, 8),
      note(4, KICK, 120, 0.1, 8),
      note(4.5, CLOSED_HH, 50, 0.1, 8),
      note(5, KICK, 100, 0.1, 8), note(5, CLAP, 80, 0.1, 8),
      note(5.5, CLOSED_HH, 60, 0.1, 8),
      note(5.75, CLOSED_HH, 40, 0.1, 8),
      note(6, KICK, 110, 0.1, 8),
      note(6.5, CLOSED_HH, 50, 0.1, 8),
      note(7, CLAP, 85, 0.1, 8),
      note(7.25, KICK, 80, 0.1, 8),
      note(7.5, OPEN_HH, 75, 0.1, 8),
    ],
  },
  {
    id: 'electro-minimal',
    name: 'Minimal Pulse',
    category: 'drums',
    subcategory: 'electronic-drums',
    bpm: 122,
    bars: 2,
    timeSignature: [4, 4],
    soundPreset: 'drums/808-kit',
    tags: ['electronic', 'minimal', 'hypnotic'],
    intensity: 2,
    complexity: 2,
    midiData: [
      note(0, KICK, 110, 0.1, 8),
      note(1, KICK, 100, 0.1, 8),
      note(1.5, CLOSED_HH, 40, 0.1, 8),
      note(2, KICK, 100, 0.1, 8), note(2, CLAP, 60, 0.1, 8),
      note(3, KICK, 100, 0.1, 8),
      note(3.5, CLOSED_HH, 50, 0.1, 8),
      note(4, KICK, 110, 0.1, 8),
      note(4.75, CLOSED_HH, 30, 0.1, 8),
      note(5, KICK, 100, 0.1, 8),
      note(5.5, CLOSED_HH, 40, 0.1, 8),
      note(6, KICK, 100, 0.1, 8), note(6, CLAP, 65, 0.1, 8),
      note(7, KICK, 100, 0.1, 8),
      note(7.5, OPEN_HH, 50, 0.1, 8),
    ],
  },

  // HIP HOP DRUMS
  {
    id: 'hiphop-boom-bap',
    name: 'Boom Bap',
    category: 'drums',
    subcategory: 'hip-hop-drums',
    bpm: 90,
    bars: 2,
    timeSignature: [4, 4],
    soundPreset: 'drums/808-kit',
    tags: ['hip-hop', 'boom-bap', 'classic'],
    intensity: 3,
    complexity: 2,
    midiData: [
      note(0, KICK, 120, 0.1, 8),
      note(0.5, CLOSED_HH, 50, 0.1, 8),
      note(1, SNARE, 100, 0.1, 8), note(1, CLOSED_HH, 60, 0.1, 8),
      note(1.5, CLOSED_HH, 50, 0.1, 8),
      note(2, KICK, 90, 0.1, 8), note(2, CLOSED_HH, 60, 0.1, 8),
      note(2.5, CLOSED_HH, 50, 0.1, 8),
      note(2.75, KICK, 80, 0.1, 8),
      note(3, SNARE, 100, 0.1, 8), note(3, CLOSED_HH, 60, 0.1, 8),
      note(3.5, OPEN_HH, 70, 0.1, 8),
      note(4, KICK, 110, 0.1, 8), note(4, CLOSED_HH, 60, 0.1, 8),
      note(4.5, CLOSED_HH, 50, 0.1, 8),
      note(5, SNARE, 100, 0.1, 8), note(5, CLOSED_HH, 60, 0.1, 8),
      note(5.5, CLOSED_HH, 50, 0.1, 8),
      note(6, KICK, 100, 0.1, 8), note(6, CLOSED_HH, 60, 0.1, 8),
      note(6.5, KICK, 70, 0.1, 8), note(6.5, CLOSED_HH, 50, 0.1, 8),
      note(7, SNARE, 100, 0.1, 8), note(7, CLOSED_HH, 60, 0.1, 8),
      note(7.5, CLOSED_HH, 50, 0.1, 8),
    ],
  },
  {
    id: 'hiphop-trap-hat',
    name: 'Trap Hi-Hats',
    category: 'drums',
    subcategory: 'hip-hop-drums',
    bpm: 140,
    bars: 2,
    timeSignature: [4, 4],
    soundPreset: 'drums/808-kit',
    tags: ['hip-hop', 'trap', 'hi-hats'],
    intensity: 4,
    complexity: 4,
    midiData: [
      note(0, KICK, 127, 0.1, 8),
      ...Array.from({ length: 32 }, (_, i) => note(i * 0.25, CLOSED_HH, 40 + Math.random() * 40, 0.05, 8)),
      note(2, CLAP, 100, 0.1, 8),
      note(6, CLAP, 100, 0.1, 8),
      note(4, KICK, 120, 0.1, 8),
      note(4.75, KICK, 90, 0.1, 8),
      note(5.5, KICK, 80, 0.1, 8),
    ],
  },

  // JAZZ DRUMS
  {
    id: 'jazz-swing',
    name: 'Jazz Swing',
    category: 'drums',
    subcategory: 'jazz-drums',
    bpm: 130,
    bars: 2,
    timeSignature: [4, 4],
    soundPreset: 'drums/acoustic-kit',
    tags: ['jazz', 'swing', 'brushes'],
    intensity: 2,
    complexity: 3,
    midiData: [
      // Swing ride pattern
      note(0, RIDE, 80, 0.1, 8),
      note(0.66, RIDE, 60, 0.1, 8),
      note(1, RIDE, 80, 0.1, 8),
      note(1.66, RIDE, 60, 0.1, 8),
      note(2, RIDE, 80, 0.1, 8), note(2, KICK, 60, 0.1, 8),
      note(2.66, RIDE, 60, 0.1, 8),
      note(3, RIDE, 80, 0.1, 8),
      note(3.66, RIDE, 60, 0.1, 8),
      note(4, RIDE, 80, 0.1, 8),
      note(4.66, RIDE, 60, 0.1, 8), note(4.66, CLOSED_HH, 40, 0.1, 8),
      note(5, RIDE, 80, 0.1, 8),
      note(5.66, RIDE, 60, 0.1, 8),
      note(6, RIDE, 80, 0.1, 8), note(6, KICK, 50, 0.1, 8),
      note(6.66, RIDE, 60, 0.1, 8),
      note(7, RIDE, 80, 0.1, 8),
      note(7.66, RIDE, 60, 0.1, 8),
    ],
  },
];

// =============================================================================
// BASS LOOPS
// =============================================================================

const BASS_LOOPS: LoopDefinition[] = [
  {
    id: 'bass-synth-octave',
    name: 'Octave Pump',
    category: 'bass',
    subcategory: 'synth-bass',
    bpm: 120,
    bars: 2,
    timeSignature: [4, 4],
    key: 'C',
    soundPreset: 'bass/synth-bass-1',
    tags: ['synth', 'pumping', 'energetic'],
    intensity: 3,
    complexity: 2,
    midiData: [
      note(0, 36, 110, 0.4, 8),  // C1
      note(0.5, 48, 80, 0.3, 8), // C2
      note(1, 36, 100, 0.4, 8),
      note(1.5, 48, 80, 0.3, 8),
      note(2, 36, 110, 0.4, 8),
      note(2.5, 48, 80, 0.3, 8),
      note(3, 36, 100, 0.4, 8),
      note(3.5, 43, 90, 0.3, 8), // G1
      note(4, 36, 110, 0.4, 8),
      note(4.5, 48, 80, 0.3, 8),
      note(5, 36, 100, 0.4, 8),
      note(5.5, 48, 80, 0.3, 8),
      note(6, 36, 110, 0.4, 8),
      note(6.5, 48, 80, 0.3, 8),
      note(7, 41, 100, 0.4, 8), // F1
      note(7.5, 43, 90, 0.3, 8),
    ],
  },
  {
    id: 'bass-808-sub',
    name: '808 Sub',
    category: 'bass',
    subcategory: 'synth-bass',
    bpm: 140,
    bars: 2,
    timeSignature: [4, 4],
    key: 'C',
    soundPreset: 'bass/808-sub',
    tags: ['808', 'trap', 'sub'],
    intensity: 4,
    complexity: 1,
    midiData: [
      note(0, 36, 127, 1.5, 8),
      note(2.5, 36, 100, 0.3, 8),
      note(4, 36, 120, 1.5, 8),
      note(6.5, 36, 90, 0.3, 8),
      note(7, 38, 100, 0.5, 8),
    ],
  },
  {
    id: 'bass-funky',
    name: 'Funky Line',
    category: 'bass',
    subcategory: 'funk-bass',
    bpm: 110,
    bars: 2,
    timeSignature: [4, 4],
    key: 'E',
    soundPreset: 'bass/synth-bass-2',
    tags: ['funk', 'groovy', 'slap'],
    intensity: 3,
    complexity: 4,
    midiData: [
      note(0, 40, 110, 0.2, 8),   // E1
      note(0.5, 40, 80, 0.1, 8),
      note(0.75, 43, 90, 0.1, 8), // G1
      note(1, 40, 100, 0.2, 8),
      note(1.5, 45, 70, 0.1, 8),  // A1
      note(2, 40, 110, 0.2, 8),
      note(2.5, 40, 60, 0.1, 8),
      note(3, 43, 100, 0.2, 8),
      note(3.5, 45, 90, 0.1, 8),
      note(3.75, 47, 80, 0.1, 8), // B1
      note(4, 40, 110, 0.2, 8),
      note(4.5, 40, 70, 0.1, 8),
      note(5, 43, 100, 0.2, 8),
      note(5.5, 40, 80, 0.1, 8),
      note(6, 38, 100, 0.2, 8),  // D1
      note(6.5, 40, 70, 0.1, 8),
      note(7, 43, 100, 0.2, 8),
      note(7.75, 45, 90, 0.1, 8),
    ],
  },
];

// =============================================================================
// KEYS/PADS LOOPS
// =============================================================================

const KEYS_LOOPS: LoopDefinition[] = [
  {
    id: 'keys-cmaj-progression',
    name: 'Pop Progression (C)',
    category: 'keys',
    subcategory: 'chords',
    bpm: 120,
    bars: 4,
    timeSignature: [4, 4],
    key: 'C',
    soundPreset: 'keys/synth-pad',
    tags: ['pop', 'uplifting', 'major'],
    intensity: 2,
    complexity: 2,
    midiData: [
      // C major (bar 1)
      note(0, 48, 80, 3.5, 16), note(0, 52, 80, 3.5, 16), note(0, 55, 80, 3.5, 16),
      // G major (bar 2)
      note(4, 43, 80, 3.5, 16), note(4, 47, 80, 3.5, 16), note(4, 50, 80, 3.5, 16),
      // A minor (bar 3)
      note(8, 45, 80, 3.5, 16), note(8, 48, 80, 3.5, 16), note(8, 52, 80, 3.5, 16),
      // F major (bar 4)
      note(12, 41, 80, 3.5, 16), note(12, 45, 80, 3.5, 16), note(12, 48, 80, 3.5, 16),
    ],
  },
  {
    id: 'keys-minor-progression',
    name: 'Dark Minor (Am)',
    category: 'keys',
    subcategory: 'chords',
    bpm: 100,
    bars: 4,
    timeSignature: [4, 4],
    key: 'Am',
    soundPreset: 'keys/synth-pad',
    tags: ['dark', 'moody', 'minor'],
    intensity: 2,
    complexity: 2,
    midiData: [
      // Am (bar 1)
      note(0, 45, 70, 3.5, 16), note(0, 48, 70, 3.5, 16), note(0, 52, 70, 3.5, 16),
      // F (bar 2)
      note(4, 41, 70, 3.5, 16), note(4, 45, 70, 3.5, 16), note(4, 48, 70, 3.5, 16),
      // C (bar 3)
      note(8, 48, 70, 3.5, 16), note(8, 52, 70, 3.5, 16), note(8, 55, 70, 3.5, 16),
      // G (bar 4)
      note(12, 43, 70, 3.5, 16), note(12, 47, 70, 3.5, 16), note(12, 50, 70, 3.5, 16),
    ],
  },
  {
    id: 'keys-ambient-pad',
    name: 'Ambient Swell',
    category: 'keys',
    subcategory: 'pads',
    bpm: 80,
    bars: 4,
    timeSignature: [4, 4],
    key: 'C',
    soundPreset: 'keys/synth-pad',
    tags: ['ambient', 'atmospheric', 'slow'],
    intensity: 1,
    complexity: 1,
    midiData: [
      // Cmaj9 sustained
      note(0, 48, 50, 15, 16),
      note(0, 52, 50, 15, 16),
      note(0, 55, 50, 15, 16),
      note(0, 59, 40, 15, 16),
      note(0, 62, 40, 15, 16),
    ],
  },
  {
    id: 'keys-stab',
    name: 'Chord Stabs',
    category: 'keys',
    subcategory: 'chords',
    bpm: 125,
    bars: 2,
    timeSignature: [4, 4],
    key: 'C',
    soundPreset: 'keys/synth-pluck',
    tags: ['house', 'stabs', 'energetic'],
    intensity: 4,
    complexity: 3,
    midiData: [
      note(0, 48, 100, 0.2, 8), note(0, 52, 100, 0.2, 8), note(0, 55, 100, 0.2, 8),
      note(0.5, 48, 70, 0.1, 8), note(0.5, 52, 70, 0.1, 8), note(0.5, 55, 70, 0.1, 8),
      note(1.5, 48, 90, 0.2, 8), note(1.5, 52, 90, 0.2, 8), note(1.5, 55, 90, 0.2, 8),
      note(3, 48, 100, 0.2, 8), note(3, 52, 100, 0.2, 8), note(3, 55, 100, 0.2, 8),
      note(4, 45, 100, 0.2, 8), note(4, 48, 100, 0.2, 8), note(4, 52, 100, 0.2, 8),
      note(4.5, 45, 70, 0.1, 8), note(4.5, 48, 70, 0.1, 8), note(4.5, 52, 70, 0.1, 8),
      note(5.5, 45, 90, 0.2, 8), note(5.5, 48, 90, 0.2, 8), note(5.5, 52, 90, 0.2, 8),
      note(7, 45, 100, 0.2, 8), note(7, 48, 100, 0.2, 8), note(7, 52, 100, 0.2, 8),
    ],
  },
];

// =============================================================================
// Combined Loop Library
// =============================================================================

export const LOOP_LIBRARY: LoopDefinition[] = [
  ...DRUM_LOOPS,
  ...BASS_LOOPS,
  ...KEYS_LOOPS,
];

// =============================================================================
// Loop Lookup Functions
// =============================================================================

export function getLoopById(id: string): LoopDefinition | undefined {
  return LOOP_LIBRARY.find((loop) => loop.id === id);
}

export function getLoopsByCategory(category: string): LoopDefinition[] {
  return LOOP_LIBRARY.filter((loop) => loop.category === category);
}

export function getLoopsBySubcategory(subcategory: string): LoopDefinition[] {
  return LOOP_LIBRARY.filter((loop) => loop.subcategory === subcategory);
}

export function searchLoops(query: string): LoopDefinition[] {
  const lowerQuery = query.toLowerCase();
  return LOOP_LIBRARY.filter(
    (loop) =>
      loop.name.toLowerCase().includes(lowerQuery) ||
      loop.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
  );
}

export function filterLoops(options: {
  category?: string;
  subcategory?: string;
  bpmMin?: number;
  bpmMax?: number;
  key?: string;
  intensity?: number;
  complexity?: number;
}): LoopDefinition[] {
  return LOOP_LIBRARY.filter((loop) => {
    if (options.category && loop.category !== options.category) return false;
    if (options.subcategory && loop.subcategory !== options.subcategory) return false;
    if (options.bpmMin && loop.bpm < options.bpmMin) return false;
    if (options.bpmMax && loop.bpm > options.bpmMax) return false;
    if (options.key && loop.key !== options.key) return false;
    if (options.intensity && loop.intensity !== options.intensity) return false;
    if (options.complexity && loop.complexity !== options.complexity) return false;
    return true;
  });
}

// =============================================================================
// Instant Band Presets
// =============================================================================

export const INSTANT_BAND_PRESETS: InstantBandPreset[] = [
  {
    id: 'rock-trio',
    name: 'Rock Trio',
    description: 'Classic rock drums and bass foundation',
    loops: ['rock-basic-4-4', 'bass-synth-octave'],
    bpmRange: [100, 140],
    genre: 'Rock',
  },
  {
    id: 'electronic-pulse',
    name: 'Electronic Pulse',
    description: 'Four on the floor with driving bass',
    loops: ['electro-four-floor', 'bass-808-sub', 'keys-stab'],
    bpmRange: [120, 135],
    genre: 'Electronic',
  },
  {
    id: 'lofi-chill',
    name: 'Lo-Fi Chill',
    description: 'Laid-back boom bap vibes',
    loops: ['hiphop-boom-bap', 'bass-funky', 'keys-minor-progression'],
    bpmRange: [80, 95],
    genre: 'Lo-Fi',
  },
  {
    id: 'ambient-journey',
    name: 'Ambient Journey',
    description: 'Atmospheric pads for meditation',
    loops: ['keys-ambient-pad'],
    bpmRange: [60, 90],
    genre: 'Ambient',
  },
];
