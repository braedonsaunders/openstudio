'use client';

import { useEffect, useCallback, useRef } from 'react';
import {
  nativeBridge,
  launchNativeBridge,
  getNativeBridgeDownloadUrl,
} from '@/lib/audio/native-bridge';
import { useBridgeAudioStore } from '@/stores/bridge-audio-store';

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
  const store = useBridgeAudioStore();
  const listenersSetup = useRef(false);
  const hasRequestedDevices = useRef(false);

  // Set up event listeners FIRST, before any connection attempts
  useEffect(() => {
    const handleConnected = (data: { version: string; driverType: string }) => {
      console.log('[useNativeBridge] Connected event received:', data);
      store.setConnected(true);
      store.setDriverType(data.driverType);
      store.setError(null);
      // Request devices when connected
      console.log('[useNativeBridge] Requesting devices...');
      nativeBridge.getDevices();
    };

    const handleDisconnected = () => {
      console.log('[useNativeBridge] Disconnected');
      store.setConnected(false);
      store.setRunning(false);
      store.setDriverType(null);
      store.setDevices([], []);
      hasRequestedDevices.current = false;
    };

    const handleAudioStatus = (data: {
      isRunning: boolean;
      inputLatencyMs: number;
      outputLatencyMs: number;
      totalLatencyMs: number;
    }) => {
      console.log('[useNativeBridge] Audio status:', data);
      store.setRunning(data.isRunning);
      store.setLatency({
        input: data.inputLatencyMs,
        output: data.outputLatencyMs,
        total: data.totalLatencyMs,
      });
      // Clear error when audio starts successfully
      if (data.isRunning) {
        store.setError(null);
      }
    };

    const handleDevices = (data: { inputs: BridgeDevice[]; outputs: BridgeDevice[] }) => {
      console.log('[useNativeBridge] Devices received:', data);
      store.setDevices(data.inputs, data.outputs);
    };

    const handleError = (data: { code: string; message: string }) => {
      console.error('[useNativeBridge] Error:', data);
      store.setError(data);
    };

    // Register all listeners
    nativeBridge.on('connected', handleConnected);
    nativeBridge.on('disconnected', handleDisconnected);
    nativeBridge.on('audioStatus', handleAudioStatus);
    nativeBridge.on('devices', handleDevices);
    nativeBridge.on('error', handleError);

    listenersSetup.current = true;
    console.log('[useNativeBridge] Event listeners registered');

    return () => {
      nativeBridge.off('connected', handleConnected);
      nativeBridge.off('disconnected', handleDisconnected);
      nativeBridge.off('audioStatus', handleAudioStatus);
      nativeBridge.off('devices', handleDevices);
      nativeBridge.off('error', handleError);
      listenersSetup.current = false;
    };
  }, [store]);

  // Check availability AFTER listeners are set up
  useEffect(() => {
    // Wait for listeners to be set up
    if (!listenersSetup.current) return;

    let mounted = true;

    const checkAvailability = async () => {
      console.log('[useNativeBridge] Checking bridge availability...');

      try {
        const connected = await nativeBridge.connect();
        console.log('[useNativeBridge] Connection result:', connected);

        if (mounted && connected) {
          store.setConnected(true);
          const driverType = nativeBridge.getDriverType();
          console.log('[useNativeBridge] Driver type:', driverType);
          store.setDriverType(driverType);

          // Request devices if we haven't already
          if (!hasRequestedDevices.current) {
            console.log('[useNativeBridge] Requesting devices after connect...');
            hasRequestedDevices.current = true;
            nativeBridge.getDevices();
          }
        }
      } catch (err) {
        console.error('[useNativeBridge] Connection error:', err);
      }
    };

    checkAvailability();

    return () => {
      mounted = false;
    };
  }, [store]);

  // Connect to bridge
  const connect = useCallback(async () => {
    console.log('[useNativeBridge] Manual connect requested');
    const connected = await nativeBridge.connect();
    console.log('[useNativeBridge] Manual connect result:', connected);

    if (connected) {
      store.setConnected(true);
      store.setDriverType(nativeBridge.getDriverType());
      // Request devices
      console.log('[useNativeBridge] Requesting devices after manual connect...');
      nativeBridge.getDevices();
    } else {
      store.setConnected(false);
    }
    return connected;
  }, [store]);

  // Disconnect from bridge
  const disconnect = useCallback(() => {
    console.log('[useNativeBridge] Disconnecting...');
    nativeBridge.disconnect();
    store.setConnected(false);
    store.setRunning(false);
    store.setDriverType(null);
    store.setDevices([], []);
    hasRequestedDevices.current = false;
  }, [store]);

  // Launch native app with room context
  const launch = useCallback((roomId: string, userId: string, token: string) => {
    launchNativeBridge(roomId, userId, token);

    // Try to connect after a short delay
    setTimeout(async () => {
      await connect();
    }, 2000);
  }, [connect]);

  // Get download URL
  const getDownloadUrl = useCallback(() => {
    return getNativeBridgeDownloadUrl();
  }, []);

  // Configure and start audio
  const startAudio = useCallback(() => {
    const state = useBridgeAudioStore.getState();
    if (!state.isConnected) {
      console.warn('[useNativeBridge] Cannot start audio - not connected');
      return;
    }

    console.log('[useNativeBridge] Starting audio with config:', {
      inputDevice: state.selectedInputDeviceId,
      outputDevice: state.selectedOutputDeviceId,
      bufferSize: state.bufferSize,
      sampleRate: state.sampleRate,
      channelConfig: state.inputChannelConfig,
    });

    // Configure devices before starting
    if (state.selectedInputDeviceId) {
      nativeBridge.setInputDevice(state.selectedInputDeviceId);
    }
    if (state.selectedOutputDeviceId) {
      nativeBridge.setOutputDevice(state.selectedOutputDeviceId);
    }

    // Configure buffer size and sample rate
    nativeBridge.setBufferSize(state.bufferSize);
    nativeBridge.setSampleRate(state.sampleRate);

    // Configure channel config
    nativeBridge.setChannelConfig(state.inputChannelConfig);

    // Now start audio
    nativeBridge.startAudio();
  }, []);

  // Stop audio
  const stopAudio = useCallback(() => {
    const state = useBridgeAudioStore.getState();
    if (state.isConnected) {
      console.log('[useNativeBridge] Stopping audio');
      nativeBridge.stopAudio();
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

  // Set input device and send to bridge
  const setInputDevice = useCallback((deviceId: string) => {
    console.log('[useNativeBridge] Setting input device:', deviceId);
    store.setSelectedInputDevice(deviceId);
    const state = useBridgeAudioStore.getState();
    if (state.isConnected) {
      nativeBridge.setInputDevice(deviceId);
    }
  }, [store]);

  // Set output device and send to bridge
  const setOutputDevice = useCallback((deviceId: string) => {
    console.log('[useNativeBridge] Setting output device:', deviceId);
    store.setSelectedOutputDevice(deviceId);
    const state = useBridgeAudioStore.getState();
    if (state.isConnected) {
      nativeBridge.setOutputDevice(deviceId);
    }
  }, [store]);

  // Set buffer size
  const setBufferSize = useCallback((size: 32 | 64 | 128 | 256 | 512 | 1024) => {
    store.setBufferSize(size);
    const state = useBridgeAudioStore.getState();
    if (state.isConnected) {
      nativeBridge.setBufferSize(size);
    }
  }, [store]);

  // Set sample rate
  const setSampleRate = useCallback((rate: 44100 | 48000) => {
    store.setSampleRate(rate);
    const state = useBridgeAudioStore.getState();
    if (state.isConnected) {
      nativeBridge.setSampleRate(rate);
    }
  }, [store]);

  // Set channel config
  const setChannelConfig = useCallback((config: { channelCount: 1 | 2; leftChannel: number; rightChannel?: number }) => {
    store.setInputChannelConfig(config);
    const state = useBridgeAudioStore.getState();
    if (state.isConnected) {
      nativeBridge.setChannelConfig(config);
    }
  }, [store]);

  return {
    // Connection state
    isAvailable: store.isConnected ? true : null,
    isConnected: store.isConnected,
    driverType: store.driverType,

    // Audio state
    isRunning: store.isRunning,
    latency: store.latency,

    // Devices
    inputDevices: store.inputDevices,
    outputDevices: store.outputDevices,
    selectedInputDeviceId: store.selectedInputDeviceId,
    selectedOutputDeviceId: store.selectedOutputDeviceId,
    getSelectedInputDevice: store.getSelectedInputDevice,
    getSelectedOutputDevice: store.getSelectedOutputDevice,

    // Settings
    bufferSize: store.bufferSize,
    sampleRate: store.sampleRate,
    inputChannelConfig: store.inputChannelConfig,

    // Error
    lastError: store.lastError,

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
  };
}
