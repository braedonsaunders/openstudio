'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { SongNotation, SongLyrics, SongChord, SongSection, SongLyricLine } from '@/types/songs';

// =============================================================================
// Types
// =============================================================================

export type NotationFormat = 'chord-chart' | 'tab' | 'sheet' | 'nashville' | 'lead-sheet';

// Re-export types for convenience
export type { SongChord as Chord, SongSection, SongLyricLine as LyricLine } from '@/types/songs';

// =============================================================================
// Store State
// =============================================================================

export interface NotationState {
  // Current song context
  currentSongId: string | null;
  roomId: string | null;

  // Notation data (loaded from current song)
  format: NotationFormat;
  sections: SongSection[];
  chords: SongChord[];
  detectedChords: SongChord[];
  showDetectedChords: boolean;
  instrument: 'guitar' | 'bass' | 'ukulele';
  tuning: string[];
  capo: number;

  // Lyrics data (loaded from current song)
  lyrics: SongLyricLine[];
  showLyrics: boolean;

  // Display settings (local, not persisted per-song)
  displayMode: 'scroll' | 'page' | 'follow';
  fontSize: number;
  showFretNumbers: boolean;
  showFingerNumbers: boolean;
  chordDiagramSize: 'small' | 'medium' | 'large';
  highlightCurrentChord: boolean;
  autoScroll: boolean;
  scrollOffset: number;

  // Playback sync
  currentBeat: number;
  isFollowing: boolean;

  // Editing
  isEditable: boolean;
  selectedChordIndex: number | null;

  // Dirty flag for save
  isDirty: boolean;

  // Actions - Song context
  setSongContext: (songId: string | null, roomId: string | null) => void;
  loadFromSong: (notation: SongNotation | null | undefined, lyrics: SongLyrics | null | undefined) => void;
  getNotationData: () => SongNotation;
  getLyricsData: () => SongLyrics;

  // Actions - Notation
  setFormat: (format: NotationFormat) => void;
  addSection: (section: Omit<SongSection, 'id'>) => string;
  updateSection: (id: string, updates: Partial<SongSection>) => void;
  removeSection: (id: string) => void;
  addChord: (chord: SongChord) => void;
  updateChord: (index: number, updates: Partial<SongChord>) => void;
  removeChord: (index: number) => void;
  setChords: (chords: SongChord[]) => void;
  setDetectedChords: (chords: SongChord[]) => void;
  toggleDetectedChords: () => void;
  selectChord: (index: number | null) => void;
  setInstrument: (instrument: 'guitar' | 'bass' | 'ukulele') => void;
  setTuning: (tuning: string[]) => void;
  setCapo: (capo: number) => void;

  // Actions - Lyrics
  setLyrics: (lyrics: SongLyricLine[]) => void;
  addLyricLine: (line: Omit<SongLyricLine, 'id'>) => string;
  updateLyricLine: (id: string, updates: Partial<SongLyricLine>) => void;
  removeLyricLine: (id: string) => void;
  toggleLyrics: () => void;

  // Actions - Display settings
  setDisplayMode: (mode: 'scroll' | 'page' | 'follow') => void;
  setFontSize: (size: number) => void;
  setChordDiagramSize: (size: 'small' | 'medium' | 'large') => void;
  toggleFretNumbers: () => void;
  toggleFingerNumbers: () => void;
  toggleHighlightChord: () => void;
  toggleAutoScroll: () => void;
  setScrollOffset: (offset: number) => void;

  // Actions - Playback
  setCurrentBeat: (beat: number) => void;
  toggleFollowing: () => void;

  // Actions - Editing
  setEditable: (editable: boolean) => void;
  clear: () => void;
  markClean: () => void;

  // Computed
  getCurrentChord: () => SongChord | null;
  getChordsForBeat: (beat: number) => SongChord[];
  getSectionForBeat: (beat: number) => SongSection | null;
}

// =============================================================================
// Constants
// =============================================================================

const STANDARD_GUITAR_TUNING = ['E', 'A', 'D', 'G', 'B', 'E'];
const STANDARD_BASS_TUNING = ['E', 'A', 'D', 'G'];
const STANDARD_UKULELE_TUNING = ['G', 'C', 'E', 'A'];

function generateId(): string {
  return `notation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// =============================================================================
// Store Implementation
// =============================================================================

export const useNotationStore = create<NotationState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    currentSongId: null,
    roomId: null,

    format: 'chord-chart',
    sections: [],
    chords: [],
    detectedChords: [],
    showDetectedChords: true,
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

    isDirty: false,

    // Song context actions
    setSongContext: (songId, roomId) => {
      set({ currentSongId: songId, roomId, isDirty: false });
    },

    loadFromSong: (notation, lyrics) => {
      set({
        format: notation?.format || 'chord-chart',
        sections: notation?.sections || [],
        chords: notation?.chords || [],
        detectedChords: notation?.detectedChords || [],
        instrument: notation?.instrument || 'guitar',
        tuning: notation?.tuning || STANDARD_GUITAR_TUNING,
        capo: notation?.capo || 0,
        lyrics: lyrics?.lines || [],
        isDirty: false,
        currentBeat: 0,
        scrollOffset: 0,
      });
    },

    getNotationData: () => {
      const state = get();
      return {
        format: state.format,
        sections: state.sections,
        chords: state.chords,
        detectedChords: state.detectedChords.length > 0 ? state.detectedChords : undefined,
        instrument: state.instrument,
        tuning: state.tuning,
        capo: state.capo,
      };
    },

    getLyricsData: () => {
      const state = get();
      return {
        lines: state.lyrics,
        source: 'manual',
      };
    },

    // Notation actions
    setFormat: (format) => set({ format, isDirty: true }),

    addSection: (section) => {
      const id = generateId();
      set((state) => ({
        sections: [...state.sections, { ...section, id }].sort((a, b) => a.startBeat - b.startBeat),
        isDirty: true,
      }));
      return id;
    },

    updateSection: (id, updates) => {
      set((state) => ({
        sections: state.sections.map(s => s.id === id ? { ...s, ...updates } : s),
        isDirty: true,
      }));
    },

    removeSection: (id) => {
      set((state) => ({
        sections: state.sections.filter(s => s.id !== id),
        isDirty: true,
      }));
    },

    addChord: (chord) => {
      set((state) => ({
        chords: [...state.chords, chord].sort((a, b) => a.startBeat - b.startBeat),
        isDirty: true,
      }));
    },

    updateChord: (index, updates) => {
      set((state) => ({
        chords: state.chords.map((c, i) => i === index ? { ...c, ...updates } : c),
        isDirty: true,
      }));
    },

    removeChord: (index) => {
      set((state) => ({
        chords: state.chords.filter((_, i) => i !== index),
        selectedChordIndex: state.selectedChordIndex === index ? null : state.selectedChordIndex,
        isDirty: true,
      }));
    },

    setChords: (chords) => set({ chords, isDirty: true }),
    setDetectedChords: (chords) => set({ detectedChords: chords, isDirty: true }),
    toggleDetectedChords: () => set((state) => ({ showDetectedChords: !state.showDetectedChords })),
    selectChord: (index) => set({ selectedChordIndex: index }),

    setInstrument: (instrument) => {
      const tuning = instrument === 'guitar' ? STANDARD_GUITAR_TUNING
        : instrument === 'bass' ? STANDARD_BASS_TUNING
        : STANDARD_UKULELE_TUNING;
      set({ instrument, tuning, isDirty: true });
    },

    setTuning: (tuning) => set({ tuning, isDirty: true }),
    setCapo: (capo) => set({ capo: Math.max(0, Math.min(12, capo)), isDirty: true }),

    // Lyrics actions
    setLyrics: (lyrics) => set({ lyrics, isDirty: true }),

    addLyricLine: (line) => {
      const id = generateId();
      set((state) => ({
        lyrics: [...state.lyrics, { ...line, id }].sort((a, b) => a.startTime - b.startTime),
        isDirty: true,
      }));
      return id;
    },

    updateLyricLine: (id, updates) => {
      set((state) => ({
        lyrics: state.lyrics.map(l => l.id === id ? { ...l, ...updates } : l),
        isDirty: true,
      }));
    },

    removeLyricLine: (id) => {
      set((state) => ({
        lyrics: state.lyrics.filter(l => l.id !== id),
        isDirty: true,
      }));
    },

    toggleLyrics: () => set((state) => ({ showLyrics: !state.showLyrics })),

    // Display settings (not persisted)
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

    // Editing
    setEditable: (editable) => set({ isEditable: editable }),

    clear: () => set({
      sections: [],
      chords: [],
      detectedChords: [],
      lyrics: [],
      currentBeat: 0,
      scrollOffset: 0,
      isDirty: true,
    }),

    markClean: () => set({ isDirty: false }),

    // Computed
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

// =============================================================================
// Auto-save subscription - saves notation/lyrics back to song when dirty
// =============================================================================

let saveTimeout: NodeJS.Timeout | null = null;
const SAVE_DEBOUNCE_MS = 500;

useNotationStore.subscribe(
  (state) => ({ isDirty: state.isDirty, currentSongId: state.currentSongId }),
  async ({ isDirty, currentSongId }) => {
    if (!isDirty || !currentSongId) return;

    // Clear existing timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // Debounced save
    saveTimeout = setTimeout(async () => {
      const { useSongsStore } = await import('./songs-store');
      const { getNotationData, getLyricsData, markClean } = useNotationStore.getState();

      const notation = getNotationData();
      const lyrics = getLyricsData();

      // Update song via songs-store (which handles persistence)
      useSongsStore.getState().updateSong(currentSongId, {
        notation,
        lyrics,
      });

      markClean();
    }, SAVE_DEBOUNCE_MS);
  },
  { equalityFn: (a, b) => a.isDirty === b.isDirty && a.currentSongId === b.currentSongId }
);
