import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * Metronome Settings Store
 *
 * This store manages metronome-specific settings like:
 * - Enabled state
 * - Volume
 * - Click sound type
 * - Accent settings
 * - Broadcast toggle
 *
 * IMPORTANT: Tempo/BPM is managed by the Session Tempo Store.
 * Use useSessionTempoStore for tempo-related state.
 */

export interface MetronomeSettings {
  // Core metronome settings
  enabled: boolean;
  volume: number; // 0-1

  // Click sound settings
  clickType: 'digital' | 'woodblock' | 'cowbell' | 'hihat' | 'rimshot';
  accentFirstBeat: boolean;

  // Visual metronome
  showVisualBeat: boolean;

  // Broadcast settings
  broadcastEnabled: boolean; // Send metronome clicks to other users via WebRTC
}

export interface MetronomeState extends MetronomeSettings {
  // Current beat position (1-indexed)
  currentBeat: number;

  // Is metronome actively playing
  isPlaying: boolean;

  // Actions
  setEnabled: (enabled: boolean) => void;
  setVolume: (volume: number) => void;
  setClickType: (type: MetronomeSettings['clickType']) => void;
  setAccentFirstBeat: (accent: boolean) => void;
  setShowVisualBeat: (show: boolean) => void;
  setBroadcastEnabled: (enabled: boolean) => void;

  // State updates (called by metronome engine)
  setCurrentBeat: (beat: number) => void;
  setIsPlaying: (playing: boolean) => void;

  // Reset
  reset: () => void;
}

const initialState: Omit<
  MetronomeState,
  | 'setEnabled'
  | 'setVolume'
  | 'setClickType'
  | 'setAccentFirstBeat'
  | 'setShowVisualBeat'
  | 'setBroadcastEnabled'
  | 'setCurrentBeat'
  | 'setIsPlaying'
  | 'reset'
> = {
  enabled: false,
  volume: 0.7,
  clickType: 'digital',
  accentFirstBeat: true,
  showVisualBeat: true,
  broadcastEnabled: false,
  currentBeat: 0,
  isPlaying: false,
};

export const useMetronomeStore = create<MetronomeState>()(
  subscribeWithSelector((set) => ({
    ...initialState,

    setEnabled: (enabled) => set({ enabled }),

    setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),

    setClickType: (type) => set({ clickType: type }),

    setAccentFirstBeat: (accent) => set({ accentFirstBeat: accent }),

    setShowVisualBeat: (show) => set({ showVisualBeat: show }),

    setBroadcastEnabled: (enabled) => set({ broadcastEnabled: enabled }),

    setCurrentBeat: (beat) => set({ currentBeat: beat }),

    setIsPlaying: (playing) => set({ isPlaying: playing }),

    reset: () => set(initialState),
  }))
);

// Legacy exports for backwards compatibility
// BPM modes are now in session-tempo-store
export type BpmMode = 'manual' | 'track' | 'analyzer' | 'tap';
