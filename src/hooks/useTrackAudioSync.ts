'use client';

import { useEffect, useRef } from 'react';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { useBridgeAudioStore } from '@/stores/bridge-audio-store';
import { useAudioEngine } from './useAudioEngine';
import { nativeBridge } from '@/lib/audio/native-bridge';
import type { ExtendedEffectsChain } from '@/types';

interface TrackSyncState {
  isArmed: boolean;
  isMuted: boolean;
  isSolo: boolean;
  volume: number;
  pan: number;
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
 * Syncs ALL user tracks - each track gets its own TrackAudioProcessor.
 */
export function useTrackAudioSync(currentUserId: string | undefined) {
  const {
    getOrCreateTrackProcessor,
    updateTrackState,
    updateTrackEffects,
    removeTrackProcessor,
  } = useAudioEngine();

  const lastSyncRef = useRef<Map<string, TrackSyncState>>(new Map());
  const bridgeWasRunningRef = useRef<boolean>(false);

  // Force sync function - applies current state to all track processors
  const forceSync = (currentUserId: string) => {
    const state = useUserTracksStore.getState();
    const userTracks = state.getTracksByUser(currentUserId);
    if (userTracks.length === 0) return;

    const allTracks = state.getAllTracks();
    const hasSoloedTracks = allTracks.some(t => t.isSolo);

    const bridgeState = useBridgeAudioStore.getState();
    const useBridge = bridgeState.isConnected && bridgeState.preferNativeBridge && bridgeState.isRunning;

    for (const track of userTracks) {
      if (!track) continue;

      const isEffectivelyMuted = track.isMuted || (hasSoloedTracks && !track.isSolo);
      const directMonitoring = track.audioSettings.directMonitoring ?? true;
      // When using native bridge, JS should stay silent - native handles monitoring
      // When NOT using bridge, JS handles monitoring directly
      const jsMonitoringEnabled = useBridge ? false : directMonitoring;

      getOrCreateTrackProcessor(track.id, track.audioSettings);
      updateTrackState(track.id, {
        isArmed: track.isArmed,
        isMuted: isEffectivelyMuted,
        isSolo: track.isSolo,
        volume: track.volume,
        inputGain: track.audioSettings.inputGain || 0,
        monitoringEnabled: jsMonitoringEnabled,
      });

      if (useBridge) {
        nativeBridge.updateTrackState(track.id, {
          isArmed: track.isArmed,
          isMuted: isEffectivelyMuted,
          isSolo: track.isSolo,
          volume: track.volume,
          pan: track.pan ?? 0,
          inputGainDb: track.audioSettings.inputGain || 0,
          monitoringEnabled: directMonitoring,
          monitoringVolume: track.audioSettings.monitoringVolume ?? 1,
        });
      }

      // Update lastSyncRef so subsequent subscriptions don't duplicate
      lastSyncRef.current.set(track.id, {
        isArmed: track.isArmed,
        isMuted: isEffectivelyMuted,
        isSolo: track.isSolo,
        volume: track.volume,
        pan: track.pan ?? 0,
        inputGainDb: track.audioSettings.inputGain || 0,
        monitoringEnabled: directMonitoring,
        monitoringVolume: track.audioSettings.monitoringVolume ?? 1,
        effects: track.audioSettings.effects || null,
        channelConfig: track.audioSettings.channelConfig || { channelCount: 2, leftChannel: 0, rightChannel: 1 },
      });
    }
  };

  useEffect(() => {
    if (!currentUserId) return;

    // Check if bridge is already running on mount
    const initialBridgeState = useBridgeAudioStore.getState();
    const bridgeAlreadyRunning = initialBridgeState.isConnected &&
                                  initialBridgeState.preferNativeBridge &&
                                  initialBridgeState.isRunning;

    bridgeWasRunningRef.current = bridgeAlreadyRunning;

    if (bridgeAlreadyRunning) {
      console.log('[useTrackAudioSync] Bridge already running on mount, forcing sync');
      lastSyncRef.current.clear();
      forceSync(currentUserId);
    }

    // Subscribe to bridge store to trigger resync when bridge starts
    // Note: useBridgeAudioStore doesn't use subscribeWithSelector, so we use a ref to track previous state
    const bridgeUnsubscribe = useBridgeAudioStore.subscribe((bridgeState) => {
      const nowRunning = bridgeState.isConnected && bridgeState.preferNativeBridge && bridgeState.isRunning;
      const wasRunning = bridgeWasRunningRef.current;

      // When bridge starts running, force a full resync
      if (nowRunning && !wasRunning) {
        console.log('[useTrackAudioSync] Bridge started, triggering force sync');
        lastSyncRef.current.clear();
        forceSync(currentUserId);
      }

      bridgeWasRunningRef.current = nowRunning;
    });

    const unsubscribe = useUserTracksStore.subscribe((state) => {
      const userTracks = state.getTracksByUser(currentUserId);
      if (userTracks.length === 0) return;

      // Check if any track is soloed (affects mute logic for all tracks)
      const allTracks = state.getAllTracks();
      const hasSoloedTracks = allTracks.some(t => t.isSolo);

      // Check if native bridge is active
      const bridgeState = useBridgeAudioStore.getState();
      const useBridge = bridgeState.isConnected && bridgeState.preferNativeBridge && bridgeState.isRunning;

      // Process each track
      for (const track of userTracks) {
        if (!track) continue;

        // Calculate effective mute state considering solo
        const isEffectivelyMuted = track.isMuted || (hasSoloedTracks && !track.isSolo);

        const currentState: TrackSyncState = {
          isArmed: track.isArmed,
          isMuted: isEffectivelyMuted,
          isSolo: track.isSolo,
          volume: track.volume,
          pan: track.pan ?? 0,
          inputGainDb: track.audioSettings.inputGain || 0,
          monitoringEnabled: track.audioSettings.directMonitoring ?? true,
          monitoringVolume: track.audioSettings.monitoringVolume ?? 1,
          effects: track.audioSettings.effects || null,
          channelConfig: track.audioSettings.channelConfig || { channelCount: 2, leftChannel: 0, rightChannel: 1 },
        };

        const lastState = lastSyncRef.current.get(track.id);

        // Ensure track processor exists
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
          // When using native bridge:
          // - Native bridge handles DRY monitoring (zero-latency hardware path)
          // - JS should NOT add additional monitoring on top
          // - monitoringEnabled controls ONLY native bridge monitoring
          // When NOT using native bridge:
          // - JS handles all monitoring through effects chain
          // - monitoringEnabled directly controls JS monitoring
          const jsMonitoringEnabled = useBridge
            ? false  // Native bridge handles monitoring, JS stays silent
            : currentState.monitoringEnabled;  // Use as-is for web audio mode

          updateTrackState(track.id, {
            isArmed: currentState.isArmed,
            isMuted: currentState.isMuted,
            isSolo: currentState.isSolo,
            volume: currentState.volume,
            inputGain: currentState.inputGainDb,
            monitoringEnabled: jsMonitoringEnabled,
          });
        }

        // Sync effects if changed
        if (currentState.effects && (!lastState || lastState.effects !== currentState.effects)) {
          updateTrackEffects(track.id, currentState.effects);
        }

        // Sync to native bridge if active
        if (useBridge) {
          const needsBridgeUpdate = !lastState ||
            lastState.isArmed !== currentState.isArmed ||
            lastState.isMuted !== currentState.isMuted ||
            lastState.isSolo !== currentState.isSolo ||
            lastState.volume !== currentState.volume ||
            lastState.pan !== currentState.pan ||
            lastState.inputGainDb !== currentState.inputGainDb ||
            lastState.monitoringEnabled !== currentState.monitoringEnabled ||
            lastState.monitoringVolume !== currentState.monitoringVolume;

          if (needsBridgeUpdate) {
            nativeBridge.updateTrackState(track.id, {
              isArmed: currentState.isArmed,
              isMuted: currentState.isMuted,
              isSolo: currentState.isSolo,
              volume: currentState.volume,
              pan: currentState.pan,
              inputGainDb: currentState.inputGainDb,
              monitoringEnabled: currentState.monitoringEnabled,
              monitoringVolume: currentState.monitoringVolume,
            });
          }

          // Note: Channel config is now handled at the global level via setChannelConfig()
          // Native bridge uses single-track audio capture; multi-track is handled in browser

          // Sync effects to native bridge when changed
          if (currentState.effects && (!lastState || lastState.effects !== currentState.effects)) {
            console.log('[useTrackAudioSync] Syncing effects to native bridge for track:', track.id);
            nativeBridge.updateEffects(track.id, currentState.effects);
          }
        }

        lastSyncRef.current.set(track.id, currentState);
      }

      // Clean up removed tracks
      const currentTrackIds = new Set(userTracks.map(t => t.id));
      for (const trackId of lastSyncRef.current.keys()) {
        if (!currentTrackIds.has(trackId)) {
          lastSyncRef.current.delete(trackId);
          removeTrackProcessor(trackId);
        }
      }
    });

    return () => {
      unsubscribe();
      bridgeUnsubscribe();
    };
  }, [currentUserId, getOrCreateTrackProcessor, updateTrackState, updateTrackEffects, removeTrackProcessor]);
}
