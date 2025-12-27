import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// BPM Modes
export type BpmMode = 'locked' | 'follow-analyzer' | 'tap-tempo';

export interface MetronomeSettings {
  // Core metronome settings
  enabled: boolean;
  bpm: number;
  volume: number; // 0-1

  // BPM mode control
  bpmMode: BpmMode;
  lockedBpm: number; // BPM to use in locked mode

  // Time signature
  beatsPerBar: number;
  beatUnit: number; // 4 = quarter note, 8 = eighth note

  // Click sound settings
  clickType: 'digital' | 'woodblock' | 'cowbell' | 'hihat' | 'rimshot';
  accentFirstBeat: boolean;

  // Visual metronome
  showVisualBeat: boolean;

  // Tap tempo history
  tapTempoTimes: number[];

  // Broadcast settings
  broadcastEnabled: boolean; // Send metronome clicks to other users via WebRTC
}

export interface MetronomeState extends MetronomeSettings {
  // Current beat position (1-indexed)
  currentBeat: number;

  // Is metronome actively playing
  isPlaying: boolean;

  // Last detected BPM from analyzer (for follow mode)
  analyzerBpm: number | null;

  // Actions
  setEnabled: (enabled: boolean) => void;
  setBpm: (bpm: number) => void;
  setVolume: (volume: number) => void;
  setBpmMode: (mode: BpmMode) => void;
  setLockedBpm: (bpm: number) => void;
  setBeatsPerBar: (beats: number) => void;
  setBeatUnit: (unit: number) => void;
  setClickType: (type: MetronomeSettings['clickType']) => void;
  setAccentFirstBeat: (accent: boolean) => void;
  setShowVisualBeat: (show: boolean) => void;
  setBroadcastEnabled: (enabled: boolean) => void;

  // Tap tempo
  recordTap: () => void;
  clearTapTempo: () => void;

  // State updates (called by metronome engine)
  setCurrentBeat: (beat: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setAnalyzerBpm: (bpm: number | null) => void;

  // Get effective BPM based on mode
  getEffectiveBpm: () => number;

  // Reset
  reset: () => void;
}

const DEFAULT_BPM = 120;
const MIN_BPM = 40;
const MAX_BPM = 240;
const TAP_TEMPO_WINDOW = 3000; // 3 second window for tap tempo
const TAP_TEMPO_MAX_TAPS = 8; // Maximum taps to average

function clampBpm(bpm: number): number {
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm)));
}

function calculateTapTempoBpm(times: number[]): number | null {
  if (times.length < 2) return null;

  // Calculate intervals between taps
  const intervals: number[] = [];
  for (let i = 1; i < times.length; i++) {
    intervals.push(times[i] - times[i - 1]);
  }

  // Calculate average interval
  const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;

  // Convert to BPM (60000ms / interval = BPM)
  const bpm = 60000 / avgInterval;

  return clampBpm(bpm);
}

const initialState: Omit<MetronomeState,
  'setEnabled' | 'setBpm' | 'setVolume' | 'setBpmMode' | 'setLockedBpm' |
  'setBeatsPerBar' | 'setBeatUnit' | 'setClickType' | 'setAccentFirstBeat' |
  'setShowVisualBeat' | 'setBroadcastEnabled' | 'recordTap' | 'clearTapTempo' |
  'setCurrentBeat' | 'setIsPlaying' | 'setAnalyzerBpm' | 'getEffectiveBpm' | 'reset'
> = {
  enabled: false,
  bpm: DEFAULT_BPM,
  volume: 0.7,
  bpmMode: 'locked',
  lockedBpm: DEFAULT_BPM,
  beatsPerBar: 4,
  beatUnit: 4,
  clickType: 'digital',
  accentFirstBeat: true,
  showVisualBeat: true,
  tapTempoTimes: [],
  broadcastEnabled: false,
  currentBeat: 0,
  isPlaying: false,
  analyzerBpm: null,
};

export const useMetronomeStore = create<MetronomeState>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setEnabled: (enabled) => set({ enabled }),

    setBpm: (bpm) => set({ bpm: clampBpm(bpm) }),

    setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),

    setBpmMode: (mode) => {
      set({ bpmMode: mode });

      // When switching to locked mode, use current effective BPM
      if (mode === 'locked') {
        const state = get();
        const effectiveBpm = state.getEffectiveBpm();
        set({ lockedBpm: effectiveBpm });
      }
    },

    setLockedBpm: (bpm) => set({ lockedBpm: clampBpm(bpm) }),

    setBeatsPerBar: (beats) => set({
      beatsPerBar: Math.max(1, Math.min(16, beats))
    }),

    setBeatUnit: (unit) => set({ beatUnit: unit }),

    setClickType: (type) => set({ clickType: type }),

    setAccentFirstBeat: (accent) => set({ accentFirstBeat: accent }),

    setShowVisualBeat: (show) => set({ showVisualBeat: show }),

    setBroadcastEnabled: (enabled) => set({ broadcastEnabled: enabled }),

    recordTap: () => {
      const now = Date.now();
      const state = get();

      // Filter out old taps outside the window
      const recentTaps = state.tapTempoTimes.filter(
        t => now - t < TAP_TEMPO_WINDOW
      );

      // Add new tap
      const newTaps = [...recentTaps, now].slice(-TAP_TEMPO_MAX_TAPS);

      // Calculate BPM from taps
      const tapBpm = calculateTapTempoBpm(newTaps);

      set({
        tapTempoTimes: newTaps,
        // If in tap tempo mode, update the BPM
        ...(state.bpmMode === 'tap-tempo' && tapBpm ? { bpm: tapBpm } : {})
      });
    },

    clearTapTempo: () => set({ tapTempoTimes: [] }),

    setCurrentBeat: (beat) => set({ currentBeat: beat }),

    setIsPlaying: (playing) => set({ isPlaying: playing }),

    setAnalyzerBpm: (bpm) => {
      const state = get();
      set({ analyzerBpm: bpm });

      // If in follow mode, update the effective BPM
      if (state.bpmMode === 'follow-analyzer' && bpm !== null) {
        set({ bpm: clampBpm(bpm) });
      }
    },

    getEffectiveBpm: () => {
      const state = get();

      switch (state.bpmMode) {
        case 'locked':
          return state.lockedBpm;

        case 'follow-analyzer':
          // Use analyzer BPM if available, otherwise fall back to locked
          return state.analyzerBpm !== null
            ? clampBpm(state.analyzerBpm)
            : state.lockedBpm;

        case 'tap-tempo':
          // Use calculated tap tempo BPM, or fall back to current BPM
          const tapBpm = calculateTapTempoBpm(state.tapTempoTimes);
          return tapBpm !== null ? tapBpm : state.bpm;

        default:
          return state.bpm;
      }
    },

    reset: () => set(initialState),
  }))
);

// Selector for effective BPM (memoized)
export const selectEffectiveBpm = (state: MetronomeState) => {
  switch (state.bpmMode) {
    case 'locked':
      return state.lockedBpm;
    case 'follow-analyzer':
      return state.analyzerBpm !== null
        ? clampBpm(state.analyzerBpm)
        : state.lockedBpm;
    case 'tap-tempo':
      const tapBpm = calculateTapTempoBpm(state.tapTempoTimes);
      return tapBpm !== null ? tapBpm : state.bpm;
    default:
      return state.bpm;
  }
};
