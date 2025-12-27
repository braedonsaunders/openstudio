'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import type { UserTrack } from '@/types';

// Debounce delay for persisting track changes (ms)
const PERSIST_DEBOUNCE_MS = 1000;

/**
 * Hook that automatically persists track changes to the database
 * Uses debouncing to avoid excessive API calls
 */
export function useTrackPersistence(roomId: string | undefined) {
  const pendingUpdates = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastPersistedState = useRef<Map<string, string>>(new Map());

  // Persist a track to the database
  const persistTrack = useCallback(async (track: UserTrack) => {
    if (!roomId) return;

    try {
      await fetch(`/api/rooms/${roomId}/user-tracks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId: track.id,
          name: track.name,
          color: track.color,
          audioSettings: track.audioSettings,
          isMuted: track.isMuted,
          isSolo: track.isSolo,
          volume: track.volume,
          isArmed: track.isArmed,
          isRecording: track.isRecording,
        }),
      });
    } catch (err) {
      console.error('Failed to persist track:', err);
    }
  }, [roomId]);

  // Debounced persist function
  const debouncedPersist = useCallback((track: UserTrack) => {
    // Clear any pending update for this track
    const existing = pendingUpdates.current.get(track.id);
    if (existing) {
      clearTimeout(existing);
    }

    // Create a hash of the track state to compare
    const stateHash = JSON.stringify({
      name: track.name,
      color: track.color,
      audioSettings: track.audioSettings,
      isMuted: track.isMuted,
      isSolo: track.isSolo,
      volume: track.volume,
      isArmed: track.isArmed,
    });

    // Skip if nothing changed
    if (lastPersistedState.current.get(track.id) === stateHash) {
      return;
    }

    // Schedule the persist
    const timeout = setTimeout(() => {
      persistTrack(track);
      lastPersistedState.current.set(track.id, stateHash);
      pendingUpdates.current.delete(track.id);
    }, PERSIST_DEBOUNCE_MS);

    pendingUpdates.current.set(track.id, timeout);
  }, [persistTrack]);

  // Subscribe to track changes
  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = useUserTracksStore.subscribe(
      (state) => state.tracks,
      (tracks) => {
        // Persist any changed tracks
        for (const track of tracks.values()) {
          // Only persist active tracks owned by local user
          if (track.isActive !== false) {
            debouncedPersist(track);
          }
        }
      }
    );

    return () => {
      // Clear all pending updates on cleanup
      for (const timeout of pendingUpdates.current.values()) {
        clearTimeout(timeout);
      }
      pendingUpdates.current.clear();
      unsubscribe();
    };
  }, [roomId, debouncedPersist]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Persist any pending updates immediately on unmount
      const store = useUserTracksStore.getState();
      for (const [trackId, timeout] of pendingUpdates.current) {
        clearTimeout(timeout);
        const track = store.getTrack(trackId);
        if (track) {
          persistTrack(track);
        }
      }
    };
  }, [persistTrack]);

  return { persistTrack };
}
