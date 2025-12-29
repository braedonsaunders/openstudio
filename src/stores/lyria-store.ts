'use client';

import { create } from 'zustand';
import {
  LyriaSession,
  createLyriaSession,
  buildPrompt,
  keyToLyriaScale,
  type LyriaStyleId,
  type LyriaMoodId,
} from '@/lib/ai/lyria';
import type { LyriaSessionState, LyriaScale } from '@/types';
import type { LyriaTrackConfig } from '@/types/songs';

// =============================================================================
// Lyria Store - Global Lyria session management for transport integration
// =============================================================================

interface LyriaStoreState {
  // Session state
  session: LyriaSession | null;
  sessionState: LyriaSessionState;
  error: string | null;

  // Active track config (when playing a song with a Lyria track)
  activeConfig: LyriaTrackConfig | null;
  activeSongId: string | null;
  activeTrackId: string | null;

  // Room context (BPM, key from session tempo store)
  roomBpm: number;
  roomKey: string | null;
  roomKeyScale: 'major' | 'minor' | null;

  // Volume
  volume: number;

  // Callbacks for external audio source management
  onConnected?: (stream: MediaStream) => void;
  onDisconnected?: () => void;

  // Actions
  initialize: () => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  play: (config?: LyriaTrackConfig) => void;
  pause: () => void;
  stop: () => void;

  // Config updates
  setActiveConfig: (config: LyriaTrackConfig | null, songId?: string, trackId?: string) => void;
  setRoomContext: (bpm: number, key: string | null, keyScale: 'major' | 'minor' | null) => void;
  setVolume: (volume: number) => void;

  // Callbacks
  setAudioCallbacks: (onConnected: (stream: MediaStream) => void, onDisconnected: () => void) => void;

  // Cleanup
  dispose: () => void;
}

export const useLyriaStore = create<LyriaStoreState>((set, get) => ({
  // Initial state
  session: null,
  sessionState: 'disconnected',
  error: null,
  activeConfig: null,
  activeSongId: null,
  activeTrackId: null,
  roomBpm: 120,
  roomKey: null,
  roomKeyScale: null,
  volume: 0.7,
  onConnected: undefined,
  onDisconnected: undefined,

  // Initialize session (called once on app startup)
  initialize: () => {
    const { session } = get();
    if (session) return; // Already initialized

    const newSession = createLyriaSession();
    newSession.setUseExternalRouting(true);
    newSession.setCallbacks({
      onStateChange: (state) => {
        set({ sessionState: state });
        if (state === 'error') {
          set({ error: 'Connection lost' });
        } else if (state === 'connected') {
          set({ error: null });
        }
      },
      onError: (err) => {
        set({ error: err.message });
      },
    });

    set({ session: newSession });
  },

  // Connect to Lyria
  connect: async () => {
    const { session, roomBpm, roomKey, roomKeyScale, volume, onConnected } = get();
    if (!session) {
      get().initialize();
    }

    const currentSession = get().session;
    if (!currentSession) return;

    set({ error: null });

    try {
      await currentSession.connect();

      // Set initial config from room
      const scale = keyToLyriaScale(roomKey, roomKeyScale);
      currentSession.setConfig({
        bpm: roomBpm,
        scale,
      });
      currentSession.setVolume(volume);

      // Notify external audio source manager
      const outputStream = currentSession.getOutputStream();
      if (outputStream && onConnected) {
        onConnected(outputStream);
      }
    } catch (err) {
      set({ error: (err as Error).message });
      throw err;
    }
  },

  // Disconnect from Lyria
  disconnect: () => {
    const { session, onDisconnected } = get();
    if (session) {
      session.disconnect();
      onDisconnected?.();
    }
    set({
      sessionState: 'disconnected',
      activeConfig: null,
      activeSongId: null,
      activeTrackId: null,
    });
  },

  // Play with optional config
  play: (config?: LyriaTrackConfig) => {
    const { session, sessionState, activeConfig, roomBpm, roomKey, roomKeyScale } = get();
    if (!session) return;

    // Use provided config, or active config, or default
    const playConfig = config || activeConfig;

    if (sessionState !== 'connected' && sessionState !== 'paused') {
      console.warn('[LyriaStore] Cannot play: not connected');
      return;
    }

    // Apply config if provided
    if (playConfig) {
      const scale = keyToLyriaScale(roomKey, roomKeyScale);
      session.setConfig({
        bpm: roomBpm,
        scale,
        density: playConfig.density,
        brightness: playConfig.brightness,
        drums: playConfig.drums,
        bass: playConfig.bass,
        temperature: playConfig.temperature * 3,
      });

      // Build and set prompt
      const prompt = playConfig.customPrompt?.trim() ||
        buildPrompt(playConfig.styleId, playConfig.moodId || undefined);
      session.setPrompts(prompt);
    }

    session.play();
  },

  // Pause playback
  pause: () => {
    const { session } = get();
    session?.pause();
  },

  // Stop playback
  stop: () => {
    const { session } = get();
    session?.stop();
  },

  // Set active config for current song/track
  setActiveConfig: (config, songId, trackId) => {
    set({
      activeConfig: config,
      activeSongId: songId || null,
      activeTrackId: trackId || null,
    });
  },

  // Update room context (BPM, key)
  setRoomContext: (bpm, key, keyScale) => {
    const { session, sessionState } = get();
    set({ roomBpm: bpm, roomKey: key, roomKeyScale: keyScale });

    // Update session if connected
    if (session && (sessionState === 'connected' || sessionState === 'playing' || sessionState === 'paused')) {
      session.setBpm(bpm);
      const scale = keyToLyriaScale(key, keyScale);
      session.setScale(scale);
    }
  },

  // Set volume
  setVolume: (volume) => {
    const { session } = get();
    set({ volume });
    session?.setVolume(volume);
  },

  // Set audio callbacks
  setAudioCallbacks: (onConnected, onDisconnected) => {
    set({ onConnected, onDisconnected });
  },

  // Cleanup
  dispose: () => {
    const { session, onDisconnected } = get();
    if (session) {
      session.disconnect();
      onDisconnected?.();
    }
    set({
      session: null,
      sessionState: 'disconnected',
      activeConfig: null,
      activeSongId: null,
      activeTrackId: null,
      error: null,
    });
  },
}));
