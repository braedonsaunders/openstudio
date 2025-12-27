import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export interface AnalysisData {
  // Key detection
  key: string | null;
  keyScale: 'major' | 'minor' | null;
  keyConfidence: number;

  // BPM detection
  bpm: number | null;
  bpmConfidence: number;

  // Chord detection
  currentChord: string | null;
  chordConfidence: number;

  // Spectral features
  spectralCentroid: number;
  spectralRolloff: number;
  spectralFlux: number;

  // Energy/loudness
  rms: number;
  loudness: number;
  energy: number;

  // Danceability (rhythm regularity)
  danceability: number;

  // Tuner
  tunerNote: string | null;
  tunerFrequency: number | null;
  tunerCents: number | null;

  // Timestamp
  timestamp: number;
}

export interface SyncedAnalysis {
  key: string | null;
  keyScale: 'major' | 'minor' | null;
  bpm: number | null;
  updatedBy: string;
  updatedAt: number;
}

interface AnalysisState {
  // Local analysis data (real-time)
  localAnalysis: AnalysisData | null;

  // Synced analysis (shared across users)
  syncedAnalysis: SyncedAnalysis | null;

  // Analysis source
  analysisSource: 'backing' | 'local' | 'mixed';

  // Worker status
  isAnalyzing: boolean;
  isWorkerReady: boolean;
  analysisError: string | null;

  // Backing track availability (for YouTube with audio element)
  backingTrackAvailable: boolean;

  // Visualization data
  spectrumData: Float32Array | null;
  waveformData: Float32Array | null;

  // Tuner mode
  tunerEnabled: boolean;

  // Actions
  setLocalAnalysis: (data: AnalysisData) => void;
  setSyncedAnalysis: (data: SyncedAnalysis) => void;
  setAnalysisSource: (source: 'backing' | 'local' | 'mixed') => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setWorkerReady: (ready: boolean) => void;
  setAnalysisError: (error: string | null) => void;
  setBackingTrackAvailable: (available: boolean) => void;
  setSpectrumData: (data: Float32Array | null) => void;
  setWaveformData: (data: Float32Array | null) => void;
  setTunerEnabled: (enabled: boolean) => void;
  reset: () => void;
}

const initialAnalysis: AnalysisData = {
  key: null,
  keyScale: null,
  keyConfidence: 0,
  bpm: null,
  bpmConfidence: 0,
  currentChord: null,
  chordConfidence: 0,
  spectralCentroid: 0,
  spectralRolloff: 0,
  spectralFlux: 0,
  rms: 0,
  loudness: 0,
  energy: 0,
  danceability: 0,
  tunerNote: null,
  tunerFrequency: null,
  tunerCents: null,
  timestamp: 0,
};

export const useAnalysisStore = create<AnalysisState>()(
  subscribeWithSelector((set) => ({
    localAnalysis: null,
    syncedAnalysis: null,
    analysisSource: 'backing',
    isAnalyzing: false,
    isWorkerReady: false,
    analysisError: null,
    backingTrackAvailable: false,
    spectrumData: null,
    waveformData: null,
    tunerEnabled: false,

    setLocalAnalysis: (data) => set({ localAnalysis: data }),

    setSyncedAnalysis: (data) => set({ syncedAnalysis: data }),

    setAnalysisSource: (source) => set({ analysisSource: source }),

    setIsAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),

    setWorkerReady: (ready) => set({ isWorkerReady: ready }),

    setAnalysisError: (error) => set({ analysisError: error }),

    setBackingTrackAvailable: (available) => set({ backingTrackAvailable: available }),

    setSpectrumData: (data) => set({ spectrumData: data }),

    setWaveformData: (data) => set({ waveformData: data }),

    setTunerEnabled: (enabled) => set({ tunerEnabled: enabled }),

    reset: () =>
      set({
        localAnalysis: null,
        syncedAnalysis: null,
        analysisSource: 'backing',
        isAnalyzing: false,
        isWorkerReady: false,
        analysisError: null,
        backingTrackAvailable: false,
        spectrumData: null,
        waveformData: null,
        tunerEnabled: false,
      }),
  }))
);
