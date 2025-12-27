import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { UserTrack, TrackAudioSettings } from '@/types';

// Track color palette
const TRACK_COLORS = [
  '#f472b6', // Pink
  '#fb923c', // Orange
  '#a3e635', // Lime
  '#22d3ee', // Cyan
  '#a78bfa', // Violet
  '#fbbf24', // Yellow
  '#34d399', // Emerald
  '#f87171', // Red
  '#60a5fa', // Blue
  '#c084fc', // Purple
];

const DEFAULT_AUDIO_SETTINGS: TrackAudioSettings = {
  inputMode: 'microphone',
  inputDeviceId: 'default',
  sampleRate: 48000,
  bufferSize: 256,
  noiseSuppression: false,
  echoCancellation: false,
  autoGainControl: false,
};

interface UserTracksState {
  // All tracks indexed by track ID
  tracks: Map<string, UserTrack>;

  // Track IDs ordered by creation for each user
  userTrackOrder: Map<string, string[]>;

  // Audio levels per track
  trackLevels: Map<string, number>;

  // Available audio devices
  inputDevices: MediaDeviceInfo[];
  outputDevices: MediaDeviceInfo[];
  devicesLoaded: boolean;

  // Actions
  addTrack: (userId: string, name?: string, settings?: Partial<TrackAudioSettings>) => UserTrack;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<UserTrack>) => void;
  updateTrackSettings: (trackId: string, settings: Partial<TrackAudioSettings>) => void;

  // Track state actions
  setTrackMuted: (trackId: string, muted: boolean) => void;
  setTrackSolo: (trackId: string, solo: boolean) => void;
  setTrackVolume: (trackId: string, volume: number) => void;
  setTrackArmed: (trackId: string, armed: boolean) => void;
  setTrackRecording: (trackId: string, recording: boolean) => void;
  setTrackStream: (trackId: string, stream: MediaStream | undefined) => void;

  // Level actions
  setTrackLevel: (trackId: string, level: number) => void;

  // Device actions
  loadDevices: () => Promise<void>;
  setInputDevices: (devices: MediaDeviceInfo[]) => void;
  setOutputDevices: (devices: MediaDeviceInfo[]) => void;

  // Query helpers
  getTracksByUser: (userId: string) => UserTrack[];
  getTrack: (trackId: string) => UserTrack | undefined;
  getAllTracks: () => UserTrack[];

  // Reset
  reset: () => void;
  removeUserTracks: (userId: string) => void;
}

let colorIndex = 0;
const getNextColor = () => {
  const color = TRACK_COLORS[colorIndex % TRACK_COLORS.length];
  colorIndex++;
  return color;
};

export const useUserTracksStore = create<UserTracksState>()(
  subscribeWithSelector((set, get) => ({
    tracks: new Map(),
    userTrackOrder: new Map(),
    trackLevels: new Map(),
    inputDevices: [],
    outputDevices: [],
    devicesLoaded: false,

    addTrack: (userId, name, settings) => {
      const state = get();
      const userTracks = state.userTrackOrder.get(userId) || [];
      const trackNumber = userTracks.length + 1;

      const track: UserTrack = {
        id: `${userId}-track-${Date.now()}`,
        userId,
        name: name || `Track ${trackNumber}`,
        color: getNextColor(),
        audioSettings: { ...DEFAULT_AUDIO_SETTINGS, ...settings },
        isMuted: false,
        isSolo: false,
        volume: 1,
        isArmed: true, // New tracks are armed by default
        isRecording: false,
        createdAt: Date.now(),
      };

      set((state) => {
        const tracks = new Map(state.tracks);
        tracks.set(track.id, track);

        const userTrackOrder = new Map(state.userTrackOrder);
        const order = userTrackOrder.get(userId) || [];
        userTrackOrder.set(userId, [...order, track.id]);

        return { tracks, userTrackOrder };
      });

      return track;
    },

    removeTrack: (trackId) =>
      set((state) => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const tracks = new Map(state.tracks);
        tracks.delete(trackId);

        const userTrackOrder = new Map(state.userTrackOrder);
        const order = userTrackOrder.get(track.userId) || [];
        userTrackOrder.set(
          track.userId,
          order.filter((id) => id !== trackId)
        );

        const trackLevels = new Map(state.trackLevels);
        trackLevels.delete(trackId);

        return { tracks, userTrackOrder, trackLevels };
      }),

    updateTrack: (trackId, updates) =>
      set((state) => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const tracks = new Map(state.tracks);
        tracks.set(trackId, { ...track, ...updates });
        return { tracks };
      }),

    updateTrackSettings: (trackId, settings) =>
      set((state) => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const tracks = new Map(state.tracks);
        tracks.set(trackId, {
          ...track,
          audioSettings: { ...track.audioSettings, ...settings },
        });
        return { tracks };
      }),

    setTrackMuted: (trackId, muted) => get().updateTrack(trackId, { isMuted: muted }),
    setTrackSolo: (trackId, solo) => get().updateTrack(trackId, { isSolo: solo }),
    setTrackVolume: (trackId, volume) => get().updateTrack(trackId, { volume }),
    setTrackArmed: (trackId, armed) => get().updateTrack(trackId, { isArmed: armed }),
    setTrackRecording: (trackId, recording) => get().updateTrack(trackId, { isRecording: recording }),
    setTrackStream: (trackId, stream) => get().updateTrack(trackId, { stream }),

    setTrackLevel: (trackId, level) =>
      set((state) => {
        const trackLevels = new Map(state.trackLevels);
        trackLevels.set(trackId, level);
        return { trackLevels };
      }),

    loadDevices: async () => {
      try {
        // Request permission first to get device labels
        await navigator.mediaDevices.getUserMedia({ audio: true });

        const devices = await navigator.mediaDevices.enumerateDevices();

        const inputs = devices.filter((d) => d.kind === 'audioinput');
        const outputs = devices.filter((d) => d.kind === 'audiooutput');

        set({ inputDevices: inputs, outputDevices: outputs, devicesLoaded: true });
      } catch {
        set({ devicesLoaded: true });
      }
    },

    setInputDevices: (devices) => set({ inputDevices: devices }),
    setOutputDevices: (devices) => set({ outputDevices: devices }),

    getTracksByUser: (userId) => {
      const state = get();
      const order = state.userTrackOrder.get(userId) || [];
      return order
        .map((id) => state.tracks.get(id))
        .filter((t): t is UserTrack => t !== undefined);
    },

    getTrack: (trackId) => get().tracks.get(trackId),

    getAllTracks: () => {
      const state = get();
      const allTracks: UserTrack[] = [];
      for (const [, order] of state.userTrackOrder) {
        for (const trackId of order) {
          const track = state.tracks.get(trackId);
          if (track) allTracks.push(track);
        }
      }
      return allTracks;
    },

    removeUserTracks: (userId) =>
      set((state) => {
        const order = state.userTrackOrder.get(userId) || [];
        const tracks = new Map(state.tracks);
        const trackLevels = new Map(state.trackLevels);

        for (const trackId of order) {
          tracks.delete(trackId);
          trackLevels.delete(trackId);
        }

        const userTrackOrder = new Map(state.userTrackOrder);
        userTrackOrder.delete(userId);

        return { tracks, userTrackOrder, trackLevels };
      }),

    reset: () => {
      colorIndex = 0;
      set({
        tracks: new Map(),
        userTrackOrder: new Map(),
        trackLevels: new Map(),
      });
    },
  }))
);
