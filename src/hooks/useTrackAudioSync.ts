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
  const { setLocalTrackArmed, setLocalTrackMuted, setLocalTrackVolume, updateLocalEffects, setLocalMonitoring } = useAudioEngine();
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

      // Browser software monitoring is controlled by ARM state, not Direct Monitoring
      // When armed and not muted, you hear your input through the browser with effects
      // Direct Monitoring only controls the native bridge DRY passthrough (zero-latency, no effects)
      const shouldSoftwareMonitor = currentState.isArmed && !currentState.isMuted;
      if (!lastState ||
          (lastState.isArmed !== currentState.isArmed) ||
          (lastState.isMuted !== currentState.isMuted)) {
        console.log('[useTrackAudioSync] Setting software monitoring:', shouldSoftwareMonitor,
          '(armed:', currentState.isArmed, 'muted:', currentState.isMuted, ')');
        setLocalMonitoring(shouldSoftwareMonitor);
      }

      // Sync to native bridge if active
      // Note: We only sync track state (arm/mute/solo/volume/gain/monitoring)
      // Effects are processed entirely in the browser via Web Audio, not in the bridge
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
      }

      lastSyncRef.current = currentState;
    });

    return () => {
      unsubscribe();
    };
  }, [currentUserId, setLocalTrackArmed, setLocalTrackMuted, setLocalTrackVolume, updateLocalEffects, setLocalMonitoring]);
}
