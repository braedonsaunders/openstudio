// Type declarations for essentia.js

declare module 'essentia.js' {
  export class Essentia {
    constructor(wasmModule: any);

    // Utility methods
    arrayToVector(array: Float32Array): any;
    vectorToArray(vector: any): number[];

    // Analysis algorithms
    RMS(signal: any): { rms: number };

    Spectrum(
      signal: any,
      size?: number
    ): {
      spectrum: any;
    };

    SpectralCentroidTime(signal: any): {
      spectralCentroid: number;
    };

    HPCP(
      spectrum: any,
      freqs: any,
      harmonics?: boolean,
      bandPreset?: number,
      bandSplitFrequency?: number,
      maxFrequency?: number,
      maxShifted?: boolean,
      minFrequency?: number,
      nonLinear?: boolean,
      normalized?: string,
      referenceFrequency?: number,
      sampleRate?: number,
      size?: number,
      weightType?: string,
      windowSize?: number
    ): {
      hpcp: any;
    };

    PitchYinFFT(
      signal: any,
      frameSize?: number,
      sampleRate?: number,
      interpolate?: boolean,
      maxFrequency?: number,
      minFrequency?: number,
      tolerance?: number
    ): {
      pitch: number;
      pitchConfidence: number;
    };

    KeyExtractor(
      audio: any,
      averageDetuningCorrection?: boolean,
      frameSize?: number,
      hopSize?: number,
      hpcpSize?: number,
      maxFrequency?: number,
      minFrequency?: number,
      pcpThreshold?: number,
      profileType?: string,
      sampleRate?: number,
      spectralPeaksThreshold?: number,
      tuningFrequency?: number,
      weightType?: string,
      windowType?: string
    ): {
      key: string;
      scale: string;
      strength: number;
    };

    RhythmExtractor2013(
      signal: any,
      maxTempo?: number,
      method?: string,
      minTempo?: number
    ): {
      bpm: number;
      ticks: any;
      confidence: number;
      estimates: any;
      bpmIntervals: any;
    };

    OnsetDetection(
      signal: any,
      method?: string,
      sampleRate?: number
    ): {
      onsetDetection: number;
    };

    Windowing(
      signal: any,
      normalized?: boolean,
      size?: number,
      type?: string,
      zeroPadding?: number,
      zeroPhase?: boolean
    ): {
      frame: any;
    };

    FFT(signal: any, size?: number): {
      fft: any;
    };

    Loudness(signal: any): {
      loudness: number;
    };

    DynamicComplexity(signal: any, frameSize?: number, sampleRate?: number): {
      dynamicComplexity: number;
      loudness: number;
    };
  }

  export function EssentiaWASM(): Promise<any>;
}
