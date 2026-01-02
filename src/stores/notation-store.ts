'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// Notation display formats
export type NotationFormat = 'tab' | 'sheet' | 'chord-chart' | 'nashville' | 'lead-sheet';

// Chord representation
export interface Chord {
  name: string;           // e.g., "Am", "G7", "Cmaj7"
  root: string;           // e.g., "A", "G", "C"
  quality: string;        // e.g., "m", "7", "maj7"
  bass?: string;          // For slash chords, e.g., "C/G"
  startBeat: number;      // Position in beats from start
  duration: number;       // Duration in beats
  frets?: number[];       // Guitar fret positions (6 strings, -1 for muted, 0 for open)
  fingers?: number[];     // Finger positions (0 = no finger)
  confidence?: number;    // AI detection confidence (0-1)
}

// Section of the song
export interface SongSection {
  id: string;
  name: string;           // e.g., "Verse 1", "Chorus", "Bridge"
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'solo' | 'outro' | 'breakdown' | 'custom';
  startBeat: number;
  endBeat: number;
  chords: Chord[];
  color?: string;
}

// Tab notation (for guitar/bass)
export interface TabMeasure {
  measureNumber: number;
  timeSignature: [number, number]; // e.g., [4, 4]
  notes: TabNote[];
}

export interface TabNote {
  string: number;         // 1-6 for guitar, 1-4 for bass
  fret: number;           // 0-24
  beat: number;           // Position within measure
  duration: number;       // In beats (1 = quarter note, 0.5 = eighth, etc.)
  technique?: 'hammer-on' | 'pull-off' | 'slide' | 'bend' | 'vibrato' | 'palm-mute' | 'harmonic';
}

// Lyric line with timing
export interface LyricLine {
  id: string;
  text: string;
  startTime: number;      // In seconds
  endTime: number;
  syllables?: {           // For karaoke-style highlighting
    text: string;
    startTime: number;
    endTime: number;
  }[];
}

export interface NotationState {
  // Current notation data
  format: NotationFormat;
  key: string | null;
  timeSignature: [number, number];
  tempo: number;

  // Song structure
  sections: SongSection[];
  currentSectionId: string | null;

  // Chords (flat list for simple chord charts)
  chords: Chord[];
  detectedChords: Chord[];      // AI-detected chords
  showDetectedChords: boolean;

  // Tab notation
  tabMeasures: TabMeasure[];
  instrument: 'guitar' | 'bass' | 'ukulele';
  tuning: string[];             // e.g., ['E', 'A', 'D', 'G', 'B', 'E']
  capo: number;

  // Lyrics
  lyrics: LyricLine[];
  showLyrics: boolean;

  // Display settings
  displayMode: 'scroll' | 'page' | 'follow';
  fontSize: number;
  showFretNumbers: boolean;
  showFingerNumbers: boolean;
  chordDiagramSize: 'small' | 'medium' | 'large';
  highlightCurrentChord: boolean;
  autoScroll: boolean;
  scrollOffset: number;         // Current scroll position in beats

  // Playback sync
  currentBeat: number;
  isFollowing: boolean;

  // Editing
  isEditable: boolean;
  selectedChordIndex: number | null;

  // Import/export
  sourceFile: string | null;    // Original file (GP, MusicXML, etc.)
  sourceFormat: string | null;

  // Actions
  setFormat: (format: NotationFormat) => void;
  setKey: (key: string | null) => void;
  setTimeSignature: (ts: [number, number]) => void;
  setTempo: (tempo: number) => void;

  // Section actions
  addSection: (section: Omit<SongSection, 'id'>) => string;
  updateSection: (id: string, updates: Partial<SongSection>) => void;
  removeSection: (id: string) => void;
  setCurrentSection: (id: string | null) => void;

  // Chord actions
  addChord: (chord: Chord) => void;
  updateChord: (index: number, updates: Partial<Chord>) => void;
  removeChord: (index: number) => void;
  setChords: (chords: Chord[]) => void;
  setDetectedChords: (chords: Chord[]) => void;
  toggleDetectedChords: () => void;
  selectChord: (index: number | null) => void;

  // Tab actions
  setTabMeasures: (measures: TabMeasure[]) => void;
  setInstrument: (instrument: NotationState['instrument']) => void;
  setTuning: (tuning: string[]) => void;
  setCapo: (capo: number) => void;

  // Lyric actions
  setLyrics: (lyrics: LyricLine[]) => void;
  addLyricLine: (line: Omit<LyricLine, 'id'>) => string;
  updateLyricLine: (id: string, updates: Partial<LyricLine>) => void;
  removeLyricLine: (id: string) => void;
  toggleLyrics: () => void;

  // Display actions
  setDisplayMode: (mode: NotationState['displayMode']) => void;
  setFontSize: (size: number) => void;
  setChordDiagramSize: (size: NotationState['chordDiagramSize']) => void;
  toggleFretNumbers: () => void;
  toggleFingerNumbers: () => void;
  toggleHighlightChord: () => void;
  toggleAutoScroll: () => void;
  setScrollOffset: (offset: number) => void;

  // Playback sync
  setCurrentBeat: (beat: number) => void;
  toggleFollowing: () => void;

  // Import/export
  importFromFile: (content: string, format: string) => Promise<void>;
  exportToFormat: (format: string) => string;
  clear: () => void;

  // Permission
  setEditable: (editable: boolean) => void;

  // Computed getters
  getCurrentChord: () => Chord | null;
  getChordsForBeat: (beat: number) => Chord[];
  getSectionForBeat: (beat: number) => SongSection | null;
}

function generateId(): string {
  return `notation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Standard guitar tuning
const STANDARD_GUITAR_TUNING = ['E', 'A', 'D', 'G', 'B', 'E'];
const STANDARD_BASS_TUNING = ['E', 'A', 'D', 'G'];
const STANDARD_UKULELE_TUNING = ['G', 'C', 'E', 'A'];

export const useNotationStore = create<NotationState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    format: 'chord-chart',
    key: null,
    timeSignature: [4, 4],
    tempo: 120,

    sections: [],
    currentSectionId: null,

    chords: [],
    detectedChords: [],
    showDetectedChords: true,

    tabMeasures: [],
    instrument: 'guitar',
    tuning: STANDARD_GUITAR_TUNING,
    capo: 0,

    lyrics: [],
    showLyrics: true,

    displayMode: 'follow',
    fontSize: 16,
    showFretNumbers: true,
    showFingerNumbers: true,
    chordDiagramSize: 'medium',
    highlightCurrentChord: true,
    autoScroll: true,
    scrollOffset: 0,

    currentBeat: 0,
    isFollowing: true,

    isEditable: true,
    selectedChordIndex: null,

    sourceFile: null,
    sourceFormat: null,

    // Actions
    setFormat: (format) => set({ format }),
    setKey: (key) => set({ key }),
    setTimeSignature: (ts) => set({ timeSignature: ts }),
    setTempo: (tempo) => set({ tempo: Math.max(20, Math.min(300, tempo)) }),

    // Section actions
    addSection: (section) => {
      const id = generateId();
      set((state) => ({
        sections: [...state.sections, { ...section, id }].sort((a, b) => a.startBeat - b.startBeat),
      }));
      return id;
    },

    updateSection: (id, updates) => {
      set((state) => ({
        sections: state.sections.map(s => s.id === id ? { ...s, ...updates } : s),
      }));
    },

    removeSection: (id) => {
      set((state) => ({
        sections: state.sections.filter(s => s.id !== id),
        currentSectionId: state.currentSectionId === id ? null : state.currentSectionId,
      }));
    },

    setCurrentSection: (id) => set({ currentSectionId: id }),

    // Chord actions
    addChord: (chord) => {
      set((state) => ({
        chords: [...state.chords, chord].sort((a, b) => a.startBeat - b.startBeat),
      }));
    },

    updateChord: (index, updates) => {
      set((state) => ({
        chords: state.chords.map((c, i) => i === index ? { ...c, ...updates } : c),
      }));
    },

    removeChord: (index) => {
      set((state) => ({
        chords: state.chords.filter((_, i) => i !== index),
        selectedChordIndex: state.selectedChordIndex === index ? null : state.selectedChordIndex,
      }));
    },

    setChords: (chords) => set({ chords }),
    setDetectedChords: (chords) => set({ detectedChords: chords }),
    toggleDetectedChords: () => set((state) => ({ showDetectedChords: !state.showDetectedChords })),
    selectChord: (index) => set({ selectedChordIndex: index }),

    // Tab actions
    setTabMeasures: (measures) => set({ tabMeasures: measures }),
    setInstrument: (instrument) => {
      const tuning = instrument === 'guitar' ? STANDARD_GUITAR_TUNING
        : instrument === 'bass' ? STANDARD_BASS_TUNING
        : STANDARD_UKULELE_TUNING;
      set({ instrument, tuning });
    },
    setTuning: (tuning) => set({ tuning }),
    setCapo: (capo) => set({ capo: Math.max(0, Math.min(12, capo)) }),

    // Lyric actions
    setLyrics: (lyrics) => set({ lyrics }),
    addLyricLine: (line) => {
      const id = generateId();
      set((state) => ({
        lyrics: [...state.lyrics, { ...line, id }].sort((a, b) => a.startTime - b.startTime),
      }));
      return id;
    },
    updateLyricLine: (id, updates) => {
      set((state) => ({
        lyrics: state.lyrics.map(l => l.id === id ? { ...l, ...updates } : l),
      }));
    },
    removeLyricLine: (id) => {
      set((state) => ({
        lyrics: state.lyrics.filter(l => l.id !== id),
      }));
    },
    toggleLyrics: () => set((state) => ({ showLyrics: !state.showLyrics })),

    // Display actions
    setDisplayMode: (mode) => set({ displayMode: mode }),
    setFontSize: (size) => set({ fontSize: Math.max(10, Math.min(32, size)) }),
    setChordDiagramSize: (size) => set({ chordDiagramSize: size }),
    toggleFretNumbers: () => set((state) => ({ showFretNumbers: !state.showFretNumbers })),
    toggleFingerNumbers: () => set((state) => ({ showFingerNumbers: !state.showFingerNumbers })),
    toggleHighlightChord: () => set((state) => ({ highlightCurrentChord: !state.highlightCurrentChord })),
    toggleAutoScroll: () => set((state) => ({ autoScroll: !state.autoScroll })),
    setScrollOffset: (offset) => set({ scrollOffset: Math.max(0, offset) }),

    // Playback sync
    setCurrentBeat: (beat) => set({ currentBeat: Math.max(0, beat) }),
    toggleFollowing: () => set((state) => ({ isFollowing: !state.isFollowing })),

    // Import/export
    importFromFile: async (content, format) => {
      // TODO: Implement parsers for different formats
      // - Guitar Pro (.gp5, .gpx)
      // - MusicXML (.xml, .musicxml)
      // - ChordPro (.chopro, .cho)
      // - Plain text chord charts
      set({ sourceFile: content, sourceFormat: format });
    },

    exportToFormat: (format) => {
      const state = get();
      // TODO: Implement export to different formats
      if (format === 'json') {
        return JSON.stringify({
          key: state.key,
          tempo: state.tempo,
          timeSignature: state.timeSignature,
          sections: state.sections,
          chords: state.chords,
          lyrics: state.lyrics,
        }, null, 2);
      }
      return '';
    },

    clear: () => set({
      sections: [],
      currentSectionId: null,
      chords: [],
      detectedChords: [],
      tabMeasures: [],
      lyrics: [],
      sourceFile: null,
      sourceFormat: null,
      currentBeat: 0,
      scrollOffset: 0,
    }),

    // Permission
    setEditable: (editable) => set({ isEditable: editable }),

    // Computed getters
    getCurrentChord: () => {
      const { chords, currentBeat, showDetectedChords, detectedChords } = get();
      const activeChords = showDetectedChords && detectedChords.length > 0 ? detectedChords : chords;

      return activeChords.find(c =>
        currentBeat >= c.startBeat && currentBeat < c.startBeat + c.duration
      ) || null;
    },

    getChordsForBeat: (beat) => {
      const { chords, showDetectedChords, detectedChords } = get();
      const activeChords = showDetectedChords && detectedChords.length > 0 ? detectedChords : chords;

      return activeChords.filter(c =>
        beat >= c.startBeat && beat < c.startBeat + c.duration
      );
    },

    getSectionForBeat: (beat) => {
      const { sections } = get();
      return sections.find(s =>
        beat >= s.startBeat && beat < s.endBeat
      ) || null;
    },
  }))
);
