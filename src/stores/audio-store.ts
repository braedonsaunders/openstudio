import { create } from 'zustand';
import type { JitterStats, WebRTCStats, RoomSettings, AudioPerformanceMetrics, TrackPerformanceMetrics } from '@/types';

interface AudioState {
  // Settings
  settings: RoomSettings;
  inputDeviceId: string | null;
  outputDeviceId: string | null;

  // Status
  isInitialized: boolean;
  isCapturing: boolean;
  isMuted: boolean;
  masterVolume: number;
  backingTrackVolume: number;

  // Monitoring
  localLevel: number;
  jitterStats: JitterStats;
  webrtcStats: WebRTCStats | null;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
  currentBufferSize: number;

  // Performance metrics
  performanceMetrics: AudioPerformanceMetrics;

  // Playback
  isPlaying: boolean;
  currentTime: number;
  duration: number;

  // Audio context and analyser nodes (shared globally for analysis)
  audioContext: AudioContext | null;
  backingTrackAnalyser: AnalyserNode | null;
  masterAnalyser: AnalyserNode | null;

  // Available devices
  inputDevices: MediaDeviceInfo[];
  outputDevices: MediaDeviceInfo[];

  // Actions
  setSettings: (settings: Partial<RoomSettings>) => void;
  setInputDevice: (deviceId: string) => void;
  setOutputDevice: (deviceId: string) => void;
  setInitialized: (initialized: boolean) => void;
  setCapturing: (capturing: boolean) => void;
  setMuted: (muted: boolean) => void;
  setMasterVolume: (volume: number) => void;
  setBackingTrackVolume: (volume: number) => void;
  setLocalLevel: (level: number) => void;
  setJitterStats: (stats: JitterStats) => void;
  setWebRTCStats: (stats: WebRTCStats) => void;
  setConnectionQuality: (quality: 'excellent' | 'good' | 'fair' | 'poor') => void;
  setCurrentBufferSize: (size: number) => void;
  setPerformanceMetrics: (metrics: Partial<AudioPerformanceMetrics>) => void;
  updateTrackMetrics: (trackId: string, metrics: TrackPerformanceMetrics) => void;
  setPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setAudioContext: (context: AudioContext | null) => void;
  setBackingTrackAnalyser: (analyser: AnalyserNode | null) => void;
  setMasterAnalyser: (analyser: AnalyserNode | null) => void;
  setInputDevices: (devices: MediaDeviceInfo[]) => void;
  setOutputDevices: (devices: MediaDeviceInfo[]) => void;
  reset: () => void;
}

const defaultSettings: RoomSettings = {
  sampleRate: 48000,
  bitDepth: 24,
  bufferSize: 256,
  autoJitterBuffer: true,
  backingTrackVolume: 0.7,
  masterVolume: 1,
};

const initialJitterStats: JitterStats = {
  averageJitter: 0,
  maxJitter: 0,
  packetLoss: 0,
  roundTripTime: 0,
  recommendedBuffer: 256,
};

const initialPerformanceMetrics: AudioPerformanceMetrics = {
  audioContextLatency: 0,
  jsProcessingTime: 0,
  effectsProcessingTime: 0,
  totalLatency: 0,
  currentBufferSize: 256,
  underruns: 0,
  trackMetrics: new Map(),
  lastUpdate: 0,
};

export const useAudioStore = create<AudioState>((set, get) => ({
  settings: defaultSettings,
  inputDeviceId: null,
  outputDeviceId: null,
  isInitialized: false,
  isCapturing: false,
  isMuted: false,
  masterVolume: 1,
  backingTrackVolume: 0.7,
  localLevel: 0,
  jitterStats: initialJitterStats,
  webrtcStats: null,
  connectionQuality: 'good',
  currentBufferSize: 256,
  performanceMetrics: initialPerformanceMetrics,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  audioContext: null,
  backingTrackAnalyser: null,
  masterAnalyser: null,
  inputDevices: [],
  outputDevices: [],

  setSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),

  setInputDevice: (deviceId) => set({ inputDeviceId: deviceId }),
  setOutputDevice: (deviceId) => set({ outputDeviceId: deviceId }),
  setInitialized: (initialized) => set({ isInitialized: initialized }),
  setCapturing: (capturing) => set({ isCapturing: capturing }),
  setMuted: (muted) => set({ isMuted: muted }),
  setMasterVolume: (volume) => set({ masterVolume: volume }),
  setBackingTrackVolume: (volume) => set({ backingTrackVolume: volume }),
  setLocalLevel: (level) => set({ localLevel: level }),
  setJitterStats: (stats) => set({ jitterStats: stats }),
  setWebRTCStats: (stats) => set({ webrtcStats: stats }),
  setConnectionQuality: (quality) => set({ connectionQuality: quality }),
  setCurrentBufferSize: (size) => set({ currentBufferSize: size }),
  setPerformanceMetrics: (metrics) =>
    set((state) => ({
      performanceMetrics: {
        ...state.performanceMetrics,
        ...metrics,
        lastUpdate: Date.now(),
      },
    })),
  updateTrackMetrics: (trackId, metrics) =>
    set((state) => {
      const newTrackMetrics = new Map(state.performanceMetrics.trackMetrics);
      newTrackMetrics.set(trackId, metrics);
      return {
        performanceMetrics: {
          ...state.performanceMetrics,
          trackMetrics: newTrackMetrics,
          lastUpdate: Date.now(),
        },
      };
    }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration: duration }),
  setAudioContext: (context) => set({ audioContext: context }),
  setBackingTrackAnalyser: (analyser) => set({ backingTrackAnalyser: analyser }),
  setMasterAnalyser: (analyser) => set({ masterAnalyser: analyser }),
  setInputDevices: (devices) => set({ inputDevices: devices }),
  setOutputDevices: (devices) => set({ outputDevices: devices }),

  reset: () =>
    set({
      settings: defaultSettings,
      inputDeviceId: null,
      outputDeviceId: null,
      isInitialized: false,
      isCapturing: false,
      isMuted: false,
      masterVolume: 1,
      backingTrackVolume: 0.7,
      localLevel: 0,
      jitterStats: initialJitterStats,
      webrtcStats: null,
      connectionQuality: 'good',
      currentBufferSize: 256,
      performanceMetrics: initialPerformanceMetrics,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      audioContext: null,
      backingTrackAnalyser: null,
      masterAnalyser: null,
    }),
}));
