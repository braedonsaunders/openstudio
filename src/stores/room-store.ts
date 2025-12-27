import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { User, Room, RoomSettings, BackingTrack, TrackQueue, RoomMessage, StemMixState } from '@/types';

// Synced analysis data from master
export interface SyncedAnalysisData {
  key: string | null;
  keyScale: 'major' | 'minor' | null;
  bpm: number | null;
  updatedBy: string;
  updatedAt: number;
}

interface RoomState {
  // Room data
  room: Room | null;
  users: Map<string, User>;
  currentUser: User | null;
  isMaster: boolean;

  // Track queue
  queue: TrackQueue;
  currentTrack: BackingTrack | null;

  // Stem mixing
  stemMixState: StemMixState;
  stemsAvailable: boolean;

  // Chat
  messages: RoomMessage[];

  // Connection status
  isConnected: boolean;
  isJoining: boolean;
  error: string | null;

  // Audio levels
  audioLevels: Map<string, number>;

  // Synced audio analysis
  syncedAnalysis: SyncedAnalysisData | null;

  // Waveform data for current track
  waveformData: number[] | null;

  // Actions
  setRoom: (room: Room) => void;
  setCurrentUser: (user: User) => void;
  addUser: (user: User) => void;
  removeUser: (userId: string) => void;
  updateUser: (userId: string, updates: Partial<User>) => void;
  setIsMaster: (isMaster: boolean) => void;

  // Queue actions
  setQueue: (queue: TrackQueue) => void;
  addToQueue: (track: BackingTrack) => void;
  removeFromQueue: (trackId: string) => void;
  setCurrentTrack: (track: BackingTrack | null) => void;
  setQueuePlaying: (isPlaying: boolean) => void;
  setQueueTime: (time: number) => void;
  nextTrack: () => void;
  previousTrack: () => void;
  jumpToTrack: (index: number) => void;

  // Stem actions
  setStemMixState: (state: StemMixState) => void;
  toggleStem: (stem: keyof StemMixState) => void;
  setStemVolume: (stem: keyof StemMixState, volume: number) => void;
  setStemsAvailable: (available: boolean) => void;

  // Chat actions
  addMessage: (message: RoomMessage) => void;
  clearMessages: () => void;

  // Connection actions
  setConnected: (connected: boolean) => void;
  setJoining: (joining: boolean) => void;
  setError: (error: string | null) => void;

  // Audio level actions
  setAudioLevel: (userId: string, level: number) => void;
  setAudioLevels: (levels: Map<string, number>) => void;

  // Synced analysis actions
  setSyncedAnalysis: (data: SyncedAnalysisData | null) => void;
  broadcastAnalysis: (key: string | null, keyScale: 'major' | 'minor' | null, bpm: number | null) => void;

  // Waveform actions
  setWaveformData: (data: number[] | null) => void;

  // Reset
  reset: () => void;
}

const initialQueue: TrackQueue = {
  tracks: [],
  currentIndex: -1,
  isPlaying: false,
  currentTime: 0,
  syncTimestamp: 0,
};

const initialStemMixState: StemMixState = {
  vocals: { enabled: true, volume: 1 },
  drums: { enabled: true, volume: 1 },
  bass: { enabled: true, volume: 1 },
  other: { enabled: true, volume: 1 },
};

export const useRoomStore = create<RoomState>()(
  subscribeWithSelector((set, get) => ({
    room: null,
    users: new Map(),
    currentUser: null,
    isMaster: false,
    queue: initialQueue,
    currentTrack: null,
    stemMixState: initialStemMixState,
    stemsAvailable: false,
    messages: [],
    isConnected: false,
    isJoining: false,
    error: null,
    audioLevels: new Map(),
    syncedAnalysis: null,
    waveformData: null,

    setRoom: (room) => set({ room }),
    setCurrentUser: (user) => set({ currentUser: user }),

    addUser: (user) =>
      set((state) => {
        const users = new Map(state.users);
        users.set(user.id, user);
        return { users };
      }),

    removeUser: (userId) =>
      set((state) => {
        const users = new Map(state.users);
        users.delete(userId);
        return { users };
      }),

    updateUser: (userId, updates) =>
      set((state) => {
        const users = new Map(state.users);
        const user = users.get(userId);
        if (user) {
          users.set(userId, { ...user, ...updates });
        }
        return { users };
      }),

    setIsMaster: (isMaster) => set({ isMaster }),

    setQueue: (queue) => set({ queue }),

    addToQueue: (track) =>
      set((state) => ({
        queue: {
          ...state.queue,
          tracks: [...state.queue.tracks, track],
        },
      })),

    removeFromQueue: (trackId) =>
      set((state) => ({
        queue: {
          ...state.queue,
          tracks: state.queue.tracks.filter((t) => t.id !== trackId),
        },
      })),

    setCurrentTrack: (track) =>
      set({
        currentTrack: track,
        stemsAvailable: !!track?.stems,
      }),

    setQueuePlaying: (isPlaying) =>
      set((state) => ({
        queue: { ...state.queue, isPlaying },
      })),

    setQueueTime: (time) =>
      set((state) => ({
        queue: { ...state.queue, currentTime: time },
      })),

    nextTrack: () =>
      set((state) => {
        const nextIndex = state.queue.currentIndex + 1;
        if (nextIndex >= state.queue.tracks.length) {
          return {
            queue: { ...state.queue, currentIndex: -1, isPlaying: false },
            currentTrack: null,
          };
        }
        return {
          queue: { ...state.queue, currentIndex: nextIndex, currentTime: 0 },
          currentTrack: state.queue.tracks[nextIndex],
        };
      }),

    previousTrack: () =>
      set((state) => {
        const prevIndex = state.queue.currentIndex - 1;
        if (prevIndex < 0) {
          return {
            queue: { ...state.queue, currentTime: 0 },
          };
        }
        return {
          queue: { ...state.queue, currentIndex: prevIndex, currentTime: 0 },
          currentTrack: state.queue.tracks[prevIndex],
        };
      }),

    jumpToTrack: (index: number) =>
      set((state) => {
        if (index < 0 || index >= state.queue.tracks.length) {
          return state;
        }
        return {
          queue: { ...state.queue, currentIndex: index, currentTime: 0, isPlaying: false },
          currentTrack: state.queue.tracks[index],
        };
      }),

    setStemMixState: (stemMixState) => set({ stemMixState }),

    toggleStem: (stem) =>
      set((state) => ({
        stemMixState: {
          ...state.stemMixState,
          [stem]: {
            ...state.stemMixState[stem],
            enabled: !state.stemMixState[stem].enabled,
          },
        },
      })),

    setStemVolume: (stem, volume) =>
      set((state) => ({
        stemMixState: {
          ...state.stemMixState,
          [stem]: {
            ...state.stemMixState[stem],
            volume,
          },
        },
      })),

    setStemsAvailable: (available) => set({ stemsAvailable: available }),

    addMessage: (message) =>
      set((state) => ({
        messages: [...state.messages, message].slice(-100), // Keep last 100 messages
      })),

    clearMessages: () => set({ messages: [] }),

    setConnected: (connected) => set({ isConnected: connected }),
    setJoining: (joining) => set({ isJoining: joining }),
    setError: (error) => set({ error }),

    setAudioLevel: (userId, level) =>
      set((state) => {
        const audioLevels = new Map(state.audioLevels);
        audioLevels.set(userId, level);
        return { audioLevels };
      }),

    setAudioLevels: (levels) => set({ audioLevels: levels }),

    setSyncedAnalysis: (data) => set({ syncedAnalysis: data }),

    broadcastAnalysis: (key, keyScale, bpm) => {
      const state = get();
      if (!state.currentUser || !state.isMaster) return;

      const analysisData: SyncedAnalysisData = {
        key,
        keyScale,
        bpm,
        updatedBy: state.currentUser.id,
        updatedAt: Date.now(),
      };

      set({ syncedAnalysis: analysisData });

      // Add as a sync message to be broadcast to other users
      state.addMessage({
        type: 'sync',
        userId: state.currentUser.id,
        content: '',
        timestamp: new Date().toISOString(),
        data: {
          type: 'analysis',
          ...analysisData,
        },
      });
    },

    setWaveformData: (data) => set({ waveformData: data }),

    reset: () =>
      set({
        room: null,
        users: new Map(),
        currentUser: null,
        isMaster: false,
        queue: initialQueue,
        currentTrack: null,
        stemMixState: initialStemMixState,
        stemsAvailable: false,
        messages: [],
        isConnected: false,
        isJoining: false,
        error: null,
        audioLevels: new Map(),
        syncedAnalysis: null,
        waveformData: null,
      }),
  }))
);
