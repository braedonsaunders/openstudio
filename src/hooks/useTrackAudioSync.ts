'use client';

import { useEffect, useRef } from 'react';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { useBridgeAudioStore } from '@/stores/bridge-audio-store';
import { useAudioEngine } from './useAudioEngine';
import { nativeBridge } from '@/lib/audio/native-bridge';

/**
 * Hook that synchronizes user track state (mute, solo, volume, effects)
 * with the audio engine AND native bridge (when active).
 *
 * Call this hook in a component that has access to the audio engine
 * (e.g., DAWLayout or a track component).
 */
export function useTrackAudioSync(currentUserId: string | undefined) {
  const { setLocalTrackArmed, setLocalTrackMuted, setLocalTrackVolume, updateLocalEffects } = useAudioEngine();
  const lastSyncRef = useRef<{
    isArmed: boolean;
    isMuted: boolean;
    isSolo: boolean;
    volume: number;
    inputGainDb: number;
    monitoringEnabled: boolean;
    monitoringVolume: number;
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
        isArmed: primaryTrack.isArmed,
        isMuted: isEffectivelyMuted,
        isSolo: primaryTrack.isSolo,
        volume: primaryTrack.volume,
        inputGainDb: primaryTrack.audioSettings.inputGain || 0,
        monitoringEnabled: primaryTrack.audioSettings.directMonitoring ?? true,
        monitoringVolume: primaryTrack.audioSettings.monitoringVolume ?? 1,
        effects: primaryTrack.audioSettings.effects,
      };

      const lastState = lastSyncRef.current;

      // Check if native bridge is active
      const bridgeState = useBridgeAudioStore.getState();
      const useBridge = bridgeState.isConnected && bridgeState.preferNativeBridge && bridgeState.isRunning;

      // Apply armed state if changed
      // When not armed, audio is blocked from processing/monitoring
      if (!lastState || lastState.isArmed !== currentState.isArmed) {
        setLocalTrackArmed(currentState.isArmed);
      }

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

      // Sync to native bridge if active
      if (useBridge) {
        const needsTrackStateUpdate =
          !lastState ||
          lastState.isArmed !== currentState.isArmed ||
          lastState.isMuted !== currentState.isMuted ||
          lastState.isSolo !== currentState.isSolo ||
          lastState.volume !== currentState.volume ||
          lastState.inputGainDb !== currentState.inputGainDb ||
          lastState.monitoringEnabled !== currentState.monitoringEnabled ||
          lastState.monitoringVolume !== currentState.monitoringVolume;

        if (needsTrackStateUpdate) {
          nativeBridge.updateTrackState(primaryTrack.id, {
            isArmed: currentState.isArmed,
            isMuted: currentState.isMuted,
            isSolo: currentState.isSolo,
            volume: currentState.volume,
            inputGainDb: currentState.inputGainDb,
            monitoringEnabled: currentState.monitoringEnabled,
            monitoringVolume: currentState.monitoringVolume,
          });
        }

        // Sync effects to native bridge
        if (!lastState || lastState.effects !== currentState.effects) {
          if (currentState.effects) {
            nativeBridge.updateEffects(primaryTrack.id, currentState.effects);
          }
        }
      }

      lastSyncRef.current = currentState;
    });

    return () => {
      unsubscribe();
    };
  }, [currentUserId, setLocalTrackArmed, setLocalTrackMuted, setLocalTrackVolume, updateLocalEffects]);
}
