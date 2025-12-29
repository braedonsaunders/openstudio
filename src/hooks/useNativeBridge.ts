'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  nativeBridge,
  isNativeBridgeAvailable,
  launchNativeBridge,
  getNativeBridgeDownloadUrl,
} from '@/lib/audio/native-bridge';

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

interface NativeBridgeState {
  // Connection
  isAvailable: boolean | null; // null = checking
  isConnected: boolean;
  driverType: string | null;

  // Audio status
  isRunning: boolean;
  latency: {
    input: number;
    output: number;
    total: number;
  };

  // Levels
  levels: {
    input: number;
    inputPeak: number;
    output: number;
    outputPeak: number;
  };

  // Devices
  inputDevices: BridgeDevice[];
  outputDevices: BridgeDevice[];
}

export function useNativeBridge() {
  const [state, setState] = useState<NativeBridgeState>({
    isAvailable: null,
    isConnected: false,
    driverType: null,
    isRunning: false,
    latency: { input: 0, output: 0, total: 0 },
    levels: { input: 0, inputPeak: 0, output: 0, outputPeak: 0 },
    inputDevices: [],
    outputDevices: [],
  });

  // Check availability on mount
  useEffect(() => {
    let mounted = true;

    const checkAvailability = async () => {
      const available = await isNativeBridgeAvailable();
      if (mounted) {
        setState((prev) => ({
          ...prev,
          isAvailable: available,
          isConnected: available,
          driverType: available ? nativeBridge.getDriverType() : null,
        }));
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
      setState((prev) => ({
        ...prev,
        isConnected: true,
        driverType: data.driverType,
      }));
      // Request devices when connected
      nativeBridge.getDevices();
    };

    const handleDisconnected = () => {
      setState((prev) => ({
        ...prev,
        isConnected: false,
        isRunning: false,
        driverType: null,
        inputDevices: [],
        outputDevices: [],
      }));
    };

    const handleAudioStatus = (data: {
      isRunning: boolean;
      inputLatencyMs: number;
      outputLatencyMs: number;
      totalLatencyMs: number;
    }) => {
      setState((prev) => ({
        ...prev,
        isRunning: data.isRunning,
        latency: {
          input: data.inputLatencyMs,
          output: data.outputLatencyMs,
          total: data.totalLatencyMs,
        },
      }));
    };

    const handleLevels = (data: {
      inputLevel: number;
      inputPeak: number;
      outputLevel: number;
      outputPeak: number;
    }) => {
      setState((prev) => ({
        ...prev,
        levels: {
          input: data.inputLevel,
          inputPeak: data.inputPeak,
          output: data.outputLevel,
          outputPeak: data.outputPeak,
        },
      }));
    };

    const handleDevices = (data: { inputs: BridgeDevice[]; outputs: BridgeDevice[] }) => {
      setState((prev) => ({
        ...prev,
        inputDevices: data.inputs,
        outputDevices: data.outputs,
      }));
    };

    nativeBridge.on('connected', handleConnected);
    nativeBridge.on('disconnected', handleDisconnected);
    nativeBridge.on('audioStatus', handleAudioStatus);
    nativeBridge.on('levels', handleLevels);
    nativeBridge.on('devices', handleDevices);

    return () => {
      nativeBridge.off('connected', handleConnected);
      nativeBridge.off('disconnected', handleDisconnected);
      nativeBridge.off('audioStatus', handleAudioStatus);
      nativeBridge.off('levels', handleLevels);
      nativeBridge.off('devices', handleDevices);
    };
  }, []);

  // Connect to bridge
  const connect = useCallback(async () => {
    const connected = await nativeBridge.connect();
    setState((prev) => ({
      ...prev,
      isConnected: connected,
      driverType: connected ? nativeBridge.getDriverType() : null,
    }));
    return connected;
  }, []);

  // Disconnect from bridge
  const disconnect = useCallback(() => {
    nativeBridge.disconnect();
    setState((prev) => ({
      ...prev,
      isConnected: false,
      isRunning: false,
    }));
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

  // Start audio
  const startAudio = useCallback(() => {
    if (state.isConnected) {
      nativeBridge.startAudio();
    }
  }, [state.isConnected]);

  // Stop audio
  const stopAudio = useCallback(() => {
    if (state.isConnected) {
      nativeBridge.stopAudio();
    }
  }, [state.isConnected]);

  // Refresh devices
  const refreshDevices = useCallback(() => {
    if (state.isConnected) {
      nativeBridge.getDevices();
    }
  }, [state.isConnected]);

  // Set input device
  const setInputDevice = useCallback((deviceId: string) => {
    if (state.isConnected) {
      nativeBridge.setInputDevice(deviceId);
    }
  }, [state.isConnected]);

  // Set output device
  const setOutputDevice = useCallback((deviceId: string) => {
    if (state.isConnected) {
      nativeBridge.setOutputDevice(deviceId);
    }
  }, [state.isConnected]);

  return {
    ...state,
    bridge: nativeBridge,
    connect,
    disconnect,
    launch,
    getDownloadUrl,
    startAudio,
    stopAudio,
    refreshDevices,
    setInputDevice,
    setOutputDevice,
  };
}
