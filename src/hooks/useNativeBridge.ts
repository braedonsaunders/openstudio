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

    // Handle raw audio data from native bridge
    // This is the core of the bridge integration - raw ASIO audio is sent here
    // and routed through Web Audio effects chain + WebRTC for broadcast
    const handleAudioData = async (data: BridgeAudioData) => {
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
        // Silently ignore - audio engine may not be ready yet
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

    // Enable bridge audio mode in the audio engine
    // This routes incoming bridge audio through Web Audio effects chain + WebRTC
    if (typeof window !== 'undefined' && (window as any).__openStudioAudioEngine) {
      console.log('[useNativeBridge] Enabling bridge audio mode in audio engine');
      await (window as any).__openStudioAudioEngine.enableBridgeAudio();
    }

    if (deviceId) {
      nativeBridge.setInputDevice(deviceId);
      nativeBridge.setOutputDevice(deviceId);
    }

    nativeBridge.setBufferSize(state.bufferSize);
    nativeBridge.setSampleRate(state.sampleRate);
    nativeBridge.setChannelConfig(state.inputChannelConfig);
    nativeBridge.startAudio();

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

  // Set sample rate
  const setSampleRate = useCallback((rate: 44100 | 48000) => {
    const store = useBridgeAudioStore.getState();
    store.setSampleRate(rate);
    if (store.isConnected) {
      nativeBridge.setSampleRate(rate);
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
