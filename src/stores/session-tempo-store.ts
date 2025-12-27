import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * Tempo Source - determines where the session tempo comes from
 *
 * - 'manual': User-set tempo, doesn't change automatically
 * - 'track': Uses the current backing track's BPM metadata
 * - 'analyzer': Real-time BPM detection from audio analysis
 * - 'tap': Tap tempo (temporary, usually converts to manual)
 */
export type TempoSource = 'manual' | 'track' | 'analyzer' | 'tap';

/**
 * Session Tempo State
 *
 * This is the SINGLE SOURCE OF TRUTH for the session's tempo.
 * Both metronome and loop scheduler should reference this.
 */
interface SessionTempoState {
  // ============================================
  // Core Tempo State
  // ============================================

  /** The effective tempo for the session (40-240 BPM) */
  tempo: number;

  /** Where the tempo is coming from */
  source: TempoSource;

  /** Manual tempo value (used when source = 'manual') */
  manualTempo: number;

  /** Track metadata tempo (used when source = 'track') */
  trackTempo: number | null;

  /** Analyzer detected tempo (used when source = 'analyzer') */
  analyzerTempo: number | null;

  /** Analyzer confidence (0-1) */
  analyzerConfidence: number;

  // ============================================
  // Musical Key State
  // ============================================

  /** The effective key for the session */
  key: string | null;

  /** Major or minor */
  keyScale: 'major' | 'minor' | null;

  /** Where the key is coming from */
  keySource: 'manual' | 'track' | 'analyzer';

  /** Manual key override */
  manualKey: string | null;
  manualKeyScale: 'major' | 'minor' | null;

  /** Track metadata key */
  trackKey: string | null;
  trackKeyScale: 'major' | 'minor' | null;

  /** Analyzer detected key */
  analyzerKey: string | null;
  analyzerKeyScale: 'major' | 'minor' | null;

  // ============================================
  // Time Signature
  // ============================================

  /** Beats per bar */
  beatsPerBar: number;

  /** Beat unit (4 = quarter note) */
  beatUnit: number;

  // ============================================
  // Tap Tempo
  // ============================================

  /** Tap tempo timestamps */
  tapTimes: number[];

  // ============================================
  // Actions
  // ============================================

  // Tempo source control
  setSource: (source: TempoSource) => void;

  // Manual tempo
  setManualTempo: (bpm: number) => void;

  // Track metadata updates (called when backing track changes)
  setTrackMetadata: (metadata: {
    bpm?: number;
    key?: string;
    keyScale?: 'major' | 'minor';
    timeSignature?: [number, number];
  } | null) => void;

  // Analyzer updates (called from analysis hook)
  setAnalyzerData: (data: {
    bpm?: number | null;
    bpmConfidence?: number;
    key?: string | null;
    keyScale?: 'major' | 'minor' | null;
  }) => void;

  // Tap tempo
  recordTap: () => void;
  clearTaps: () => void;

  // Key source control
  setKeySource: (source: 'manual' | 'track' | 'analyzer') => void;
  setManualKey: (key: string | null, scale?: 'major' | 'minor' | null) => void;

  // Time signature
  setTimeSignature: (beatsPerBar: number, beatUnit: number) => void;

  // Computed getters
  getEffectiveTempo: () => number;
  getEffectiveKey: () => { key: string | null; scale: 'major' | 'minor' | null };

  // Reset
  reset: () => void;
}

// Constants
const MIN_BPM = 40;
const MAX_BPM = 240;
const DEFAULT_BPM = 120;
const TAP_TEMPO_WINDOW_MS = 3000;
const TAP_TEMPO_MAX_TAPS = 8;

function clampBpm(bpm: number): number {
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm)));
}

function calculateTapBpm(times: number[]): number | null {
  if (times.length < 2) return null;

  const intervals: number[] = [];
  for (let i = 1; i < times.length; i++) {
    intervals.push(times[i] - times[i - 1]);
  }

  const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
  return clampBpm(60000 / avgInterval);
}

const initialState = {
  tempo: DEFAULT_BPM,
  source: 'manual' as TempoSource,
  manualTempo: DEFAULT_BPM,
  trackTempo: null as number | null,
  analyzerTempo: null as number | null,
  analyzerConfidence: 0,
  key: null as string | null,
  keyScale: null as 'major' | 'minor' | null,
  keySource: 'manual' as 'manual' | 'track' | 'analyzer',
  manualKey: null as string | null,
  manualKeyScale: null as 'major' | 'minor' | null,
  trackKey: null as string | null,
  trackKeyScale: null as 'major' | 'minor' | null,
  analyzerKey: null as string | null,
  analyzerKeyScale: null as 'major' | 'minor' | null,
  beatsPerBar: 4,
  beatUnit: 4,
  tapTimes: [] as number[],
};

export const useSessionTempoStore = create<SessionTempoState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setSource: (source) => {
      set({ source });
      // Recalculate effective tempo
      const state = get();
      set({ tempo: calculateEffectiveTempo(state, source) });
    },

    setManualTempo: (bpm) => {
      const clamped = clampBpm(bpm);
      set({ manualTempo: clamped });

      // If in manual mode, update effective tempo
      if (get().source === 'manual') {
        set({ tempo: clamped });
      }
    },

    setTrackMetadata: (metadata) => {
      if (!metadata) {
        set({
          trackTempo: null,
          trackKey: null,
          trackKeyScale: null,
        });
      } else {
        const updates: Partial<SessionTempoState> = {};

        if (metadata.bpm !== undefined) {
          updates.trackTempo = metadata.bpm ? clampBpm(metadata.bpm) : null;
        }
        if (metadata.key !== undefined) {
          updates.trackKey = metadata.key || null;
        }
        if (metadata.keyScale !== undefined) {
          updates.trackKeyScale = metadata.keyScale || null;
        }
        if (metadata.timeSignature) {
          updates.beatsPerBar = metadata.timeSignature[0];
          updates.beatUnit = metadata.timeSignature[1];
        }

        set(updates);
      }

      // Recalculate effective tempo and key
      const state = get();
      if (state.source === 'track') {
        set({ tempo: calculateEffectiveTempo(state, 'track') });
      }
      if (state.keySource === 'track') {
        set({
          key: state.trackKey,
          keyScale: state.trackKeyScale,
        });
      }
    },

    setAnalyzerData: (data) => {
      const updates: Partial<SessionTempoState> = {};

      if (data.bpm !== undefined) {
        updates.analyzerTempo = data.bpm ? clampBpm(data.bpm) : null;
      }
      if (data.bpmConfidence !== undefined) {
        updates.analyzerConfidence = data.bpmConfidence;
      }
      if (data.key !== undefined) {
        updates.analyzerKey = data.key;
      }
      if (data.keyScale !== undefined) {
        updates.analyzerKeyScale = data.keyScale;
      }

      set(updates);

      // Recalculate effective tempo if in analyzer mode
      const state = get();
      if (state.source === 'analyzer' && data.bpm) {
        set({ tempo: clampBpm(data.bpm) });
      }
      if (state.keySource === 'analyzer' && data.key) {
        set({
          key: data.key,
          keyScale: data.keyScale || null,
        });
      }
    },

    recordTap: () => {
      const now = Date.now();
      const state = get();

      // Filter old taps
      const recentTaps = state.tapTimes.filter(
        (t) => now - t < TAP_TEMPO_WINDOW_MS
      );

      // Add new tap
      const newTaps = [...recentTaps, now].slice(-TAP_TEMPO_MAX_TAPS);

      set({ tapTimes: newTaps });

      // Calculate and apply tap tempo
      const tapBpm = calculateTapBpm(newTaps);
      if (tapBpm && state.source === 'tap') {
        set({ tempo: tapBpm, manualTempo: tapBpm });
      }
    },

    clearTaps: () => set({ tapTimes: [] }),

    setKeySource: (source) => {
      set({ keySource: source });

      // Update effective key
      const state = get();
      switch (source) {
        case 'manual':
          set({ key: state.manualKey, keyScale: state.manualKeyScale });
          break;
        case 'track':
          set({ key: state.trackKey, keyScale: state.trackKeyScale });
          break;
        case 'analyzer':
          set({ key: state.analyzerKey, keyScale: state.analyzerKeyScale });
          break;
      }
    },

    setManualKey: (key, scale) => {
      set({
        manualKey: key,
        manualKeyScale: scale ?? null,
      });

      if (get().keySource === 'manual') {
        set({ key, keyScale: scale ?? null });
      }
    },

    setTimeSignature: (beatsPerBar, beatUnit) => {
      set({
        beatsPerBar: Math.max(1, Math.min(16, beatsPerBar)),
        beatUnit,
      });
    },

    getEffectiveTempo: () => {
      const state = get();
      return calculateEffectiveTempo(state, state.source);
    },

    getEffectiveKey: () => {
      const state = get();
      return { key: state.key, scale: state.keyScale };
    },

    reset: () => set(initialState),
  }))
);

// Helper to calculate effective tempo based on source
function calculateEffectiveTempo(
  state: SessionTempoState,
  source: TempoSource
): number {
  switch (source) {
    case 'manual':
      return state.manualTempo;

    case 'track':
      // Use track tempo if available, otherwise fall back to manual
      return state.trackTempo ?? state.manualTempo;

    case 'analyzer':
      // Use analyzer tempo if available and confident, otherwise fall back
      if (state.analyzerTempo && state.analyzerConfidence > 0.5) {
        return state.analyzerTempo;
      }
      // Fall back to track tempo, then manual
      return state.trackTempo ?? state.manualTempo;

    case 'tap':
      // Calculate from tap times
      const tapBpm = calculateTapBpm(state.tapTimes);
      return tapBpm ?? state.manualTempo;

    default:
      return state.manualTempo;
  }
}

// ============================================
// Selectors for efficient subscriptions
// ============================================

export const selectTempo = (state: SessionTempoState) => state.tempo;
export const selectSource = (state: SessionTempoState) => state.source;
export const selectKey = (state: SessionTempoState) => ({
  key: state.key,
  scale: state.keyScale,
});
export const selectTimeSignature = (state: SessionTempoState) => ({
  beatsPerBar: state.beatsPerBar,
  beatUnit: state.beatUnit,
});
export const selectAnalyzerData = (state: SessionTempoState) => ({
  tempo: state.analyzerTempo,
  confidence: state.analyzerConfidence,
  key: state.analyzerKey,
  keyScale: state.analyzerKeyScale,
});
