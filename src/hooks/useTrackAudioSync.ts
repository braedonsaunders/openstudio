'use client';

import { useEffect, useRef } from 'react';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { useBridgeAudioStore } from '@/stores/bridge-audio-store';
import { useAudioEngine } from './useAudioEngine';
import { nativeBridge } from '@/lib/audio/native-bridge';
import type { ExtendedEffectsChain, UserTrack } from '@/types';

interface TrackSyncState {
  trackName: string;
  bridgeTrackId: number | null;
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

interface RemoteTrackSyncState {
  payloadHash: string;
  bridgeTrackId: number;
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
  const lastRemoteSyncRef = useRef<Map<string, RemoteTrackSyncState>>(new Map());
  const bridgeWasRunningRef = useRef<boolean>(false);

  const syncRemoteTracks = (allTracks: UserTrack[], useBridge: boolean) => {
    if (!currentUserId) {
      return;
    }

    if (!useBridge) {
      for (const [remoteKey, remoteState] of lastRemoteSyncRef.current.entries()) {
        const [userId, trackId] = remoteKey.split(':', 2);
        nativeBridge.removeRemoteTrack(userId, trackId, remoteState.bridgeTrackId);
      }
      lastRemoteSyncRef.current.clear();
      return;
    }

    const activeRemoteTrackKeys = new Set<string>();

    for (const track of allTracks) {
      const bridgeTrackId = track.audioSettings.bridgeTrackId;
      const isRemoteAudioTrack =
        track.userId !== currentUserId &&
        track.type === 'audio' &&
        track.isActive !== false &&
        Number.isInteger(bridgeTrackId);

      if (!isRemoteAudioTrack) {
        continue;
      }

      const remoteKey = `${track.userId}:${track.id}`;
      activeRemoteTrackKeys.add(remoteKey);

      const payloadHash = JSON.stringify({
        bridgeTrackId,
        trackName: track.name,
        volume: track.volume,
        pan: track.pan ?? 0,
        muted: track.isMuted,
        solo: track.isSolo,
      });

      const previousSync = lastRemoteSyncRef.current.get(remoteKey);
      if (previousSync?.payloadHash === payloadHash) {
        continue;
      }

      nativeBridge.syncRemoteTrack({
        userId: track.userId,
        trackId: track.id,
        bridgeTrackId: bridgeTrackId as number,
        trackName: track.name,
        volume: track.volume,
        pan: track.pan ?? 0,
        muted: track.isMuted,
        solo: track.isSolo,
      });

      lastRemoteSyncRef.current.set(remoteKey, {
        payloadHash,
        bridgeTrackId: bridgeTrackId as number,
      });
    }

    for (const [remoteKey, remoteState] of Array.from(lastRemoteSyncRef.current.entries())) {
      if (activeRemoteTrackKeys.has(remoteKey)) {
        continue;
      }

      const [userId, trackId] = remoteKey.split(':', 2);
      nativeBridge.removeRemoteTrack(userId, trackId, remoteState.bridgeTrackId);
      lastRemoteSyncRef.current.delete(remoteKey);
    }
  };

  // Force sync function - applies current state to all track processors
  const forceSync = (currentUserId: string) => {
    const state = useUserTracksStore.getState();
    const userTracks = state.getTracksByUser(currentUserId);

    const allTracks = state.getAllTracks();
    const hasSoloedTracks = allTracks.some(t => t.isSolo);

    const bridgeState = useBridgeAudioStore.getState();
    const useBridge = bridgeState.isConnected && bridgeState.preferNativeBridge && bridgeState.isRunning;

    for (const track of userTracks) {
      if (!track) continue;
      const bridgeTrackId = track.audioSettings.bridgeTrackId ?? null;

      const isEffectivelyMuted = track.isMuted || (hasSoloedTracks && !track.isSolo);
      const directMonitoring = track.audioSettings.directMonitoring ?? true;
      // When using native bridge, JS should stay silent - native handles monitoring
      // When NOT using bridge, JS handles monitoring directly
      const jsMonitoringEnabled = useBridge ? false : directMonitoring;

      getOrCreateTrackProcessor(track.id, track.audioSettings);

      if (useBridge && bridgeTrackId !== null) {
        nativeBridge.syncLocalTrack({
          trackId: track.id,
          bridgeTrackId,
          trackName: track.name,
          channelConfig: track.audioSettings.channelConfig,
        });
      }

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
        trackName: track.name,
        bridgeTrackId,
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

    syncRemoteTracks(state.getAllTracks(), useBridge);
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
      const allTracks = state.getAllTracks();
      const hasSoloedTracks = allTracks.some(t => t.isSolo);

      // Check if native bridge is active
      const bridgeState = useBridgeAudioStore.getState();
      const useBridge = bridgeState.isConnected && bridgeState.preferNativeBridge && bridgeState.isRunning;

      // Process each track
      for (const track of userTracks) {
        if (!track) continue;
        const bridgeTrackId = track.audioSettings.bridgeTrackId ?? null;

        // Calculate effective mute state considering solo
        const isEffectivelyMuted = track.isMuted || (hasSoloedTracks && !track.isSolo);

        const currentState: TrackSyncState = {
          trackName: track.name,
          bridgeTrackId,
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

        if (useBridge && bridgeTrackId !== null) {
          const needsTrackRegistration = !lastState ||
            lastState.trackName !== currentState.trackName ||
            lastState.bridgeTrackId !== currentState.bridgeTrackId ||
            lastState.channelConfig.channelCount !== currentState.channelConfig.channelCount ||
            lastState.channelConfig.leftChannel !== currentState.channelConfig.leftChannel ||
            lastState.channelConfig.rightChannel !== currentState.channelConfig.rightChannel;

          if (needsTrackRegistration) {
            nativeBridge.syncLocalTrack({
              trackId: track.id,
              bridgeTrackId,
              trackName: track.name,
              channelConfig: currentState.channelConfig,
            });
          }
        }

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

          // Sync effects to native bridge when changed
          if (currentState.effects && (!lastState || lastState.effects !== currentState.effects)) {
            console.log('[useTrackAudioSync] Syncing effects to native bridge for track:', track.id);
            nativeBridge.updateEffects(track.id, currentState.effects);
          }
        }

        lastSyncRef.current.set(track.id, currentState);
      }

      syncRemoteTracks(state.getAllTracks(), useBridge);

      // Clean up removed tracks
      const currentTrackIds = new Set(userTracks.map(t => t.id));
      for (const trackId of lastSyncRef.current.keys()) {
        if (!currentTrackIds.has(trackId)) {
          lastSyncRef.current.delete(trackId);
          removeTrackProcessor(trackId);
          if (useBridge) {
            nativeBridge.removeLocalTrack(trackId);
          }
        }
      }
    });

    return () => {
      unsubscribe();
      bridgeUnsubscribe();
      for (const trackId of lastSyncRef.current.keys()) {
        nativeBridge.removeLocalTrack(trackId);
      }
      for (const [remoteKey, remoteState] of lastRemoteSyncRef.current.entries()) {
        const [userId, trackId] = remoteKey.split(':', 2);
        nativeBridge.removeRemoteTrack(userId, trackId, remoteState.bridgeTrackId);
      }
      lastRemoteSyncRef.current.clear();
    };
  }, [currentUserId, getOrCreateTrackProcessor, updateTrackState, updateTrackEffects, removeTrackProcessor]);
}
