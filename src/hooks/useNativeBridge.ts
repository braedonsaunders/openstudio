'use client';

import { useEffect, useCallback } from 'react';
import {
  nativeBridge,
  isNativeBridgeAvailable,
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

  // Check availability on mount
  useEffect(() => {
    let mounted = true;

    const checkAvailability = async () => {
      const available = await isNativeBridgeAvailable();
      if (mounted && available) {
        store.setConnected(true);
        store.setDriverType(nativeBridge.getDriverType());
        // Request devices when connected
        nativeBridge.getDevices();
      }
    };

    checkAvailability();

    return () => {
      mounted = false;
    };
  }, []);

  // Subscribe to events
  useEffect(() => {
    const handleConnected = (data: { version: string; driverType: string }) => {
      store.setConnected(true);
      store.setDriverType(data.driverType);
      store.setError(null);
      // Request devices when connected
      nativeBridge.getDevices();
    };

    const handleDisconnected = () => {
      store.setConnected(false);
      store.setRunning(false);
      store.setDriverType(null);
      store.setDevices([], []);
    };

    const handleAudioStatus = (data: {
      isRunning: boolean;
      inputLatencyMs: number;
      outputLatencyMs: number;
      totalLatencyMs: number;
    }) => {
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
      store.setDevices(data.inputs, data.outputs);
    };

    const handleError = (data: { code: string; message: string }) => {
      store.setError(data);
    };

    nativeBridge.on('connected', handleConnected);
    nativeBridge.on('disconnected', handleDisconnected);
    nativeBridge.on('audioStatus', handleAudioStatus);
    nativeBridge.on('devices', handleDevices);
    nativeBridge.on('error', handleError);

    return () => {
      nativeBridge.off('connected', handleConnected);
      nativeBridge.off('disconnected', handleDisconnected);
      nativeBridge.off('audioStatus', handleAudioStatus);
      nativeBridge.off('devices', handleDevices);
      nativeBridge.off('error', handleError);
    };
  }, []);

  // Connect to bridge
  const connect = useCallback(async () => {
    const connected = await nativeBridge.connect();
    store.setConnected(connected);
    if (connected) {
      store.setDriverType(nativeBridge.getDriverType());
      nativeBridge.getDevices();
    }
    return connected;
  }, []);

  // Disconnect from bridge
  const disconnect = useCallback(() => {
    nativeBridge.disconnect();
    store.setConnected(false);
    store.setRunning(false);
    store.setDriverType(null);
  }, []);

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
    if (!store.isConnected) return;

    // Configure devices before starting
    if (store.selectedInputDeviceId) {
      nativeBridge.setInputDevice(store.selectedInputDeviceId);
    }
    if (store.selectedOutputDeviceId) {
      nativeBridge.setOutputDevice(store.selectedOutputDeviceId);
    }

    // Configure buffer size and sample rate
    nativeBridge.setBufferSize(store.bufferSize);
    nativeBridge.setSampleRate(store.sampleRate);

    // Configure channel config
    nativeBridge.setChannelConfig(store.inputChannelConfig);

    // Now start audio
    nativeBridge.startAudio();
  }, [store.isConnected, store.selectedInputDeviceId, store.selectedOutputDeviceId, store.bufferSize, store.sampleRate, store.inputChannelConfig]);

  // Stop audio
  const stopAudio = useCallback(() => {
    if (store.isConnected) {
      nativeBridge.stopAudio();
    }
  }, [store.isConnected]);

  // Refresh devices
  const refreshDevices = useCallback(() => {
    if (store.isConnected) {
      nativeBridge.getDevices();
    }
  }, [store.isConnected]);

  // Set input device and send to bridge
  const setInputDevice = useCallback((deviceId: string) => {
    store.setSelectedInputDevice(deviceId);
    if (store.isConnected) {
      nativeBridge.setInputDevice(deviceId);
    }
  }, [store.isConnected]);

  // Set output device and send to bridge
  const setOutputDevice = useCallback((deviceId: string) => {
    store.setSelectedOutputDevice(deviceId);
    if (store.isConnected) {
      nativeBridge.setOutputDevice(deviceId);
    }
  }, [store.isConnected]);

  // Set buffer size
  const setBufferSize = useCallback((size: 32 | 64 | 128 | 256 | 512 | 1024) => {
    store.setBufferSize(size);
    if (store.isConnected) {
      nativeBridge.setBufferSize(size);
    }
  }, [store.isConnected]);

  // Set sample rate
  const setSampleRate = useCallback((rate: 44100 | 48000) => {
    store.setSampleRate(rate);
    if (store.isConnected) {
      nativeBridge.setSampleRate(rate);
    }
  }, [store.isConnected]);

  // Set channel config
  const setChannelConfig = useCallback((config: { channelCount: 1 | 2; leftChannel: number; rightChannel?: number }) => {
    store.setInputChannelConfig(config);
    if (store.isConnected) {
      nativeBridge.setChannelConfig(config);
    }
  }, [store.isConnected]);

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
