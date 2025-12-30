'use client';

import { useEffect, useRef } from 'react';
import { useUserTracksStore, type UserTrack } from '@/stores/user-tracks-store';
import { useBridgeAudioStore } from '@/stores/bridge-audio-store';
import { useAudioEngine } from './useAudioEngine';
import { nativeBridge } from '@/lib/audio/native-bridge';
import type { ExtendedEffectsChain } from '@/types';

interface TrackSyncState {
  isArmed: boolean;
  isMuted: boolean;
  isSolo: boolean;
  volume: number;
  inputGainDb: number;
  monitoringEnabled: boolean;
  monitoringVolume: number;
  effects: ExtendedEffectsChain | null;
  channelConfig: { channelCount: 1 | 2; leftChannel: number; rightChannel?: number };
}

/**
 * Hook that synchronizes user track state (mute, solo, volume, effects)
 * with the audio engine AND native bridge (when active).
 *
 * This hook supports multi-track mode - it syncs ALL user tracks, not just the first one.
 * Each track gets its own TrackAudioProcessor in the audio engine.
 *
 * Call this hook in a component that has access to the audio engine
 * (e.g., DAWLayout or a track component).
 */
export function useTrackAudioSync(currentUserId: string | undefined) {
  const {
    setLocalTrackArmed,
    setLocalTrackMuted,
    setLocalTrackVolume,
    updateLocalEffects,
    setLocalMonitoring,
    // Multi-track methods
    getOrCreateTrackProcessor,
    updateTrackState,
    updateTrackEffects,
  } = useAudioEngine();

  // Track last sync state for each track
  const lastSyncRef = useRef<Map<string, TrackSyncState>>(new Map());

  // Legacy single-track sync ref for backward compatibility
  const lastPrimarySyncRef = useRef<TrackSyncState | null>(null);

  useEffect(() => {
    if (!currentUserId) return;

    // Subscribe to track changes
    const unsubscribe = useUserTracksStore.subscribe((state) => {
      // Get all tracks for the current user
      const userTracks = state.getTracksByUser(currentUserId);
      if (userTracks.length === 0) return;

      // Check if any track is soloed (affects mute logic for all tracks)
      const allTracks = state.getAllTracks();
      const hasSoloedTracks = allTracks.some(t => t.isSolo);

      // Check if native bridge is active
      const bridgeState = useBridgeAudioStore.getState();
      const useBridge = bridgeState.isConnected && bridgeState.preferNativeBridge && bridgeState.isRunning;

      // Process each track
      for (let i = 0; i < userTracks.length; i++) {
        const track = userTracks[i];
        if (!track) continue;

        // Calculate effective mute state considering solo
        const isEffectivelyMuted = track.isMuted ||
          (hasSoloedTracks && !track.isSolo);

        const currentState: TrackSyncState = {
          isArmed: track.isArmed,
          isMuted: isEffectivelyMuted,
          isSolo: track.isSolo,
          volume: track.volume,
          inputGainDb: track.audioSettings.inputGain || 0,
          monitoringEnabled: track.audioSettings.directMonitoring ?? true,
          monitoringVolume: track.audioSettings.monitoringVolume ?? 1,
          effects: track.audioSettings.effects || null,
          channelConfig: track.audioSettings.channelConfig || { channelCount: 2, leftChannel: 0, rightChannel: 1 },
        };

        const lastState = lastSyncRef.current.get(track.id);

        // Ensure track processor exists in audio engine
        getOrCreateTrackProcessor(track.id, track.audioSettings);

        // Sync state to audio engine's track processor
        const stateChanged = !lastState ||
          lastState.isArmed !== currentState.isArmed ||
          lastState.isMuted !== currentState.isMuted ||
          lastState.isSolo !== currentState.isSolo ||
          lastState.volume !== currentState.volume ||
          lastState.inputGainDb !== currentState.inputGainDb ||
          lastState.monitoringEnabled !== currentState.monitoringEnabled;

        if (stateChanged) {
          // Calculate monitoring: only monitor if armed and not muted
          const shouldMonitor = currentState.isArmed && !currentState.isMuted && currentState.monitoringEnabled;

          updateTrackState(track.id, {
            isArmed: currentState.isArmed,
            isMuted: currentState.isMuted,
            isSolo: currentState.isSolo,
            volume: currentState.volume,
            inputGain: currentState.inputGainDb,
            monitoringEnabled: shouldMonitor,
          });
        }

        // Sync effects if changed
        if (currentState.effects && (!lastState || lastState.effects !== currentState.effects)) {
          updateTrackEffects(track.id, currentState.effects);
        }

        // Primary track (first track) also updates legacy single-track API for backward compat
        if (i === 0) {
          const lastPrimaryState = lastPrimarySyncRef.current;

          if (!lastPrimaryState || lastPrimaryState.isArmed !== currentState.isArmed) {
            setLocalTrackArmed(currentState.isArmed);
          }
          if (!lastPrimaryState || lastPrimaryState.isMuted !== currentState.isMuted) {
            setLocalTrackMuted(currentState.isMuted);
          }
          if (!lastPrimaryState || lastPrimaryState.volume !== currentState.volume) {
            setLocalTrackVolume(currentState.volume);
          }
          if (currentState.effects && (!lastPrimaryState || lastPrimaryState.effects !== currentState.effects)) {
            updateLocalEffects(currentState.effects);
          }

          // Software monitoring for primary track
          const shouldSoftwareMonitor = currentState.isArmed && !currentState.isMuted;
          if (!lastPrimaryState ||
              lastPrimaryState.isArmed !== currentState.isArmed ||
              lastPrimaryState.isMuted !== currentState.isMuted) {
            console.log('[useTrackAudioSync] Primary track monitoring:', shouldSoftwareMonitor);
            setLocalMonitoring(shouldSoftwareMonitor);
          }

          lastPrimarySyncRef.current = currentState;
        }

        // Sync to native bridge if active
        if (useBridge) {
          const needsBridgeUpdate = !lastState ||
            lastState.isArmed !== currentState.isArmed ||
            lastState.isMuted !== currentState.isMuted ||
            lastState.isSolo !== currentState.isSolo ||
            lastState.volume !== currentState.volume ||
            lastState.inputGainDb !== currentState.inputGainDb ||
            lastState.monitoringEnabled !== currentState.monitoringEnabled ||
            lastState.monitoringVolume !== currentState.monitoringVolume;

          if (needsBridgeUpdate) {
            nativeBridge.updateTrackState(track.id, {
              isArmed: currentState.isArmed,
              isMuted: currentState.isMuted,
              isSolo: currentState.isSolo,
              volume: currentState.volume,
              inputGainDb: currentState.inputGainDb,
              monitoringEnabled: currentState.monitoringEnabled,
              monitoringVolume: currentState.monitoringVolume,
            });
          }

          // Sync channel config if changed
          const channelChanged = !lastState ||
            lastState.channelConfig.channelCount !== currentState.channelConfig.channelCount ||
            lastState.channelConfig.leftChannel !== currentState.channelConfig.leftChannel ||
            lastState.channelConfig.rightChannel !== currentState.channelConfig.rightChannel;

          if (channelChanged) {
            nativeBridge.setTrackChannelConfig(track.id, currentState.channelConfig);
          }
        }

        // Update last sync state for this track
        lastSyncRef.current.set(track.id, currentState);
      }

      // Clean up removed tracks
      const currentTrackIds = new Set(userTracks.map(t => t.id));
      for (const trackId of lastSyncRef.current.keys()) {
        if (!currentTrackIds.has(trackId)) {
          lastSyncRef.current.delete(trackId);
          // Could also call removeTrackProcessor here if tracks are deleted
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [
    currentUserId,
    setLocalTrackArmed,
    setLocalTrackMuted,
    setLocalTrackVolume,
    updateLocalEffects,
    setLocalMonitoring,
    getOrCreateTrackProcessor,
    updateTrackState,
    updateTrackEffects,
  ]);
}
