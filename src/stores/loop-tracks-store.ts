import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { LoopTrackState, LoopDefinition } from '@/types/loops';
import type { TrackEffectsChain } from '@/types';
import { DEFAULT_EFFECTS_CHAIN } from '@/lib/audio/effects/presets';

// Track color palette for loops
const LOOP_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
];

let colorIndex = 0;
const getNextColor = () => {
  const color = LOOP_COLORS[colorIndex % LOOP_COLORS.length];
  colorIndex++;
  return color;
};

interface LoopTracksState {
  // All loop tracks indexed by ID
  tracks: Map<string, LoopTrackState>;

  // Track order for UI
  trackOrder: string[];

  // Currently previewing loop (in browser modal)
  previewingLoopId: string | null;

  // Master tempo/key for adaptation
  masterTempo: number;
  masterKey: string | null;

  // Actions
  addTrack: (
    roomId: string,
    loopDef: LoopDefinition,
    userId: string,
    userName?: string
  ) => LoopTrackState;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<LoopTrackState>) => void;

  // Playback state
  setTrackPlaying: (trackId: string, isPlaying: boolean, startTime?: number) => void;
  stopAllTracks: () => void;

  // Mixer controls
  setTrackVolume: (trackId: string, volume: number) => void;
  setTrackPan: (trackId: string, pan: number) => void;
  setTrackMuted: (trackId: string, muted: boolean) => void;
  setTrackSolo: (trackId: string, solo: boolean) => void;

  // Sound settings
  setTrackSoundPreset: (trackId: string, preset: string) => void;

  // Musical adaptation
  setTrackTempoLocked: (trackId: string, locked: boolean) => void;
  setTrackTargetBpm: (trackId: string, bpm: number | undefined) => void;
  setTrackKeyLocked: (trackId: string, locked: boolean) => void;
  setTrackTargetKey: (trackId: string, key: string | undefined) => void;

  // Humanization
  setTrackHumanize: (
    trackId: string,
    enabled: boolean,
    timing?: number,
    velocity?: number
  ) => void;

  // Effects
  setTrackEffects: (trackId: string, effects: Partial<TrackEffectsChain>) => void;

  // Master settings
  setMasterTempo: (bpm: number) => void;
  setMasterKey: (key: string | null) => void;

  // Preview
  setPreviewingLoop: (loopId: string | null) => void;

  // Persistence
  loadTracks: (tracks: LoopTrackState[]) => void;

  // Query helpers
  getTrack: (trackId: string) => LoopTrackState | undefined;
  getAllTracks: () => LoopTrackState[];
  getPlayingTracks: () => LoopTrackState[];
  getTracksByRoom: (roomId: string) => LoopTrackState[];

  // Reset
  reset: () => void;
}

export const useLoopTracksStore = create<LoopTracksState>()(
  subscribeWithSelector((set, get) => ({
    tracks: new Map(),
    trackOrder: [],
    previewingLoopId: null,
    masterTempo: 120,
    masterKey: null,

    addTrack: (roomId, loopDef, userId, userName) => {
      const track: LoopTrackState = {
        id: `loop-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        roomId,
        createdBy: userId,
        createdByName: userName,
        loopId: loopDef.id,
        isPlaying: false,
        loopStartBeat: 0,
        soundPreset: loopDef.soundPreset,
        soundSettings: {},
        tempoLocked: false,
        keyLocked: false,
        transposeAmount: 0,
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
        effects: { ...DEFAULT_EFFECTS_CHAIN },
        humanizeEnabled: false,
        humanizeTiming: 0.05,
        humanizeVelocity: 0.1,
        color: getNextColor(),
        name: loopDef.name,
        position: get().trackOrder.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      set((state) => {
        const tracks = new Map(state.tracks);
        tracks.set(track.id, track);
        return {
          tracks,
          trackOrder: [...state.trackOrder, track.id],
        };
      });

      return track;
    },

    removeTrack: (trackId) =>
      set((state) => {
        const tracks = new Map(state.tracks);
        tracks.delete(trackId);
        return {
          tracks,
          trackOrder: state.trackOrder.filter((id) => id !== trackId),
        };
      }),

    updateTrack: (trackId, updates) =>
      set((state) => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const tracks = new Map(state.tracks);
        tracks.set(trackId, {
          ...track,
          ...updates,
          updatedAt: new Date().toISOString(),
        });
        return { tracks };
      }),

    setTrackPlaying: (trackId, isPlaying, startTime) => {
      get().updateTrack(trackId, {
        isPlaying,
        startTime: startTime,
      });
    },

    stopAllTracks: () =>
      set((state) => {
        const tracks = new Map(state.tracks);
        for (const [id, track] of tracks) {
          tracks.set(id, { ...track, isPlaying: false });
        }
        return { tracks };
      }),

    setTrackVolume: (trackId, volume) => {
      get().updateTrack(trackId, { volume: Math.max(0, Math.min(2, volume)) });
    },

    setTrackPan: (trackId, pan) => {
      get().updateTrack(trackId, { pan: Math.max(-1, Math.min(1, pan)) });
    },

    setTrackMuted: (trackId, muted) => {
      get().updateTrack(trackId, { muted });
    },

    setTrackSolo: (trackId, solo) => {
      get().updateTrack(trackId, { solo });
    },

    setTrackSoundPreset: (trackId, preset) => {
      get().updateTrack(trackId, { soundPreset: preset });
    },

    setTrackTempoLocked: (trackId, locked) => {
      get().updateTrack(trackId, { tempoLocked: locked });
    },

    setTrackTargetBpm: (trackId, bpm) => {
      get().updateTrack(trackId, { targetBpm: bpm });
    },

    setTrackKeyLocked: (trackId, locked) => {
      get().updateTrack(trackId, { keyLocked: locked });
    },

    setTrackTargetKey: (trackId, key) => {
      get().updateTrack(trackId, { targetKey: key });
    },

    setTrackHumanize: (trackId, enabled, timing, velocity) => {
      const updates: Partial<LoopTrackState> = { humanizeEnabled: enabled };
      if (timing !== undefined) updates.humanizeTiming = timing;
      if (velocity !== undefined) updates.humanizeVelocity = velocity;
      get().updateTrack(trackId, updates);
    },

    setTrackEffects: (trackId, effects) => {
      const track = get().tracks.get(trackId);
      if (!track) return;

      const currentEffects = track.effects || DEFAULT_EFFECTS_CHAIN;
      const newEffects: TrackEffectsChain = {
        noiseGate: effects.noiseGate
          ? { ...currentEffects.noiseGate, ...effects.noiseGate }
          : currentEffects.noiseGate,
        eq: effects.eq
          ? {
              enabled: effects.eq.enabled ?? currentEffects.eq.enabled,
              bands: effects.eq.bands ?? currentEffects.eq.bands,
            }
          : currentEffects.eq,
        compressor: effects.compressor
          ? { ...currentEffects.compressor, ...effects.compressor }
          : currentEffects.compressor,
        reverb: effects.reverb
          ? { ...currentEffects.reverb, ...effects.reverb }
          : currentEffects.reverb,
        limiter: effects.limiter
          ? { ...currentEffects.limiter, ...effects.limiter }
          : currentEffects.limiter,
      };

      get().updateTrack(trackId, { effects: newEffects });
    },

    setMasterTempo: (bpm) => set({ masterTempo: Math.max(40, Math.min(240, bpm)) }),

    setMasterKey: (key) => set({ masterKey: key }),

    setPreviewingLoop: (loopId) => set({ previewingLoopId: loopId }),

    loadTracks: (tracks) =>
      set(() => {
        const trackMap = new Map<string, LoopTrackState>();
        const order: string[] = [];

        // Sort by position
        const sorted = [...tracks].sort((a, b) => a.position - b.position);

        for (const track of sorted) {
          trackMap.set(track.id, track);
          order.push(track.id);
        }

        return { tracks: trackMap, trackOrder: order };
      }),

    getTrack: (trackId) => get().tracks.get(trackId),

    getAllTracks: () => {
      const state = get();
      return state.trackOrder
        .map((id) => state.tracks.get(id))
        .filter((t): t is LoopTrackState => t !== undefined);
    },

    getPlayingTracks: () => {
      return get()
        .getAllTracks()
        .filter((t) => t.isPlaying);
    },

    getTracksByRoom: (roomId) => {
      return get()
        .getAllTracks()
        .filter((t) => t.roomId === roomId);
    },

    reset: () => {
      colorIndex = 0;
      set({
        tracks: new Map(),
        trackOrder: [],
        previewingLoopId: null,
        masterTempo: 120,
        masterKey: null,
      });
    },
  }))
);
