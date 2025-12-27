import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { User, Room, RoomSettings, BackingTrack, TrackQueue, RoomMessage, StemMixState } from '@/types';

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
      }),
  }))
);
