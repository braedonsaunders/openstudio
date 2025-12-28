'use client';

import { useEffect, useRef } from 'react';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { useAudioEngine } from './useAudioEngine';

/**
 * Hook that synchronizes user track state (mute, solo, volume, effects)
 * with the audio engine.
 *
 * Call this hook in a component that has access to the audio engine
 * (e.g., DAWLayout or a track component).
 */
export function useTrackAudioSync(currentUserId: string | undefined) {
  const { setLocalTrackMuted, setLocalTrackVolume, updateLocalEffects } = useAudioEngine();
  const lastSyncRef = useRef<{
    isMuted: boolean;
    isSolo: boolean;
    volume: number;
    effects: unknown;
  } | null>(null);

  useEffect(() => {
    if (!currentUserId) return;

    // Subscribe to track changes
    const unsubscribe = useUserTracksStore.subscribe((state) => {
      // Get all tracks for the current user
      const userTracks = state.getTracksByUser(currentUserId);
      if (userTracks.length === 0) return;

      // For now, we focus on the first (primary) track
      // In the future, we could support multiple tracks per user
      const primaryTrack = userTracks[0];
      if (!primaryTrack) return;

      // Check if any track is soloed
      const allTracks = state.getAllTracks();
      const hasSoloedTracks = allTracks.some(t => t.isSolo);

      // Calculate effective mute state
      // Track is muted if:
      // 1. It's explicitly muted, OR
      // 2. There are soloed tracks and this track isn't one of them
      const isEffectivelyMuted = primaryTrack.isMuted ||
        (hasSoloedTracks && !primaryTrack.isSolo);

      // Check if state has changed
      const currentState = {
        isMuted: isEffectivelyMuted,
        isSolo: primaryTrack.isSolo,
        volume: primaryTrack.volume,
        effects: primaryTrack.audioSettings.effects,
      };

      const lastState = lastSyncRef.current;

      // Apply mute if changed
      if (!lastState || lastState.isMuted !== currentState.isMuted) {
        setLocalTrackMuted(currentState.isMuted);
      }

      // Apply volume if changed
      if (!lastState || lastState.volume !== currentState.volume) {
        setLocalTrackVolume(currentState.volume);
      }

      // Apply effects if changed (unified chain - all 15 effects)
      if (!lastState || lastState.effects !== currentState.effects) {
        if (currentState.effects) {
          updateLocalEffects(currentState.effects);
        }
      }

      lastSyncRef.current = currentState;
    });

    return () => {
      unsubscribe();
    };
  }, [currentUserId, setLocalTrackMuted, setLocalTrackVolume, updateLocalEffects]);
}
