// Essentia.js Audio Analyzer
// Real-time audio analysis using essentia.js in a Web Worker for performance

import type { AnalysisData } from '@/stores/analysis-store';

export class EssentiaAnalyzer {
  private worker: Worker | null = null;
  private audioContext: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private onAnalysis: ((data: AnalysisData) => void) | null = null;
  private isInitialized = false;
  private isAnalyzing = false;
  private sampleRate = 44100;
  private frameSize = 2048;
  private analysisInterval: number | null = null;
  private initializationPromise: Promise<void> | null = null;

  // Idle detection to prevent memory leaks during extended silence
  private consecutiveSilentFrames = 0;
  private static readonly IDLE_THRESHOLD_FRAMES = 300; // 30 seconds at 100ms intervals
  private isIdle = false;

  // Track disposal state to prevent sending messages during cleanup
  private isDisposing = false;

  async initialize(sampleRate: number = 44100): Promise<void> {
    if (this.isInitialized) return;

    // If already loading, wait for that to complete
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.sampleRate = sampleRate;
    this.initializationPromise = this.initWorker();
    return this.initializationPromise;
  }

  private async initWorker(): Promise<void> {
    if (typeof window === 'undefined') {
      console.warn('Essentia.js can only run in browser');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.worker = new Worker('/audio/analysis-worker.js', { type: 'module' });

        this.worker.onmessage = (e) => {
          const { type, data, success } = e.data;

          switch (type) {
            case 'initialized':
              if (success) {
                this.isInitialized = true;
                console.log('Essentia.js initialized successfully (background)');
                resolve();
              } else {
                console.warn('Essentia.js initialization failed');
                reject(new Error('Worker initialization failed'));
              }
              break;

            case 'result':
              if (data && this.onAnalysis) {
                this.onAnalysis(data);
              }
              break;
          }
        };

        this.worker.onerror = (error) => {
          console.error('Worker error:', error);
          reject(error);
        };

        // Initialize the worker
        this.worker.postMessage({
          type: 'init',
          data: { sampleRate: this.sampleRate },
        });
      } catch (error) {
        console.error('Failed to create worker:', error);
        reject(error);
      }
    });
  }

  // Starts background loading
  startBackgroundLoading(): void {
    if (this.isInitialized || this.initializationPromise) return;
    this.initialize().catch((error) => {
      console.warn('Background essentia.js loading failed:', error);
    });
  }

  setOnAnalysis(callback: (data: AnalysisData) => void): void {
    this.onAnalysis = callback;
  }

  isReady(): boolean {
    return this.isInitialized && this.worker !== null;
  }

  async connectToAudioContext(audioContext: AudioContext): Promise<void> {
    console.log('EssentiaAnalyzer.connectToAudioContext called');
    this.audioContext = audioContext;
    this.sampleRate = audioContext.sampleRate;

    // Create analyser for visualization (used by main thread for spectrum display)
    this.analyserNode = audioContext.createAnalyser();
    this.analyserNode.fftSize = this.frameSize;
    this.analyserNode.smoothingTimeConstant = 0.8;
    console.log('EssentiaAnalyzer connected to audio context');
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

    // Create source from stream and connect to our analyser
    const sourceNode = this.audioContext.createMediaStreamSource(stream);
    sourceNode.connect(this.analyserNode!);

    this.startAnalysisLoop();
  }

  /**
   * Analyze audio from an existing AnalyserNode (e.g., from the audio engine).
   */
  analyzeFromAnalyserNode(analyserNode: AnalyserNode): void {
    console.log('analyzeFromAnalyserNode called:', {
      hasAudioContext: !!this.audioContext,
      isInitialized: this.isInitialized,
      hasWorker: !!this.worker,
    });

    if (!this.audioContext) {
      console.warn('Cannot analyze from node: no audio context');
      return;
    }
    if (!this.isInitialized || !this.worker) {
      console.warn('Cannot analyze from node: worker not initialized');
      return;
    }

    this.stopAnalysis();
    this.analyserNode = analyserNode;
    this.startAnalysisLoop();
  }

  /**
   * Start the analysis loop - reads audio data and sends to worker.
   * Uses setInterval for consistent timing without blocking main thread.
   */
  private startAnalysisLoop(): void {
    if (!this.analyserNode || !this.worker) return;

    this.isAnalyzing = true;
    this.consecutiveSilentFrames = 0;
    this.isIdle = false;

    // Reset worker state
    this.worker.postMessage({ type: 'reset' });

    const frameSize = this.analyserNode.fftSize;
    const timeDomainData = new Float32Array(frameSize);

    // Analysis interval - 100ms (10fps) for good balance of responsiveness vs performance
    // This is much lighter than the previous 33ms (30fps) approach
    const ANALYSIS_INTERVAL_MS = 100;

    this.analysisInterval = window.setInterval(() => {
      // Check disposal state first to prevent sending messages during cleanup
      if (this.isDisposing || !this.isAnalyzing || !this.analyserNode || !this.worker) {
        this.stopAnalysis();
        return;
      }

      // Get time domain data from the analyser
      this.analyserNode.getFloatTimeDomainData(timeDomainData);

      // Check if there's actual audio (not just silence)
      let maxAmplitude = 0;
      for (let i = 0; i < timeDomainData.length; i++) {
        const abs = Math.abs(timeDomainData[i]);
        if (abs > maxAmplitude) maxAmplitude = abs;
      }

      if (maxAmplitude < 0.001) {
        // Audio is silent
        this.consecutiveSilentFrames++;

        // After extended silence, enter idle mode and tell worker to clear buffers
        if (
          this.consecutiveSilentFrames >= EssentiaAnalyzer.IDLE_THRESHOLD_FRAMES &&
          !this.isIdle
        ) {
          this.isIdle = true;
          // Clear worker buffers to free WASM memory
          this.worker.postMessage({ type: 'reset' });
          console.log(
            '[EssentiaAnalyzer] Entered idle mode after extended silence - cleared worker buffers'
          );
        }

        // Skip sending silent frames to worker
        return;
      }

      // Audio detected - reset idle state
      if (this.isIdle) {
        this.isIdle = false;
        console.log('[EssentiaAnalyzer] Audio detected - resuming analysis');
      }
      this.consecutiveSilentFrames = 0;

      // Send audio data to worker for analysis
      // Use transferable to avoid copying (better performance)
      const audioDataCopy = timeDomainData.slice();
      this.worker.postMessage(
        {
          type: 'analyze',
          data: {
            audioData: audioDataCopy,
            frameSize: frameSize,
          },
        },
        [audioDataCopy.buffer]
      );
    }, ANALYSIS_INTERVAL_MS);

    console.log('Started audio analysis from external analyser node');
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

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
      this.analysisInterval = null;
    }

    if (this.worker) {
      this.worker.postMessage({ type: 'stop' });
    }
  }

  /**
   * Reset all analysis buffers and state in the worker.
   * Call this when switching tracks to clear old key/BPM data.
   */
  resetAnalysis(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'reset' });
      console.log('Analysis worker reset - buffers cleared');
    }
  }

  dispose(): void {
    // Set disposing flag first to prevent new messages from being sent
    this.isDisposing = true;

    this.stopAnalysis();

    if (this.worker) {
      // Send flush message to allow worker to complete any pending operations
      try {
        this.worker.postMessage({ type: 'flush' });
      } catch {
        // Worker may already be in a bad state, ignore
      }

      // Delay termination slightly to allow pending messages to be processed
      // This prevents "message channel closed before response" errors
      const workerToTerminate = this.worker;
      this.worker = null;

      setTimeout(() => {
        try {
          workerToTerminate.terminate();
        } catch {
          // Worker may already be terminated, ignore
        }
      }, 50);
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    this.audioContext = null;
    this.isInitialized = false;
    this.isDisposing = false;
  }
}

// Singleton instance
let analyzerInstance: EssentiaAnalyzer | null = null;

export function getEssentiaAnalyzer(): EssentiaAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new EssentiaAnalyzer();

    // Register cleanup on page unload to prevent memory leaks
    if (typeof window !== 'undefined') {
      const cleanup = () => {
        if (analyzerInstance) {
          analyzerInstance.dispose();
          analyzerInstance = null;
        }
      };

      // Use both events for better browser coverage
      window.addEventListener('beforeunload', cleanup);
      window.addEventListener('unload', cleanup);

      // Also handle visibility change to clean up when tab is hidden for extended time
      let hiddenSince: number | null = null;
      const HIDDEN_CLEANUP_THRESHOLD = 5 * 60 * 1000; // 5 minutes

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          hiddenSince = Date.now();
        } else {
          // Tab became visible again
          if (hiddenSince && Date.now() - hiddenSince > HIDDEN_CLEANUP_THRESHOLD) {
            // Tab was hidden for a long time - reset the analyzer to clear accumulated memory
            if (analyzerInstance) {
              analyzerInstance.resetAnalysis();
              console.log(
                '[EssentiaAnalyzer] Tab was hidden for extended period - cleared analysis buffers'
              );
            }
          }
          hiddenSince = null;
        }
      });
    }
  }
  return analyzerInstance;
}

/**
 * Dispose the singleton analyzer instance.
 * Call this when the app is shutting down or when the audio analysis is no longer needed.
 */
export function disposeEssentiaAnalyzer(): void {
  if (analyzerInstance) {
    analyzerInstance.dispose();
    analyzerInstance = null;
  }
}
