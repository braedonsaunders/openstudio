'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ListenOnlyTransport,
  ListenOnlyState,
  ListenOnlyStats,
  createListenOnlyTransport,
} from '@/lib/audio/listen-only-transport';

export interface UseListenOnlyOptions {
  /** Auto-connect when component mounts */
  autoConnect?: boolean;
  /** Relay URL (defaults to production relay) */
  relayUrl?: string;
  /** Initial volume (0-1) */
  initialVolume?: number;
}

export interface UseListenOnlyReturn {
  /** Connection state */
  state: ListenOnlyState;
  /** Whether currently connected */
  isConnected: boolean;
  /** Whether WebTransport is supported in this browser */
  isSupported: boolean;
  /** Current stats */
  stats: ListenOnlyStats | null;
  /** Number of audio tracks */
  trackCount: number;
  /** Current volume (0-1) */
  volume: number;
  /** Last error */
  error: Error | null;
  /** Connect to room */
  connect: () => Promise<void>;
  /** Disconnect from room */
  disconnect: () => Promise<void>;
  /** Set playback volume */
  setVolume: (volume: number) => void;
}

/**
 * React hook for listen-only mode using WebTransport.
 * Allows browser users to listen to room audio without native bridge.
 */
export function useListenOnly(
  roomId: string,
  userId: string,
  options: UseListenOnlyOptions = {}
): UseListenOnlyReturn {
  const { autoConnect = false, relayUrl, initialVolume = 1 } = options;

  const [state, setState] = useState<ListenOnlyState>('disconnected');
  const [stats, setStats] = useState<ListenOnlyStats | null>(null);
  const [trackCount, setTrackCount] = useState(0);
  const [volume, setVolume] = useState(initialVolume);
  const [error, setError] = useState<Error | null>(null);

  const transportRef = useRef<ListenOnlyTransport | null>(null);
  const isSupported = typeof window !== 'undefined' && ListenOnlyTransport.isSupported();

  // Initialize transport
  useEffect(() => {
    if (!isSupported) return;

    const transport = createListenOnlyTransport(roomId, userId, { relayUrl });
    transportRef.current = transport;

    // Set up event handlers
    transport.on('stateChange', (newState) => {
      setState(newState);
    });

    transport.on('statsUpdate', (newStats) => {
      setStats(newStats);
      setTrackCount(newStats.trackCount);
    });

    transport.on('error', (err) => {
      setError(err);
    });

    transport.on('trackAdded', (trackId, userId) => {
      console.log(`[useListenOnly] Track added: ${trackId} from ${userId}`);
    });

    transport.on('trackRemoved', (trackId) => {
      console.log(`[useListenOnly] Track removed: ${trackId}`);
    });

    // Auto-connect if enabled
    if (autoConnect) {
      transport.connect().catch((e) => {
        console.error('[useListenOnly] Auto-connect failed:', e);
        setError(e);
      });
    }

    return () => {
      transport.disconnect().catch(console.error);
      transportRef.current = null;
    };
  }, [roomId, userId, relayUrl, isSupported, autoConnect]);

  // Update volume when changed
  useEffect(() => {
    transportRef.current?.setVolume(volume);
  }, [volume]);

  const connect = useCallback(async () => {
    if (!transportRef.current) {
      throw new Error('Transport not initialized');
    }
    setError(null);
    await transportRef.current.connect();
  }, []);

  const disconnect = useCallback(async () => {
    if (!transportRef.current) return;
    await transportRef.current.disconnect();
  }, []);

  const handleSetVolume = useCallback((newVolume: number) => {
    const clampedVolume = Math.max(0, Math.min(1, newVolume));
    setVolume(clampedVolume);
  }, []);

  return {
    state,
    isConnected: state === 'connected',
    isSupported,
    stats,
    trackCount,
    volume,
    error,
    connect,
    disconnect,
    setVolume: handleSetVolume,
  };
}

/**
 * Hook to check if WebTransport is supported
 */
export function useWebTransportSupport(): boolean {
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(
      typeof window !== 'undefined' && ListenOnlyTransport.isSupported()
    );
  }, []);

  return isSupported;
}
