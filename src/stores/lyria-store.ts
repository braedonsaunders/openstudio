'use client';

import { create } from 'zustand';
import {
  LyriaSession,
  createLyriaSession,
  buildPrompt,
  keyToLyriaScale,
  LyriaAuthError,
  type LyriaStyleId,
  type LyriaMoodId,
  type LyriaRateLimitStatus,
} from '@/lib/ai/lyria';
import type { LyriaSessionState, LyriaScale } from '@/types';
import type { LyriaTrackConfig } from '@/types/songs';
import { useAuthStore } from './auth-store';

// =============================================================================
// Lyria Store - Global Lyria session management for transport integration
// =============================================================================

interface LyriaStoreState {
  // Session state
  session: LyriaSession | null;
  sessionState: LyriaSessionState;
  error: string | null;
  errorCode: string | null;

  // Authentication state
  isAuthenticated: boolean;
  rateLimits: LyriaRateLimitStatus | null;

  // Session timing (for 10-minute limit handling)
  sessionStartedAt: number | null;
  maxSessionSeconds: number;
  isSessionExpired: boolean;

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
  onConnected?: (stream: MediaStream) => void | Promise<void>;
  onDisconnected?: () => void;

  // Actions
  initialize: () => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  play: (config?: LyriaTrackConfig) => void;
  pause: () => void;
  stop: () => void;

  // Session time limit handling
  extendSession: () => Promise<void>;
  handleSessionExpired: () => void;
  getSessionRemainingSeconds: () => number | null;

  // Config updates
  setActiveConfig: (config: LyriaTrackConfig | null, songId?: string, trackId?: string) => void;
  setRoomContext: (bpm: number, key: string | null, keyScale: 'major' | 'minor' | null) => void;
  setVolume: (volume: number) => void;

  // Callbacks
  setAudioCallbacks: (onConnected: (stream: MediaStream) => void, onDisconnected: () => void) => void;

  // Cleanup
  dispose: () => void;

  // Auth helpers
  refreshAuthToken: () => void;
  checkRateLimits: () => Promise<LyriaRateLimitStatus | null>;
}

export const useLyriaStore = create<LyriaStoreState>((set, get) => ({
  // Initial state
  session: null,
  sessionState: 'disconnected',
  error: null,
  errorCode: null,
  isAuthenticated: false,
  rateLimits: null,
  sessionStartedAt: null,
  maxSessionSeconds: 600, // Default 10 minutes
  isSessionExpired: false,
  activeConfig: null,
  activeSongId: null,
  activeTrackId: null,
  roomBpm: 120,
  roomKey: null,
  roomKeyScale: null,
  volume: 0.7,
  onConnected: undefined,
  onDisconnected: undefined,

  // Refresh auth token from auth store
  refreshAuthToken: () => {
    const { session } = get();
    if (!session) return;

    const authState = useAuthStore.getState();
    const token = authState.user ? authState.user.id : null;

    // Get the actual access token from Supabase session
    // We need to get this from the Supabase client
    if (authState.user) {
      // The auth store doesn't directly expose the access token,
      // so we'll get it from the Supabase client when connecting
      set({ isAuthenticated: true });
    } else {
      set({ isAuthenticated: false });
    }
  },

  // Check rate limits without connecting
  checkRateLimits: async () => {
    const { session } = get();
    if (!session) return null;

    try {
      const limits = await session.checkRateLimits();
      set({ rateLimits: limits });
      return limits;
    } catch (error) {
      if (error instanceof LyriaAuthError) {
        set({ error: error.message, errorCode: error.code });
      }
      return null;
    }
  },

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
          set({ error: null, errorCode: null });
        }
      },
      onError: (err) => {
        if (err instanceof LyriaAuthError) {
          set({ error: err.message, errorCode: err.code, rateLimits: err.limits || null });
        } else {
          set({ error: err.message });
        }
      },
      onRateLimitUpdate: (limits) => {
        set({ rateLimits: limits });
      },
    });

    // Check if user is authenticated
    const authState = useAuthStore.getState();
    const isAuthenticated = !!authState.user;

    set({ session: newSession, isAuthenticated });
  },

  // Connect to Lyria
  connect: async () => {
    const { session, roomBpm, roomKey, roomKeyScale, volume, onConnected } = get();
    if (!session) {
      get().initialize();
    }

    const currentSession = get().session;
    if (!currentSession) return;

    // Get auth token from Supabase
    const authState = useAuthStore.getState();
    if (!authState.user) {
      set({
        error: 'Please sign in to use Lyria AI music',
        errorCode: 'AUTH_REQUIRED',
        isAuthenticated: false,
      });
      throw new LyriaAuthError('Authentication required', 'AUTH_REQUIRED');
    }

    // Get access token from Supabase client
    const { supabaseAuth } = await import('@/lib/supabase/auth');
    const { data: sessionData } = await supabaseAuth.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    if (!accessToken) {
      set({
        error: 'Session expired - please sign in again',
        errorCode: 'AUTH_REQUIRED',
        isAuthenticated: false,
      });
      throw new LyriaAuthError('Session expired', 'AUTH_REQUIRED');
    }

    // Set auth token on the session
    currentSession.setAuthToken(accessToken);
    set({ error: null, errorCode: null, isAuthenticated: true });

    try {
      await currentSession.connect();

      // Store session timing info
      // NOTE: Google Lyria API has a hard 10-minute limit, always use 600
      const sessionStartTime = currentSession.getSessionStartTime();
      set({
        sessionStartedAt: sessionStartTime,
        maxSessionSeconds: 600, // Google's hard limit, not our app's rate limit
        isSessionExpired: false,
      });

      // Set initial config from room
      const scale = keyToLyriaScale(roomKey, roomKeyScale);
      currentSession.setConfig({
        bpm: roomBpm,
        scale,
      });
      currentSession.setVolume(volume);

      // Notify external audio source manager and wait for routing to complete
      const outputStream = currentSession.getOutputStream();
      if (outputStream && onConnected) {
        await onConnected(outputStream);
      }
    } catch (err) {
      if (err instanceof LyriaAuthError) {
        set({ error: err.message, errorCode: err.code, rateLimits: err.limits || null });
      } else {
        set({ error: (err as Error).message });
      }
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
      sessionStartedAt: null,
      isSessionExpired: false,
      activeConfig: null,
      activeSongId: null,
      activeTrackId: null,
    });
  },

  // Play with optional config
  play: async (config?: LyriaTrackConfig) => {
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

    await session.play();
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

  // Get remaining seconds in the current session
  getSessionRemainingSeconds: () => {
    const { sessionStartedAt, maxSessionSeconds, sessionState } = get();
    if (!sessionStartedAt || sessionState === 'disconnected') return null;
    const elapsed = Math.floor((Date.now() - sessionStartedAt) / 1000);
    return Math.max(0, maxSessionSeconds - elapsed);
  },

  // Handle session expiration (called when timer reaches 0)
  handleSessionExpired: () => {
    const { session } = get();
    if (session) {
      session.pause();
    }
    set({ isSessionExpired: true });
    console.log('[LyriaStore] Session expired (10-minute limit reached)');
  },

  // Extend session by disconnecting and reconnecting with same config
  extendSession: async () => {
    const { session, activeConfig, onDisconnected, onConnected, roomBpm, roomKey, roomKeyScale, volume } = get();

    // Store current config before disconnect
    const configToRestore = activeConfig;
    const wasPlaying = get().sessionState === 'playing';

    console.log('[LyriaStore] Extending session, preserving config:', configToRestore?.styleId);

    // Disconnect current session
    if (session) {
      session.disconnect();
      onDisconnected?.();
    }

    set({
      sessionState: 'disconnected',
      sessionStartedAt: null,
      isSessionExpired: false,
    });

    // Brief delay for cleanup
    await new Promise(resolve => setTimeout(resolve, 200));

    // Reconnect
    try {
      await get().connect();

      // Restore config and resume playback if we were playing
      if (configToRestore && wasPlaying) {
        await get().play(configToRestore);
      }

      console.log('[LyriaStore] Session extended successfully');
    } catch (err) {
      console.error('[LyriaStore] Failed to extend session:', err);
      throw err;
    }
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
      sessionStartedAt: null,
      isSessionExpired: false,
      activeConfig: null,
      activeSongId: null,
      activeTrackId: null,
      error: null,
    });
  },
}));
