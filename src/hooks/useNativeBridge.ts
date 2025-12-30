'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import {
  nativeBridge,
  launchNativeBridge,
  getNativeBridgeDownloadUrl,
  type BridgeAudioData,
} from '@/lib/audio/native-bridge';
import { useBridgeAudioStore } from '@/stores/bridge-audio-store';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { useAudioStore } from '@/stores/audio-store';
import { useRoomStore } from '@/stores/room-store';

// Import audio engine for bridge audio processing
// We use a lazy import pattern to avoid circular dependencies
let audioEngineModule: typeof import('./useAudioEngine') | null = null;
const getAudioEngine = async () => {
  if (!audioEngineModule) {
    audioEngineModule = await import('./useAudioEngine');
  }
  return audioEngineModule;
};

interface BridgeDevice {
  id: string;
  name: string;
  isInput: boolean;
  isOutput: boolean;
  channels: { index: number; name: string }[];
  sampleRates: number[];
  isDefault: boolean;
  driverType: string;
}

export function useNativeBridge() {
  // Get store state reactively for UI updates
  const storeState = useBridgeAudioStore();

  // Track whether we've completed the initial availability check
  const [hasCheckedAvailability, setHasCheckedAvailability] = useState(false);

  // Use refs to track initialization
  const initialized = useRef(false);

  // Single useEffect for setup - runs once on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Get store actions (these are stable)
    const store = useBridgeAudioStore.getState();

    // Sync sample rates between stores on initialization
    // bridge-audio-store is persisted and is the source of truth for user's preference
    // audio-store is NOT persisted, so we need to sync it on every load
    const bridgeSampleRate = store.sampleRate;
    const audioStoreState = useAudioStore.getState();
    if (bridgeSampleRate !== audioStoreState.settings.sampleRate) {
      console.log(`[useNativeBridge] Syncing sample rate on init: bridge-store=${bridgeSampleRate}, audio-store=${audioStoreState.settings.sampleRate}`);
      audioStoreState.setSettings({ sampleRate: bridgeSampleRate });
    }

    const handleConnected = (data: { version: string; driverType: string }) => {
      console.log('[useNativeBridge] Connected event received:', data);
      const s = useBridgeAudioStore.getState();
      s.setConnected(true);
      s.setDriverType(data.driverType);
      s.setError(null);
      // Request devices when connected
      console.log('[useNativeBridge] Requesting devices...');
      nativeBridge.getDevices();
    };

    const handleDisconnected = () => {
      console.log('[useNativeBridge] Disconnected');
      const s = useBridgeAudioStore.getState();
      s.setConnected(false);
      s.setRunning(false);
      s.setDriverType(null);
      s.setDevices([], []);
    };

    const handleAudioStatus = (data: {
      isRunning: boolean;
      inputLatencyMs: number;
      outputLatencyMs: number;
      totalLatencyMs: number;
    }) => {
      console.log('[useNativeBridge] Audio status:', data);
      const s = useBridgeAudioStore.getState();
      s.setRunning(data.isRunning);
      s.setLatency({
        input: data.inputLatencyMs,
        output: data.outputLatencyMs,
        total: data.totalLatencyMs,
      });
      if (data.isRunning) {
        s.setError(null);
      }
    };

    const handleDevices = (data: { inputs: BridgeDevice[]; outputs: BridgeDevice[] }) => {
      console.log('[useNativeBridge] Devices received:', data);
      const s = useBridgeAudioStore.getState();
      s.setDevices(data.inputs, data.outputs);
    };

    const handleError = (data: { code: string; message: string }) => {
      console.error('[useNativeBridge] Error:', data);
      const s = useBridgeAudioStore.getState();
      s.setError(data);
    };

    // Handle audio levels from native bridge - update track levels for waveform display
    const handleLevels = (data: {
      inputLevel: number;
      inputPeak: number;
      outputLevel: number;
      outputPeak: number;
      remoteLevels: [string, number][];
    }) => {
      // Store input levels in bridge audio store for UI metering
      useBridgeAudioStore.getState().setInputLevels(data.inputLevel, data.inputPeak);

      // Get current user's primary track and update its level
      const roomState = useRoomStore.getState();
      const currentUserId = roomState.currentUser?.id;

      if (currentUserId) {
        const tracksState = useUserTracksStore.getState();
        const userTracks = tracksState.getTracksByUser(currentUserId);

        if (userTracks.length > 0) {
          const primaryTrackId = userTracks[0].id;
          // Update track level for waveform visualization
          tracksState.setTrackLevel(primaryTrackId, data.inputLevel);
        }

        // Also update room store audioLevels for fallback (components check this too)
        roomState.setAudioLevel('local', data.inputLevel);
      }

      // Also update the global local level in audio store
      useAudioStore.getState().setLocalLevel(data.inputLevel);
    };

    // Counter for audioData logging
    let audioDataCounter = 0;

    // Handle raw audio data from native bridge
    // This is the core of the bridge integration - raw ASIO audio is sent here
    // and routed through Web Audio effects chain + WebRTC for broadcast
    const handleAudioData = async (data: BridgeAudioData) => {
      // Log occasionally to confirm audio data is being received
      if (audioDataCounter++ % 500 === 0) {
        console.log('[useNativeBridge] handleAudioData called, samples:', data.samples?.length,
          'hasEngine:', !!(window as any).__openStudioAudioEngine,
          'bridgeEnabled:', (window as any).__openStudioAudioEngine?.isBridgeAudioEnabled?.());
      }

      // Get audio engine and push samples
      // The audio engine will process through effects and route to WebRTC
      try {
        const engineModule = await getAudioEngine();
        // Access the global engine directly since we can't use the hook here
        // The pushBridgeAudio is designed to be called from outside React
        if (typeof window !== 'undefined' && (window as any).__openStudioAudioEngine) {
          (window as any).__openStudioAudioEngine.pushBridgeAudio(data.samples);
        }
      } catch (e) {
        console.error('[useNativeBridge] handleAudioData error:', e);
      }
    };

    // Register all listeners
    nativeBridge.on('connected', handleConnected);
    nativeBridge.on('disconnected', handleDisconnected);
    nativeBridge.on('audioStatus', handleAudioStatus);
    nativeBridge.on('devices', handleDevices);
    nativeBridge.on('error', handleError);
    nativeBridge.on('levels', handleLevels);
    nativeBridge.on('audioData', handleAudioData);

    console.log('[useNativeBridge] Event listeners registered, checking availability...');

    // Check if bridge is available - the 'connected' event handler will request devices
    const checkAvailability = async () => {
      try {
        const connected = await nativeBridge.connect();
        console.log('[useNativeBridge] Connection result:', connected);
        // Note: Don't call getDevices() here - handleConnected will do it when 'connected' event fires
      } catch (err) {
        console.error('[useNativeBridge] Connection error:', err);
      } finally {
        setHasCheckedAvailability(true);
      }
    };

    checkAvailability();

    return () => {
      nativeBridge.off('connected', handleConnected);
      nativeBridge.off('disconnected', handleDisconnected);
      nativeBridge.off('audioStatus', handleAudioStatus);
      nativeBridge.off('devices', handleDevices);
      nativeBridge.off('error', handleError);
      nativeBridge.off('levels', handleLevels);
      nativeBridge.off('audioData', handleAudioData);
      initialized.current = false;
    };
  }, []); // Empty dependency array - run once

  // Connect to bridge
  const connect = useCallback(async () => {
    console.log('[useNativeBridge] Manual connect requested');
    const connected = await nativeBridge.connect();
    console.log('[useNativeBridge] Manual connect result:', connected);
    // Note: Don't manually update store or call getDevices here
    // The 'connected' event handler (handleConnected) will do this
    return connected;
  }, []);

  // Disconnect from bridge
  const disconnect = useCallback(() => {
    console.log('[useNativeBridge] Disconnecting...');
    nativeBridge.disconnect();
    const store = useBridgeAudioStore.getState();
    store.setConnected(false);
    store.setRunning(false);
    store.setDriverType(null);
    store.setDevices([], []);
  }, []);

  // Launch native app with room context
  const launch = useCallback((roomId: string, userId: string, token: string) => {
    launchNativeBridge(roomId, userId, token);
    setTimeout(async () => {
      await connect();
    }, 2000);
  }, [connect]);

  // Get download URL
  const getDownloadUrl = useCallback(() => {
    return getNativeBridgeDownloadUrl();
  }, []);

  // Configure and start audio
  const startAudio = useCallback(async () => {
    const state = useBridgeAudioStore.getState();
    if (!state.isConnected) {
      console.warn('[useNativeBridge] Cannot start audio - not connected');
      return;
    }

    // For ASIO, use same device for input and output
    // If input not set or different from output, use output device for both
    const deviceId = state.selectedOutputDeviceId;

    console.log('[useNativeBridge] Starting audio with config:', {
      device: deviceId,
      bufferSize: state.bufferSize,
      sampleRate: state.sampleRate,
      channelConfig: state.inputChannelConfig,
    });

    // Ensure AudioContext sample rate matches the user's selection
    // If they differ, recreate the AudioContext with the correct rate
    if (typeof window !== 'undefined' && (window as any).__openStudioAudioEngine) {
      const engine = (window as any).__openStudioAudioEngine;
      const audioCtx = engine.getAudioContext?.();
      if (audioCtx?.sampleRate && audioCtx.sampleRate !== state.sampleRate) {
        console.log(`[useNativeBridge] AudioContext rate (${audioCtx.sampleRate}) differs from UI (${state.sampleRate}). Changing to match.`);
        await engine.changeSampleRate(state.sampleRate);
      }
    }

    // Configure native bridge
    if (deviceId) {
      nativeBridge.setInputDevice(deviceId);
      nativeBridge.setOutputDevice(deviceId);
    }

    nativeBridge.setBufferSize(state.bufferSize);
    nativeBridge.setSampleRate(state.sampleRate);
    nativeBridge.setChannelConfig(state.inputChannelConfig);
    nativeBridge.startAudio();

    // Small delay to let native bridge initialize with correct sample rate
    await new Promise(resolve => setTimeout(resolve, 50));

    // NOW enable bridge audio mode in the audio engine
    // This creates the ScriptProcessorNode that will receive audio from native bridge
    if (typeof window !== 'undefined' && (window as any).__openStudioAudioEngine) {
      const engine = (window as any).__openStudioAudioEngine;
      console.log('[useNativeBridge] Enabling bridge audio mode. Sample rate:', state.sampleRate);
      await engine.enableBridgeAudio();
    }

    // Send initial track state after starting audio
    const roomState = useRoomStore.getState();
    const currentUserId = roomState.currentUser?.id;
    if (currentUserId) {
      const tracksState = useUserTracksStore.getState();
      const userTracks = tracksState.getTracksByUser(currentUserId);
      if (userTracks.length > 0) {
        const track = userTracks[0];
        console.log('[useNativeBridge] Sending initial track state to bridge:', track.id);
        // Note: We only send track state, not effects
        // Effects are processed in the browser via Web Audio, not in the native bridge
        nativeBridge.updateTrackState(track.id, {
          isArmed: track.isArmed,
          isMuted: track.isMuted,
          isSolo: track.isSolo,
          volume: track.volume,
          inputGainDb: track.audioSettings.inputGain || 0,
          monitoringEnabled: track.audioSettings.directMonitoring ?? true,
          monitoringVolume: track.audioSettings.monitoringVolume ?? 1,
        });

        // Also sync effects to the audio engine
        // This ensures effects are applied even if useTrackAudioSync hasn't fired yet
        if (typeof window !== 'undefined' && (window as any).__openStudioAudioEngine && track.audioSettings.effects) {
          console.log('[useNativeBridge] Syncing initial effects to audio engine');
          (window as any).__openStudioAudioEngine.updateLocalEffects(track.audioSettings.effects);
        }

        // Sync track state to audio engine
        // Browser software monitoring is controlled by ARM state (not Direct Monitoring)
        // Direct Monitoring only controls native bridge DRY passthrough
        if (typeof window !== 'undefined' && (window as any).__openStudioAudioEngine) {
          (window as any).__openStudioAudioEngine.setLocalTrackArmed(track.isArmed);
          (window as any).__openStudioAudioEngine.setLocalTrackMuted(track.isMuted);
          (window as any).__openStudioAudioEngine.setLocalTrackVolume(track.volume);
          // Software monitoring = armed && not muted
          const shouldSoftwareMonitor = track.isArmed && !track.isMuted;
          console.log('[useNativeBridge] Syncing software monitoring:', shouldSoftwareMonitor, '(armed:', track.isArmed, 'muted:', track.isMuted, ')');
          (window as any).__openStudioAudioEngine.setMonitoringEnabled(shouldSoftwareMonitor);
        }
      }
    }
  }, []);

  // Stop audio
  const stopAudio = useCallback(() => {
    const state = useBridgeAudioStore.getState();
    if (state.isConnected) {
      console.log('[useNativeBridge] Stopping audio');
      nativeBridge.stopAudio();
    }

    // Disable bridge audio mode in the audio engine
    if (typeof window !== 'undefined' && (window as any).__openStudioAudioEngine) {
      console.log('[useNativeBridge] Disabling bridge audio mode in audio engine');
      (window as any).__openStudioAudioEngine.disableBridgeAudio();
    }
  }, []);

  // Refresh devices
  const refreshDevices = useCallback(() => {
    const state = useBridgeAudioStore.getState();
    if (state.isConnected) {
      console.log('[useNativeBridge] Refreshing devices');
      nativeBridge.getDevices();
    } else {
      console.warn('[useNativeBridge] Cannot refresh devices - not connected');
    }
  }, []);

  // Set input device
  const setInputDevice = useCallback((deviceId: string) => {
    console.log('[useNativeBridge] Setting input device:', deviceId);
    const store = useBridgeAudioStore.getState();
    store.setSelectedInputDevice(deviceId);
    if (store.isConnected) {
      nativeBridge.setInputDevice(deviceId);
    }
  }, []);

  // Set output device
  const setOutputDevice = useCallback((deviceId: string) => {
    console.log('[useNativeBridge] Setting output device:', deviceId);
    const store = useBridgeAudioStore.getState();
    store.setSelectedOutputDevice(deviceId);
    if (store.isConnected) {
      nativeBridge.setOutputDevice(deviceId);
    }
  }, []);

  // Set buffer size
  const setBufferSize = useCallback((size: 32 | 64 | 128 | 256 | 512 | 1024) => {
    const store = useBridgeAudioStore.getState();
    store.setBufferSize(size);
    if (store.isConnected) {
      nativeBridge.setBufferSize(size);
    }
  }, []);

  // Set sample rate - this changes BOTH AudioContext and native bridge
  // Also syncs audio-store to keep all sample rate settings consistent
  const setSampleRate = useCallback(async (rate: 44100 | 48000) => {
    const store = useBridgeAudioStore.getState();
    const wasRunning = store.isRunning;
    store.setSampleRate(rate);

    // Also update audio-store to keep sample rates in sync across all stores
    // This ensures any future AudioEngine initialization uses the correct rate
    useAudioStore.getState().setSettings({ sampleRate: rate });

    // If bridge is running, stop it first before changing sample rate
    // The native bridge needs a full stop/start cycle to apply sample rate changes
    if (store.isConnected && wasRunning) {
      console.log('[useNativeBridge] Stopping bridge audio before sample rate change');
      nativeBridge.stopAudio();
      // Give the native bridge time to stop cleanly
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Change the AudioContext sample rate (recreates it)
    if (typeof window !== 'undefined' && (window as any).__openStudioAudioEngine) {
      console.log('[useNativeBridge] Changing AudioContext sample rate to', rate);
      await (window as any).__openStudioAudioEngine.changeSampleRate(rate);
    }

    // Update native bridge sample rate
    if (store.isConnected) {
      console.log('[useNativeBridge] Setting native bridge sample rate to', rate);
      nativeBridge.setSampleRate(rate);

      // If bridge was running, restart it with new rate
      if (wasRunning) {
        console.log('[useNativeBridge] Restarting bridge audio with new sample rate');

        // Small delay to ensure sample rate is applied
        await new Promise(resolve => setTimeout(resolve, 50));

        // Restart audio on native bridge
        nativeBridge.startAudio();

        // Wait for audio to start
        await new Promise(resolve => setTimeout(resolve, 100));

        // Note: We don't need to call enableBridgeAudio() here because
        // changeSampleRate() already re-enabled it with the new AudioContext.
        // Calling it again would clear the audio buffer.

        // Re-sync track state after the audio engine was recreated
        const roomState = useRoomStore.getState();
        const currentUserId = roomState.currentUser?.id;
        if (currentUserId) {
          const tracksState = useUserTracksStore.getState();
          const userTracks = tracksState.getTracksByUser(currentUserId);
          if (userTracks.length > 0) {
            const track = userTracks[0];

            // Send track state to native bridge
            nativeBridge.updateTrackState(track.id, {
              isArmed: track.isArmed,
              isMuted: track.isMuted,
              isSolo: track.isSolo,
              volume: track.volume,
              inputGainDb: track.audioSettings.inputGain || 0,
              monitoringEnabled: track.audioSettings.directMonitoring ?? true,
              monitoringVolume: track.audioSettings.monitoringVolume ?? 1,
            });

            // Sync to audio engine
            const engine = (window as any).__openStudioAudioEngine;
            if (engine) {
              engine.setLocalTrackArmed(track.isArmed);
              engine.setLocalTrackMuted(track.isMuted);
              engine.setLocalTrackVolume(track.volume);
              const shouldSoftwareMonitor = track.isArmed && !track.isMuted;
              console.log('[useNativeBridge] After sample rate change - setting software monitoring:', shouldSoftwareMonitor);
              engine.setMonitoringEnabled(shouldSoftwareMonitor);
              if (track.audioSettings.effects) {
                engine.updateLocalEffects(track.audioSettings.effects);
              }
            }
          }
        }
      }
    }
  }, []);

  // Set channel config
  const setChannelConfig = useCallback((config: { channelCount: 1 | 2; leftChannel: number; rightChannel?: number }) => {
    const store = useBridgeAudioStore.getState();
    store.setInputChannelConfig(config);
    if (store.isConnected) {
      nativeBridge.setChannelConfig(config);
    }
  }, []);

  return {
    // Connection state (reactive from store)
    // isAvailable: null = still checking, true = connected, false = not available
    isAvailable: !hasCheckedAvailability ? null : storeState.isConnected,
    isConnected: storeState.isConnected,
    driverType: storeState.driverType,

    // Audio state
    isRunning: storeState.isRunning,
    latency: storeState.latency,

    // Devices
    inputDevices: storeState.inputDevices,
    outputDevices: storeState.outputDevices,
    selectedInputDeviceId: storeState.selectedInputDeviceId,
    selectedOutputDeviceId: storeState.selectedOutputDeviceId,
    getSelectedInputDevice: storeState.getSelectedInputDevice,
    getSelectedOutputDevice: storeState.getSelectedOutputDevice,

    // Settings
    bufferSize: storeState.bufferSize,
    sampleRate: storeState.sampleRate,
    inputChannelConfig: storeState.inputChannelConfig,
    preferNativeBridge: storeState.preferNativeBridge,

    // Error
    lastError: storeState.lastError,

    // Bridge instance
    bridge: nativeBridge,

    // Actions
    connect,
    disconnect,
    launch,
    getDownloadUrl,
    startAudio,
    stopAudio,
    refreshDevices,
    setInputDevice,
    setOutputDevice,
    setBufferSize,
    setSampleRate,
    setChannelConfig,
    setPreferNativeBridge: storeState.setPreferNativeBridge,
  };
}
