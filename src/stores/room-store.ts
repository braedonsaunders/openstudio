import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { User, Room, RoomSettings, BackingTrack, TrackQueue, RoomMessage, StemMixState } from '@/types';

// World position for synced avatar movement
export interface WorldPosition {
  userId: string;
  x: number;
  y: number;
  facingRight: boolean;
  isWalking: boolean;
  targetX?: number;
  targetY?: number;
  timestamp: number;
}

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

  // World view positions (synced between clients)
  worldPositions: Map<string, WorldPosition>;
  worldScene: string | null;

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

  // World position actions
  setWorldPosition: (userId: string, position: WorldPosition) => void;
  updateWorldPosition: (userId: string, updates: Partial<WorldPosition>) => void;
  removeWorldPosition: (userId: string) => void;
  setWorldScene: (scene: string | null) => void;

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
    worldPositions: new Map(),
    worldScene: null,

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

    setQueue: (queue) =>
      set((state) => {
        // Ensure currentTrack is always synced with queue
        let newCurrentTrack = state.currentTrack;

        if (queue.tracks.length > 0) {
          // If currentIndex is valid, use that track
          if (queue.currentIndex >= 0 && queue.currentIndex < queue.tracks.length) {
            newCurrentTrack = queue.tracks[queue.currentIndex];
          } else if (state.currentTrack === null) {
            // No current track but queue has tracks - select first one
            newCurrentTrack = queue.tracks[0];
            queue = { ...queue, currentIndex: 0 };
          }
        } else {
          // Empty queue
          newCurrentTrack = null;
        }

        return {
          queue,
          currentTrack: newCurrentTrack,
          stemsAvailable: !!newCurrentTrack?.stems,
        };
      }),

    addToQueue: (track) =>
      set((state) => {
        const newTracks = [...state.queue.tracks, track];
        const isFirstTrack = state.queue.tracks.length === 0;

        // Auto-select first track if no track is currently selected
        if (isFirstTrack || state.currentTrack === null) {
          return {
            queue: {
              ...state.queue,
              tracks: newTracks,
              currentIndex: 0,
            },
            currentTrack: newTracks[0],
            stemsAvailable: !!newTracks[0]?.stems,
          };
        }

        return {
          queue: {
            ...state.queue,
            tracks: newTracks,
          },
        };
      }),

    removeFromQueue: (trackId) =>
      set((state) => {
        const removedIndex = state.queue.tracks.findIndex((t) => t.id === trackId);
        const newTracks = state.queue.tracks.filter((t) => t.id !== trackId);
        const isRemovingCurrentTrack = state.currentTrack?.id === trackId;

        if (newTracks.length === 0) {
          // No tracks left, reset everything
          return {
            queue: {
              ...state.queue,
              tracks: [],
              currentIndex: -1,
              isPlaying: false,
              currentTime: 0,
            },
            currentTrack: null,
            stemsAvailable: false,
            waveformData: null,
          };
        }

        if (isRemovingCurrentTrack) {
          // Current track was removed, select the next available track
          // If we were at the end, select the new last track
          const newIndex = Math.min(removedIndex, newTracks.length - 1);
          return {
            queue: {
              ...state.queue,
              tracks: newTracks,
              currentIndex: newIndex,
              isPlaying: false,
              currentTime: 0,
            },
            currentTrack: newTracks[newIndex],
            stemsAvailable: !!newTracks[newIndex]?.stems,
            waveformData: null,
          };
        }

        // Track removed was not the current track
        // Adjust currentIndex if needed
        const adjustedIndex = removedIndex < state.queue.currentIndex
          ? state.queue.currentIndex - 1
          : state.queue.currentIndex;

        return {
          queue: {
            ...state.queue,
            tracks: newTracks,
            currentIndex: adjustedIndex,
          },
        };
      }),

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
          // At the last track - stop playing but keep current track visible
          return {
            queue: { ...state.queue, isPlaying: false, currentTime: 0 },
            // Keep currentTrack - don't set to null so waveform stays visible
          };
        }
        const nextTrack = state.queue.tracks[nextIndex];
        return {
          queue: { ...state.queue, currentIndex: nextIndex, currentTime: 0 },
          currentTrack: nextTrack,
          stemsAvailable: !!nextTrack?.stems,
          waveformData: null, // Reset waveform for new track
        };
      }),

    previousTrack: () =>
      set((state) => {
        const prevIndex = state.queue.currentIndex - 1;
        if (prevIndex < 0) {
          // At the first track - just reset to beginning
          return {
            queue: { ...state.queue, currentTime: 0 },
          };
        }
        const prevTrack = state.queue.tracks[prevIndex];
        return {
          queue: { ...state.queue, currentIndex: prevIndex, currentTime: 0 },
          currentTrack: prevTrack,
          stemsAvailable: !!prevTrack?.stems,
          waveformData: null, // Reset waveform for new track
        };
      }),

    jumpToTrack: (index: number) =>
      set((state) => {
        if (index < 0 || index >= state.queue.tracks.length) {
          console.warn('jumpToTrack: Invalid index', index, 'queue length:', state.queue.tracks.length);
          return state;
        }
        const track = state.queue.tracks[index];
        console.log('jumpToTrack: Jumping to', track.name, 'at index', index);
        return {
          queue: { ...state.queue, currentIndex: index, currentTime: 0, isPlaying: false },
          currentTrack: track,
          stemsAvailable: !!track?.stems,
          waveformData: null, // Reset waveform for new track
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
      set((state) => {
        // Prevent duplicate messages based on timestamp, userId, and content
        const isDuplicate = state.messages.some(
          (m) =>
            m.timestamp === message.timestamp &&
            m.userId === message.userId &&
            m.content === message.content
        );
        if (isDuplicate) {
          return state; // Don't add duplicate
        }
        return {
          messages: [...state.messages, message].slice(-100), // Keep last 100 messages
        };
      }),

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

    // World position actions
    setWorldPosition: (userId, position) =>
      set((state) => {
        const worldPositions = new Map(state.worldPositions);
        worldPositions.set(userId, position);
        return { worldPositions };
      }),

    updateWorldPosition: (userId, updates) =>
      set((state) => {
        const worldPositions = new Map(state.worldPositions);
        const existing = worldPositions.get(userId);
        if (existing) {
          worldPositions.set(userId, { ...existing, ...updates, timestamp: Date.now() });
        }
        return { worldPositions };
      }),

    removeWorldPosition: (userId) =>
      set((state) => {
        const worldPositions = new Map(state.worldPositions);
        worldPositions.delete(userId);
        return { worldPositions };
      }),

    setWorldScene: (scene) => set({ worldScene: scene }),

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
        worldPositions: new Map(),
        worldScene: null,
      }),
  }))
);
