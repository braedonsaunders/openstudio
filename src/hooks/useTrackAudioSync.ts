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

    console.log('[useTrackAudioSync] Force syncing all tracks, useBridge:', useBridge);

    for (const track of userTracks) {
      if (!track) continue;

      const isEffectivelyMuted = track.isMuted || (hasSoloedTracks && !track.isSolo);
      const directMonitoring = track.audioSettings.directMonitoring ?? true;
      const jsMonitoringEnabled = useBridge ? !directMonitoring : directMonitoring;

      getOrCreateTrackProcessor(track.id, track.audioSettings);
      updateTrackState(track.id, {
        isArmed: track.isArmed,
        isMuted: isEffectivelyMuted,
        isSolo: track.isSolo,
        volume: track.volume,
        inputGain: track.audioSettings.inputGain || 0,
        monitoringEnabled: jsMonitoringEnabled,
      });

      console.log(`[useTrackAudioSync] Force synced track ${track.id.slice(-8)}: isArmed=${track.isArmed}, jsMonitoringEnabled=${jsMonitoringEnabled}`);

      if (useBridge) {
        nativeBridge.updateTrackState(track.id, {
          isArmed: track.isArmed,
          isMuted: isEffectivelyMuted,
          isSolo: track.isSolo,
          volume: track.volume,
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
          // For bridge mode: JS monitors WET audio when directMonitoring is OFF
          // (Native bridge handles DRY monitoring when directMonitoring is ON)
          // For web audio mode: monitoringEnabled controls all monitoring
          const jsMonitoringEnabled = useBridge
            ? !currentState.monitoringEnabled  // Invert for WET when direct is OFF
            : currentState.monitoringEnabled;  // Use as-is for web audio

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

          // Note: Channel config is now handled at the global level via setChannelConfig()
          // Native bridge uses single-track audio capture; multi-track is handled in browser
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
