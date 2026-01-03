// ============================================
// Notation Data Types
// ============================================

// Time signature representation
export interface TimeSignature {
  beats: number;      // e.g., 4
  beatType: number;   // e.g., 4 (quarter note)
}

// Key signature representation
export interface KeySignature {
  fifths: number;     // Number of sharps (positive) or flats (negative)
  mode: 'major' | 'minor';
  key: string;        // e.g., 'C', 'G', 'F#m'
}

// A single note
export interface Note {
  pitch: string;        // e.g., 'C4', 'E5', 'G#3'
  duration: number;     // Duration in beats
  startBeat: number;    // When note starts
  velocity?: number;    // 0-127
  tied?: boolean;       // Is this a tie continuation?

  // String instrument specific
  string?: number;      // Guitar string (1-6)
  fret?: number;        // Fret number

  // Articulations
  accent?: boolean;
  staccato?: boolean;
  legato?: boolean;

  // Techniques (for guitar/bass)
  bend?: number;        // Bend amount in semitones
  slide?: 'up' | 'down';
  hammer?: boolean;     // Hammer-on
  pull?: boolean;       // Pull-off
  tap?: boolean;
  harmonic?: 'natural' | 'artificial';
  palmMute?: boolean;
  letRing?: boolean;
}

// A chord symbol
export interface ChordSymbol {
  name: string;         // e.g., 'Am7', 'Cmaj7'
  root: string;         // e.g., 'A', 'C'
  quality: string;      // e.g., 'm7', 'maj7', '7', ''
  bass?: string;        // Slash chord bass note
  startBeat: number;
  duration: number;

  // Optional diagram data
  frets?: number[];
  fingers?: number[];
}

// A measure/bar
export interface Measure {
  number: number;
  startBeat: number;
  duration: number;     // In beats

  timeSignature?: TimeSignature;  // If changes in this measure
  keySignature?: KeySignature;    // If changes in this measure
  tempo?: number;                 // If changes in this measure

  repeatStart?: boolean;
  repeatEnd?: boolean;
  repeatCount?: number;

  ending?: number;      // 1st ending, 2nd ending, etc.
}

// A track/part (e.g., lead guitar, rhythm guitar, bass)
export interface Track {
  id: string;
  name: string;
  instrument?: string;  // e.g., 'Electric Guitar', 'Acoustic Bass'
  tuning?: string[];    // e.g., ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']
  capo?: number;

  notes: Note[];
  measures: Measure[];
}

// Lyrics line
export interface LyricLine {
  text: string;
  startBeat: number;
  endBeat: number;
}

// Song section
export interface Section {
  id: string;
  name: string;
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro' | 'breakdown' | 'custom';
  startBeat: number;
  endBeat: number;
  repeatCount?: number;
}

// Full parsed notation
export interface ParsedNotation {
  // Metadata
  title?: string;
  artist?: string;
  album?: string;
  transcriber?: string;

  // Global settings
  tempo: number;
  timeSignature: TimeSignature;
  keySignature: KeySignature;

  // Content
  tracks: Track[];
  chords: ChordSymbol[];
  sections: Section[];
  lyrics: LyricLine[];

  // Measures (global timeline)
  measures: Measure[];
  totalBeats: number;
  totalMeasures: number;

  // Source info
  sourceFormat: 'musicxml' | 'gp' | 'tab' | 'manual';
  sourceFile?: {
    name: string;
    key: string;  // R2 storage key
    uploadedAt: string;
  };
}

// Tab string representation for display
export interface TabLine {
  string: number;
  notes: Array<{
    fret: number | string;  // number or 'x' for muted, 'h' for hammer-on, etc.
    beat: number;
    duration: number;
    technique?: string;
  }>;
}

// Standard notation for display
export interface StaffLine {
  clef: 'treble' | 'bass' | 'percussion';
  notes: Note[];
  measures: Measure[];
}

// Display-ready notation
export interface NotationDisplay {
  tabs?: TabLine[];
  staff?: StaffLine[];
  chordChart?: ChordSymbol[];
  lyrics?: LyricLine[];
}
