// Essentia.js Audio Analyzer
// Real-time audio analysis using essentia.js

import type { AnalysisData } from '@/stores/analysis-store';

// Note: essentia.js provides these algorithms
// We'll use the WASM version for better performance

interface EssentiaAnalysis {
  key: { key: string; scale: string; strength: number };
  bpm: { bpm: number; confidence: number };
  chords: { chord: string; confidence: number };
  spectral: {
    centroid: number;
    rolloff: number;
    flux: number;
  };
  loudness: { rms: number; loudness: number };
  pitch: { frequency: number; confidence: number };
}

// Frequency to note mapping
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function frequencyToNote(frequency: number): { note: string; cents: number } | null {
  if (frequency <= 0) return null;

  // A4 = 440 Hz
  const A4 = 440;
  const semitonesFromA4 = 12 * Math.log2(frequency / A4);
  const roundedSemitones = Math.round(semitonesFromA4);
  const cents = Math.round((semitonesFromA4 - roundedSemitones) * 100);

  // A4 is index 9 (A) in octave 4
  const noteIndex = ((roundedSemitones % 12) + 12 + 9) % 12;
  const octave = 4 + Math.floor((roundedSemitones + 9) / 12);

  return {
    note: `${NOTE_NAMES[noteIndex]}${octave}`,
    cents,
  };
}

export class EssentiaAnalyzer {
  private essentia: any = null;
  private essentiaWASM: any = null;
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | AudioBufferSourceNode | MediaElementAudioSourceNode | null = null;
  private scriptProcessorNode: ScriptProcessorNode | null = null;
  private onAnalysis: ((data: AnalysisData) => void) | null = null;
  private isInitialized = false;
  private isAnalyzing = false;
  private sampleRate = 44100;
  private frameSize = 2048;
  private hopSize = 1024;
  private lastBPM: number | null = null;
  private lastKey: string | null = null;
  private lastKeyScale: 'major' | 'minor' | null = null;
  private bpmBuffer: number[] = [];
  private keyBuffer: { key: string; scale: string }[] = [];
  private initializationPromise: Promise<void> | null = null;
  private loadingInBackground = false;

  async initialize(sampleRate: number = 44100): Promise<void> {
    if (this.isInitialized) return;

    // If already loading, wait for that to complete
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.sampleRate = sampleRate;

    // Start loading in background without blocking
    this.initializationPromise = this.loadInBackground();

    // Don't await - let it load in background
    return;
  }

  // Starts background loading - called once and runs async
  startBackgroundLoading(): void {
    if (this.isInitialized || this.loadingInBackground) return;

    this.loadingInBackground = true;
    this.loadInBackground().catch((error) => {
      console.warn('Background essentia.js loading failed:', error);
    });
  }

  private async loadInBackground(): Promise<void> {
    try {
      // Only run in browser environment
      if (typeof window === 'undefined') {
        console.warn('Essentia.js can only run in browser');
        return;
      }

      // Load essentia.js from CDN
      const { EssentiaWASM, Essentia } = await this.loadEssentiaFromCDN();

      if (!EssentiaWASM || !Essentia) {
        throw new Error('Failed to load essentia.js from CDN');
      }

      // Initialize WASM module - EssentiaWASM returns the module directly
      // Check if it's a function (factory) or already the module
      if (typeof EssentiaWASM === 'function') {
        this.essentiaWASM = await EssentiaWASM();
      } else {
        this.essentiaWASM = EssentiaWASM;
      }

      // Create Essentia instance
      if (typeof Essentia === 'function') {
        this.essentia = new Essentia(this.essentiaWASM);
      } else {
        this.essentia = Essentia;
      }

      this.isInitialized = true;
      this.loadingInBackground = false;
      console.log('Essentia.js initialized successfully (background)');
    } catch (error) {
      console.warn('Essentia.js initialization failed (analysis will be disabled):', error);
      this.isInitialized = false;
      this.loadingInBackground = false;
    }
  }

  private async loadEssentiaFromCDN(): Promise<{ EssentiaWASM: any; Essentia: any }> {
    try {
      // Import WASM loader and core library as ES modules from CDN
      const wasmModule = await import(
        /* webpackIgnore: true */
        // @ts-ignore - CDN URL import
        'https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm.es.js'
      );
      const coreModule = await import(
        /* webpackIgnore: true */
        // @ts-ignore - CDN URL import
        'https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia.js-core.es.js'
      );

      // Debug: log what we got to understand the module structure
      console.log('WASM module exports:', Object.keys(wasmModule));
      console.log('Core module exports:', Object.keys(coreModule));

      // Try different export patterns
      const EssentiaWASM = wasmModule.default ?? wasmModule.EssentiaWASM ?? wasmModule;
      const Essentia = coreModule.default ?? coreModule.Essentia ?? coreModule;

      return { EssentiaWASM, Essentia };
    } catch (error) {
      console.error('Failed to load essentia.js ES modules:', error);
      throw error;
    }
  }

  setOnAnalysis(callback: (data: AnalysisData) => void): void {
    this.onAnalysis = callback;
  }

  // Returns true if essentia is properly initialized and ready for analysis
  isReady(): boolean {
    return this.isInitialized && this.essentia !== null;
  }

  async connectToAudioContext(audioContext: AudioContext): Promise<void> {
    this.audioContext = audioContext;
    this.sampleRate = audioContext.sampleRate;

    // Create analyser for visualization
    this.analyserNode = audioContext.createAnalyser();
    this.analyserNode.fftSize = this.frameSize;
    this.analyserNode.smoothingTimeConstant = 0.8;
  }

  async analyzeStream(stream: MediaStream): Promise<void> {
    if (!this.audioContext) {
      console.warn('Cannot analyze stream: no audio context');
      return;
    }
    if (!this.isInitialized) {
      console.warn('Cannot analyze stream: essentia.js not initialized');
      return;
    }

    this.stopAnalysis();

    // Create source from stream
    this.sourceNode = this.audioContext.createMediaStreamSource(stream);
    this.startAnalysis();
  }

  async analyzeElement(element: HTMLAudioElement | HTMLVideoElement): Promise<void> {
    if (!this.audioContext) {
      console.warn('Cannot analyze element: no audio context');
      return;
    }
    if (!this.isInitialized) {
      console.warn('Cannot analyze element: essentia.js not initialized');
      return;
    }

    this.stopAnalysis();

    // Create source from media element
    this.sourceNode = this.audioContext.createMediaElementSource(element);
    this.sourceNode.connect(this.audioContext.destination); // Still play through speakers
    this.startAnalysis();
  }

  /**
   * Analyze audio from an existing AnalyserNode (e.g., from the audio engine).
   * This is used to analyze whatever audio is flowing through the audio engine
   * without creating new connections.
   */
  analyzeFromAnalyserNode(analyserNode: AnalyserNode): void {
    if (!this.audioContext) {
      console.warn('Cannot analyze from node: no audio context');
      return;
    }
    if (!this.isInitialized) {
      console.warn('Cannot analyze from node: essentia.js not initialized');
      return;
    }

    this.stopAnalysis();

    // Use the provided analyser node directly
    this.analyserNode = analyserNode;

    // Start analysis loop using the external analyser
    this.startAnalysisFromExternalNode();
  }

  /**
   * Start analysis loop reading from an external AnalyserNode.
   * Uses requestAnimationFrame instead of ScriptProcessor since we're
   * not intercepting audio, just reading from the analyser.
   */
  private analysisAnimationFrame: number | null = null;
  private audioFrameBuffer: Float32Array[] = [];

  private startAnalysisFromExternalNode(): void {
    if (!this.audioContext || !this.analyserNode || !this.essentia) return;

    this.isAnalyzing = true;
    this.audioFrameBuffer = [];

    const frameSize = this.analyserNode.fftSize;
    const framesForKey = 20; // ~2 seconds of audio for key detection
    const framesForBPM = 50; // ~5 seconds for BPM

    const analyze = () => {
      if (!this.isAnalyzing || !this.analyserNode || !this.essentia) return;

      // Get time domain data from the analyser
      const timeDomainData = new Float32Array(frameSize);
      this.analyserNode.getFloatTimeDomainData(timeDomainData);

      // Check if there's actual audio (not just silence)
      const maxAmplitude = Math.max(...timeDomainData.map(Math.abs));
      if (maxAmplitude < 0.001) {
        // Audio is silent, skip analysis but keep loop running
        this.analysisAnimationFrame = requestAnimationFrame(analyze);
        return;
      }

      // Add to buffer for long-term analysis
      this.audioFrameBuffer.push(timeDomainData.slice());
      if (this.audioFrameBuffer.length > framesForBPM) {
        this.audioFrameBuffer.shift();
      }

      // Real-time analysis on current frame
      const analysisResult = this.analyzeFrame(timeDomainData);

      // Longer-term analysis for BPM and key
      if (this.audioFrameBuffer.length >= framesForKey) {
        // Combine frames for key/BPM analysis
        const combinedLength = this.audioFrameBuffer.length * frameSize;
        const combinedAudio = new Float32Array(combinedLength);
        this.audioFrameBuffer.forEach((buf, i) => {
          combinedAudio.set(buf, i * frameSize);
        });

        this.analyzeLongTerm(combinedAudio, analysisResult);
      }

      if (this.onAnalysis && analysisResult) {
        this.onAnalysis(analysisResult);
      }

      // Continue analysis loop (throttled to ~30fps to reduce CPU)
      setTimeout(() => {
        this.analysisAnimationFrame = requestAnimationFrame(analyze);
      }, 33);
    };

    // Start the analysis loop
    this.analysisAnimationFrame = requestAnimationFrame(analyze);
    console.log('Started audio analysis from external analyser node');
  }

  private startAnalysis(): void {
    if (!this.audioContext || !this.sourceNode || !this.analyserNode) return;

    // Connect source to analyser
    this.sourceNode.connect(this.analyserNode);

    // Create script processor for real-time analysis
    // Note: ScriptProcessorNode is deprecated but AudioWorklet requires more setup
    // For MVP, we'll use ScriptProcessor with a fallback plan
    this.scriptProcessorNode = this.audioContext.createScriptProcessor(this.frameSize, 1, 1);

    // Buffer for collecting frames for longer analysis
    let audioBuffer: Float32Array[] = [];
    const framesForBPM = 50; // Collect ~5 seconds of audio for BPM
    const framesForKey = 20; // Collect ~2 seconds for key

    this.scriptProcessorNode.onaudioprocess = (event) => {
      if (!this.isAnalyzing || !this.essentia) return;

      const inputData = event.inputBuffer.getChannelData(0);
      const frame = new Float32Array(inputData);

      // Add to buffer for long-term analysis
      audioBuffer.push(frame.slice());
      if (audioBuffer.length > framesForBPM) {
        audioBuffer.shift();
      }

      // Real-time analysis on current frame
      const analysisResult = this.analyzeFrame(frame);

      // Longer-term analysis for BPM and key
      if (audioBuffer.length >= framesForKey) {
        // Combine frames for key analysis
        const combinedLength = audioBuffer.length * this.frameSize;
        const combinedAudio = new Float32Array(combinedLength);
        audioBuffer.forEach((buf, i) => {
          combinedAudio.set(buf, i * this.frameSize);
        });

        // Analyze key and BPM on combined audio
        this.analyzeLongTerm(combinedAudio, analysisResult);
      }

      if (this.onAnalysis && analysisResult) {
        this.onAnalysis(analysisResult);
      }
    };

    this.analyserNode.connect(this.scriptProcessorNode);
    this.scriptProcessorNode.connect(this.audioContext.destination);
    this.isAnalyzing = true;
  }

  private analyzeFrame(frame: Float32Array): AnalysisData {
    const essentiaFrame = this.essentia.arrayToVector(frame);

    // RMS and loudness
    const rms = this.essentia.RMS(essentiaFrame).rms;

    // Spectral features
    const spectrum = this.essentia.Spectrum(essentiaFrame, this.frameSize);
    const spectralCentroid = this.essentia.SpectralCentroidTime(essentiaFrame).spectralCentroid || 0;

    // Pitch detection for tuner
    let tunerNote: string | null = null;
    let tunerFrequency: number | null = null;
    let tunerCents: number | null = null;

    try {
      const pitchResult = this.essentia.PitchYinFFT(essentiaFrame, this.frameSize, this.sampleRate);
      if (pitchResult.pitch > 50 && pitchResult.pitch < 2000 && pitchResult.pitchConfidence > 0.7) {
        tunerFrequency = pitchResult.pitch;
        const noteInfo = frequencyToNote(pitchResult.pitch);
        if (noteInfo) {
          tunerNote = noteInfo.note;
          tunerCents = noteInfo.cents;
        }
      }
    } catch (e) {
      // Pitch detection can fail on quiet/noisy signals
    }

    // Simple chord detection using HPCP
    let currentChord: string | null = null;
    let chordConfidence = 0;

    try {
      const hpcp = this.essentia.HPCP(
        spectrum.spectrum,
        this.essentia.arrayToVector(new Float32Array(spectrum.spectrum.length)),
        true, 500, 0, 4000, false, 0.5, true, this.sampleRate
      );

      // Simple chord detection based on HPCP profile
      const hpcpArray = this.essentia.vectorToArray(hpcp.hpcp);
      const chordResult = this.detectChordFromHPCP(hpcpArray);
      currentChord = chordResult.chord;
      chordConfidence = chordResult.confidence;
    } catch (e) {
      // HPCP can fail
    }

    return {
      key: this.lastKey,
      keyScale: this.lastKeyScale,
      keyConfidence: 0.8,
      bpm: this.lastBPM,
      bpmConfidence: 0.8,
      currentChord,
      chordConfidence,
      spectralCentroid,
      spectralRolloff: 0,
      spectralFlux: 0,
      rms,
      loudness: rms * 100,
      tunerNote,
      tunerFrequency,
      tunerCents,
      timestamp: Date.now(),
    };
  }

  private analyzeLongTerm(audio: Float32Array, result: AnalysisData): void {
    const essentiaAudio = this.essentia.arrayToVector(audio);

    // Key detection
    try {
      const keyResult = this.essentia.KeyExtractor(
        essentiaAudio,
        true, 4096, 4096, 12, 3500, 60, 500, 'bgate', this.sampleRate
      );

      // Smooth key changes - only update if consistent
      this.keyBuffer.push({ key: keyResult.key, scale: keyResult.scale });
      if (this.keyBuffer.length > 5) {
        this.keyBuffer.shift();
      }

      // Find most common key in buffer
      const keyCount = new Map<string, number>();
      this.keyBuffer.forEach(({ key, scale }) => {
        const keyStr = `${key}_${scale}`;
        keyCount.set(keyStr, (keyCount.get(keyStr) || 0) + 1);
      });

      let maxCount = 0;
      let dominantKey = '';
      keyCount.forEach((count, key) => {
        if (count > maxCount) {
          maxCount = count;
          dominantKey = key;
        }
      });

      if (maxCount >= 3) {
        const [key, scale] = dominantKey.split('_');
        this.lastKey = key;
        this.lastKeyScale = scale as 'major' | 'minor';
        result.key = key;
        result.keyScale = this.lastKeyScale;
        result.keyConfidence = keyResult.strength;
      }
    } catch (e) {
      // Key detection can fail
    }

    // BPM detection
    try {
      const rhythmResult = this.essentia.RhythmExtractor2013(essentiaAudio);

      // Smooth BPM changes
      if (rhythmResult.bpm > 40 && rhythmResult.bpm < 240) {
        this.bpmBuffer.push(rhythmResult.bpm);
        if (this.bpmBuffer.length > 5) {
          this.bpmBuffer.shift();
        }

        // Use median BPM to smooth outliers
        const sortedBPM = [...this.bpmBuffer].sort((a, b) => a - b);
        const medianBPM = sortedBPM[Math.floor(sortedBPM.length / 2)];

        // Only update if within reasonable range of current
        if (!this.lastBPM || Math.abs(medianBPM - this.lastBPM) < 10) {
          this.lastBPM = Math.round(medianBPM);
          result.bpm = this.lastBPM;
          result.bpmConfidence = rhythmResult.confidence || 0.8;
        }
      }
    } catch (e) {
      // Rhythm detection can fail
    }
  }

  private detectChordFromHPCP(hpcp: number[]): { chord: string | null; confidence: number } {
    if (!hpcp || hpcp.length !== 12) {
      return { chord: null, confidence: 0 };
    }

    // Simple chord templates (root, 3rd, 5th positions)
    const chordTemplates: { [key: string]: number[] } = {
      'C': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
      'Cm': [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
      'D': [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
      'Dm': [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0],
      'E': [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
      'Em': [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
      'F': [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
      'Fm': [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
      'G': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
      'Gm': [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      'A': [0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
      'Am': [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
      'B': [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1],
      'Bm': [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    };

    let bestChord = '';
    let bestScore = -1;

    // Normalize HPCP
    const maxHPCP = Math.max(...hpcp);
    const normHPCP = maxHPCP > 0 ? hpcp.map(v => v / maxHPCP) : hpcp;

    for (const [chord, template] of Object.entries(chordTemplates)) {
      let score = 0;
      for (let i = 0; i < 12; i++) {
        score += normHPCP[i] * template[i];
      }
      if (score > bestScore) {
        bestScore = score;
        bestChord = chord;
      }
    }

    return {
      chord: bestScore > 0.5 ? bestChord : null,
      confidence: bestScore,
    };
  }

  getSpectrumData(): Float32Array | null {
    if (!this.analyserNode) return null;

    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    this.analyserNode.getFloatFrequencyData(dataArray);
    return dataArray;
  }

  getWaveformData(): Float32Array | null {
    if (!this.analyserNode) return null;

    const bufferLength = this.analyserNode.fftSize;
    const dataArray = new Float32Array(bufferLength);
    this.analyserNode.getFloatTimeDomainData(dataArray);
    return dataArray;
  }

  stopAnalysis(): void {
    this.isAnalyzing = false;

    if (this.analysisAnimationFrame) {
      cancelAnimationFrame(this.analysisAnimationFrame);
      this.analysisAnimationFrame = null;
    }

    if (this.scriptProcessorNode) {
      this.scriptProcessorNode.disconnect();
      this.scriptProcessorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    // Reset buffers
    this.bpmBuffer = [];
    this.keyBuffer = [];
    this.audioFrameBuffer = [];
  }

  dispose(): void {
    this.stopAnalysis();

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    this.audioContext = null;
    this.essentia = null;
    this.essentiaWASM = null;
    this.isInitialized = false;
    this.lastBPM = null;
    this.lastKey = null;
    this.lastKeyScale = null;
  }
}

// Singleton instance
let analyzerInstance: EssentiaAnalyzer | null = null;

export function getEssentiaAnalyzer(): EssentiaAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new EssentiaAnalyzer();
  }
  return analyzerInstance;
}
