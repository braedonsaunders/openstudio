'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { authFetchJson } from '@/lib/auth-fetch';
import type { UserTrack } from '@/types';

// Debounce delay for persisting track changes (ms)
const PERSIST_DEBOUNCE_MS = 1000;
// Broadcast immediately for real-time sync
const BROADCAST_DEBOUNCE_MS = 50;

/**
 * Callback type for broadcasting track updates to other clients
 */
export type BroadcastTrackUpdate = (trackId: string, updates: Partial<UserTrack>) => void;

/**
 * Hook that automatically persists track changes to the database
 * and broadcasts changes to other clients in real-time.
 * Uses debouncing to avoid excessive API calls.
 */
export function useTrackPersistence(
  roomId: string | undefined,
  userId: string | undefined,
  onBroadcast?: BroadcastTrackUpdate
) {
  const pendingUpdates = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const pendingBroadcasts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const lastPersistedState = useRef<Map<string, string>>(new Map());
  const lastBroadcastState = useRef<Map<string, string>>(new Map());

  // Persist a track to the database
  const persistTrack = useCallback(async (track: UserTrack) => {
    if (!roomId || !userId) return;

    const isOwnedByCurrentUser = track.userId === userId || track.ownerUserId === userId;
    if (!isOwnedByCurrentUser) {
      return;
    }

    // SECURITY: No longer send requesterId - server derives identity from JWT
    try {
      await authFetchJson(`/api/rooms/${roomId}/user-tracks`, 'PATCH', {
        trackId: track.id,
        name: track.name,
        color: track.color,
        type: track.type,
        audioSettings: track.audioSettings,
        midiSettings: track.midiSettings,
        isMuted: track.isMuted,
        isSolo: track.isSolo,
        volume: track.volume,
        pan: track.pan,
        isArmed: track.isArmed,
        isRecording: track.isRecording,
        ownerUserId: track.ownerUserId,
        ownerUserName: track.ownerUserName,
        isActive: track.isActive,
      });
    } catch (err) {
      console.error('Failed to persist track:', err);
    }
  }, [roomId, userId]);

  // Broadcast track updates to other clients (fast, for real-time sync)
  const broadcastTrack = useCallback((track: UserTrack) => {
    if (!onBroadcast) return;

    // Clear any pending broadcast for this track
    const existing = pendingBroadcasts.current.get(track.id);
    if (existing) {
      clearTimeout(existing);
    }

    // Create a hash of the broadcast-relevant state
    const stateHash = JSON.stringify({
      name: track.name,
      color: track.color,
      type: track.type,
      audioSettings: track.audioSettings,
      midiSettings: track.midiSettings,
      isMuted: track.isMuted,
      isSolo: track.isSolo,
      volume: track.volume,
      pan: track.pan,
      isArmed: track.isArmed,
      isRecording: track.isRecording,
      isActive: track.isActive,
      ownerUserId: track.ownerUserId,
      ownerUserName: track.ownerUserName,
    });

    // Skip if nothing changed
    if (lastBroadcastState.current.get(track.id) === stateHash) {
      return;
    }

    // Schedule the broadcast with minimal delay for real-time feel
    const timeout = setTimeout(() => {
      onBroadcast(track.id, {
        name: track.name,
        color: track.color,
        type: track.type,
        audioSettings: track.audioSettings,
        midiSettings: track.midiSettings,
        isMuted: track.isMuted,
        isSolo: track.isSolo,
        volume: track.volume,
        pan: track.pan,
        isArmed: track.isArmed,
        isRecording: track.isRecording,
        isActive: track.isActive,
        ownerUserId: track.ownerUserId,
        ownerUserName: track.ownerUserName,
      });
      lastBroadcastState.current.set(track.id, stateHash);
      pendingBroadcasts.current.delete(track.id);
    }, BROADCAST_DEBOUNCE_MS);

    pendingBroadcasts.current.set(track.id, timeout);
  }, [onBroadcast]);

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
      midiSettings: track.midiSettings,
      isMuted: track.isMuted,
      isSolo: track.isSolo,
      volume: track.volume,
      pan: track.pan,
      isArmed: track.isArmed,
      isRecording: track.isRecording,
      isActive: track.isActive,
    });

    // Skip if nothing changed
    if (lastPersistedState.current.get(track.id) === stateHash) {
      return;
    }

    // Broadcast immediately for real-time sync
    broadcastTrack(track);

    // Schedule the persist to database (slower, for durability)
    const timeout = setTimeout(() => {
      persistTrack(track);
      lastPersistedState.current.set(track.id, stateHash);
      pendingUpdates.current.delete(track.id);
    }, PERSIST_DEBOUNCE_MS);

    pendingUpdates.current.set(track.id, timeout);
  }, [persistTrack, broadcastTrack]);

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
      // Clear all pending updates and broadcasts on cleanup
      for (const timeout of pendingUpdates.current.values()) {
        clearTimeout(timeout);
      }
      for (const timeout of pendingBroadcasts.current.values()) {
        clearTimeout(timeout);
      }
      pendingUpdates.current.clear();
      pendingBroadcasts.current.clear();
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
