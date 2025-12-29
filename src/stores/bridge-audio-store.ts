import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

interface BridgeAudioState {
  // Connection state (not persisted)
  isConnected: boolean;
  isRunning: boolean;
  driverType: string | null;

  // Latency info
  latency: {
    input: number;
    output: number;
    total: number;
  };

  // Available devices from bridge
  inputDevices: BridgeDevice[];
  outputDevices: BridgeDevice[];

  // Selected devices (persisted)
  selectedInputDeviceId: string | null;
  selectedOutputDeviceId: string | null;

  // Channel configuration (persisted)
  inputChannelConfig: {
    channelCount: 1 | 2;
    leftChannel: number;
    rightChannel?: number;
  };
  outputChannelConfig: {
    channelCount: 1 | 2;
    leftChannel: number;
    rightChannel?: number;
  };

  // Buffer and sample rate settings (persisted)
  bufferSize: 32 | 64 | 128 | 256 | 512 | 1024;
  sampleRate: 44100 | 48000;

  // Preference: use native bridge when available (persisted)
  preferNativeBridge: boolean;

  // Error state
  lastError: { code: string; message: string } | null;

  // Actions
  setConnected: (connected: boolean) => void;
  setRunning: (running: boolean) => void;
  setDriverType: (driverType: string | null) => void;
  setLatency: (latency: { input: number; output: number; total: number }) => void;
  setDevices: (inputs: BridgeDevice[], outputs: BridgeDevice[]) => void;
  setSelectedInputDevice: (deviceId: string | null) => void;
  setSelectedOutputDevice: (deviceId: string | null) => void;
  setInputChannelConfig: (config: { channelCount: 1 | 2; leftChannel: number; rightChannel?: number }) => void;
  setOutputChannelConfig: (config: { channelCount: 1 | 2; leftChannel: number; rightChannel?: number }) => void;
  setBufferSize: (size: 32 | 64 | 128 | 256 | 512 | 1024) => void;
  setSampleRate: (rate: 44100 | 48000) => void;
  setPreferNativeBridge: (prefer: boolean) => void;
  setError: (error: { code: string; message: string } | null) => void;
  reset: () => void;

  // Helpers
  getSelectedInputDevice: () => BridgeDevice | undefined;
  getSelectedOutputDevice: () => BridgeDevice | undefined;
}

export const useBridgeAudioStore = create<BridgeAudioState>()(
  persist(
    (set, get) => ({
      // Runtime state (not persisted)
      isConnected: false,
      isRunning: false,
      driverType: null,
      latency: { input: 0, output: 0, total: 0 },
      inputDevices: [],
      outputDevices: [],
      lastError: null,

      // Persisted settings
      selectedInputDeviceId: null,
      selectedOutputDeviceId: null,
      inputChannelConfig: {
        channelCount: 2,
        leftChannel: 0,
        rightChannel: 1,
      },
      outputChannelConfig: {
        channelCount: 2,
        leftChannel: 0,
        rightChannel: 1,
      },
      bufferSize: 256,
      sampleRate: 48000,
      preferNativeBridge: true,

      // Actions
      setConnected: (connected) => set({ isConnected: connected }),
      setRunning: (running) => set({ isRunning: running }),
      setDriverType: (driverType) => set({ driverType }),
      setLatency: (latency) => set({ latency }),

      setDevices: (inputs, outputs) => {
        const state = get();

        // Auto-select default devices if none selected
        let selectedInputDeviceId = state.selectedInputDeviceId;
        let selectedOutputDeviceId = state.selectedOutputDeviceId;

        // If no input selected, try to find default or first available
        if (!selectedInputDeviceId || !inputs.find(d => d.id === selectedInputDeviceId)) {
          const defaultInput = inputs.find(d => d.isDefault) || inputs[0];
          selectedInputDeviceId = defaultInput?.id || null;
        }

        // If no output selected, try to find default or first available
        if (!selectedOutputDeviceId || !outputs.find(d => d.id === selectedOutputDeviceId)) {
          const defaultOutput = outputs.find(d => d.isDefault) || outputs[0];
          selectedOutputDeviceId = defaultOutput?.id || null;
        }

        set({
          inputDevices: inputs,
          outputDevices: outputs,
          selectedInputDeviceId,
          selectedOutputDeviceId,
        });
      },

      setSelectedInputDevice: (deviceId) => set({ selectedInputDeviceId: deviceId }),
      setSelectedOutputDevice: (deviceId) => set({ selectedOutputDeviceId: deviceId }),

      setInputChannelConfig: (config) => set({ inputChannelConfig: config }),
      setOutputChannelConfig: (config) => set({ outputChannelConfig: config }),

      setBufferSize: (size) => set({ bufferSize: size }),
      setSampleRate: (rate) => set({ sampleRate: rate }),
      setPreferNativeBridge: (prefer) => set({ preferNativeBridge: prefer }),

      setError: (error) => set({ lastError: error }),

      reset: () => set({
        isConnected: false,
        isRunning: false,
        driverType: null,
        latency: { input: 0, output: 0, total: 0 },
        inputDevices: [],
        outputDevices: [],
        lastError: null,
      }),

      // Helpers
      getSelectedInputDevice: () => {
        const state = get();
        return state.inputDevices.find(d => d.id === state.selectedInputDeviceId);
      },

      getSelectedOutputDevice: () => {
        const state = get();
        return state.outputDevices.find(d => d.id === state.selectedOutputDeviceId);
      },
    }),
    {
      name: 'bridge-audio-settings',
      // Only persist settings, not runtime state
      partialize: (state) => ({
        selectedInputDeviceId: state.selectedInputDeviceId,
        selectedOutputDeviceId: state.selectedOutputDeviceId,
        inputChannelConfig: state.inputChannelConfig,
        outputChannelConfig: state.outputChannelConfig,
        bufferSize: state.bufferSize,
        sampleRate: state.sampleRate,
        preferNativeBridge: state.preferNativeBridge,
      }),
    }
  )
);
