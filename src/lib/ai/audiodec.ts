// AudioDec (Facebook SAM Audio) integration for advanced audio processing
// Reference: https://ai.meta.com/research/publications/
// This module provides integration with Facebook's SAM Audio model for:
// - Advanced stem separation (vocals, drums, bass, guitar, piano, strings, other)
// - Text-to-audio manipulation
// - Audio style transfer
// - Audio generation and modification

export type AudioDecStemType = 'vocals' | 'drums' | 'bass' | 'guitar' | 'piano' | 'strings' | 'wind' | 'percussion' | 'synth' | 'other';

export interface AudioDecConfig {
  audioUrl: string;
  operation: AudioDecOperation;
  options?: AudioDecOptions;
}

export type AudioDecOperation =
  | 'separate-stems'
  | 'remove-vocals'
  | 'remove-music'
  | 'isolate-instrument'
  | 'style-transfer'
  | 'tempo-change'
  | 'key-change'
  | 'enhance'
  | 'remix';

export interface AudioDecOptions {
  // Stem separation options
  stemTypes?: AudioDecStemType[];
  quality?: 'fast' | 'balanced' | 'high' | 'ultra';

  // Output format options
  outputFormat?: 'wav' | 'mp3' | 'flac' | 'ogg';
  sampleRate?: 44100 | 48000 | 96000;
  bitDepth?: 16 | 24 | 32;

  // Style transfer options
  targetStyle?: string;
  styleIntensity?: number; // 0-1
  preserveVocals?: boolean;

  // Tempo/Key change options
  targetTempo?: number;
  targetKey?: string;
  preservePitch?: boolean;

  // Enhancement options
  noiseReduction?: number; // 0-1
  dynamicRange?: number; // 0-1
  clarity?: number; // 0-1

  // Remix options
  remixPrompt?: string;
  keepElements?: AudioDecStemType[];
}

export interface AudioDecResult {
  jobId: string;
  status: 'queued' | 'processing' | 'complete' | 'error';
  operation: AudioDecOperation;
  progress?: number;
  message?: string;

  // Results based on operation
  stems?: {
    [key in AudioDecStemType]?: {
      url: string;
      duration: number;
      waveformUrl?: string;
    };
  };

  // Processed audio result
  outputUrl?: string;
  outputDuration?: number;

  // Processing metadata
  processingTime?: number;
  modelVersion?: string;

  error?: string;
}

export interface AudioDecProgress {
  stage: 'uploading' | 'analyzing' | 'processing' | 'separating' | 'encoding' | 'complete' | 'error';
  progress: number;
  message: string;
  currentStem?: AudioDecStemType;
  estimatedTimeRemaining?: number;
}

const AUDIODEC_API_URL = process.env.NEXT_PUBLIC_AUDIODEC_API_URL || '/api/audiodec';

export class AudioDecProcessor {
  private onProgress: ((progress: AudioDecProgress) => void) | null = null;
  private abortController: AbortController | null = null;
  private currentJobId: string | null = null;

  setOnProgress(callback: (progress: AudioDecProgress) => void): void {
    this.onProgress = callback;
  }

  private emitProgress(
    stage: AudioDecProgress['stage'],
    progress: number,
    message: string,
    currentStem?: AudioDecStemType,
    estimatedTimeRemaining?: number
  ): void {
    this.onProgress?.({ stage, progress, message, currentStem, estimatedTimeRemaining });
  }

  // Main processing method
  async process(config: AudioDecConfig): Promise<AudioDecResult> {
    this.abortController = new AbortController();

    try {
      this.emitProgress('uploading', 0, 'Preparing audio for processing...');

      const response = await fetch(`${AUDIODEC_API_URL}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to start processing' }));
        throw new Error(error.error || 'Failed to start processing');
      }

      const { jobId } = await response.json();
      this.currentJobId = jobId;

      this.emitProgress('analyzing', 10, 'Analyzing audio structure...');

      return await this.pollForCompletion(jobId, config);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('Processing cancelled');
      }
      throw error;
    }
  }

  // Convenience method for stem separation
  async separateStems(
    audioUrl: string,
    stemTypes: AudioDecStemType[] = ['vocals', 'drums', 'bass', 'other'],
    quality: 'fast' | 'balanced' | 'high' | 'ultra' = 'balanced'
  ): Promise<AudioDecResult> {
    return this.process({
      audioUrl,
      operation: 'separate-stems',
      options: {
        stemTypes,
        quality,
      },
    });
  }

  // Convenience method for vocal removal
  async removeVocals(audioUrl: string, quality: 'fast' | 'balanced' | 'high' = 'balanced'): Promise<AudioDecResult> {
    return this.process({
      audioUrl,
      operation: 'remove-vocals',
      options: { quality },
    });
  }

  // Convenience method for isolating a specific instrument
  async isolateInstrument(audioUrl: string, instrument: AudioDecStemType): Promise<AudioDecResult> {
    return this.process({
      audioUrl,
      operation: 'isolate-instrument',
      options: {
        stemTypes: [instrument],
        quality: 'high',
      },
    });
  }

  // Style transfer - apply style from one track to another
  async styleTransfer(
    audioUrl: string,
    targetStyle: string,
    options?: {
      styleIntensity?: number;
      preserveVocals?: boolean;
    }
  ): Promise<AudioDecResult> {
    return this.process({
      audioUrl,
      operation: 'style-transfer',
      options: {
        targetStyle,
        styleIntensity: options?.styleIntensity ?? 0.7,
        preserveVocals: options?.preserveVocals ?? true,
      },
    });
  }

  // Change tempo of audio
  async changeTempo(
    audioUrl: string,
    targetTempo: number,
    preservePitch: boolean = true
  ): Promise<AudioDecResult> {
    return this.process({
      audioUrl,
      operation: 'tempo-change',
      options: {
        targetTempo,
        preservePitch,
      },
    });
  }

  // Change key of audio
  async changeKey(audioUrl: string, targetKey: string): Promise<AudioDecResult> {
    return this.process({
      audioUrl,
      operation: 'key-change',
      options: {
        targetKey,
        preservePitch: false,
      },
    });
  }

  // Enhance audio quality
  async enhance(
    audioUrl: string,
    options?: {
      noiseReduction?: number;
      dynamicRange?: number;
      clarity?: number;
    }
  ): Promise<AudioDecResult> {
    return this.process({
      audioUrl,
      operation: 'enhance',
      options: {
        noiseReduction: options?.noiseReduction ?? 0.5,
        dynamicRange: options?.dynamicRange ?? 0.5,
        clarity: options?.clarity ?? 0.5,
      },
    });
  }

  // Text-based remix
  async remix(
    audioUrl: string,
    remixPrompt: string,
    keepElements?: AudioDecStemType[]
  ): Promise<AudioDecResult> {
    return this.process({
      audioUrl,
      operation: 'remix',
      options: {
        remixPrompt,
        keepElements,
      },
    });
  }

  private async pollForCompletion(jobId: string, config: AudioDecConfig): Promise<AudioDecResult> {
    const maxAttempts = 300; // 5 minutes max
    let attempts = 0;
    const startTime = Date.now();

    const stageMessages: Record<string, { message: string; progress: number }> = {
      queued: { message: 'Waiting in queue...', progress: 5 },
      analyzing: { message: 'Analyzing audio content...', progress: 20 },
      processing: { message: 'Processing audio...', progress: 40 },
      separating: { message: 'Separating audio sources...', progress: 60 },
      encoding: { message: 'Encoding output files...', progress: 85 },
    };

    while (attempts < maxAttempts) {
      const response = await fetch(`${AUDIODEC_API_URL}/status/${jobId}`, {
        signal: this.abortController?.signal,
      });

      const status = await response.json();

      if (status.status === 'complete') {
        this.emitProgress('complete', 100, 'Processing complete!');
        return {
          jobId,
          status: 'complete',
          operation: config.operation,
          stems: status.stems,
          outputUrl: status.outputUrl,
          outputDuration: status.outputDuration,
          processingTime: Date.now() - startTime,
          modelVersion: status.modelVersion,
        };
      }

      if (status.status === 'error') {
        this.emitProgress('error', 0, status.error || 'Processing failed');
        return {
          jobId,
          status: 'error',
          operation: config.operation,
          error: status.error,
        };
      }

      // Update progress
      const stageInfo = stageMessages[status.stage] || { message: 'Processing...', progress: 50 };
      const elapsed = Date.now() - startTime;
      const progressPercent = status.progress || stageInfo.progress;
      const estimatedTotal = elapsed / (progressPercent / 100);
      const estimatedRemaining = Math.max(0, Math.round((estimatedTotal - elapsed) / 1000));

      this.emitProgress(
        status.stage as AudioDecProgress['stage'],
        progressPercent,
        status.message || stageInfo.message,
        status.currentStem,
        estimatedRemaining
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error('Processing timed out');
  }

  cancel(): void {
    this.abortController?.abort();
    this.abortController = null;

    if (this.currentJobId) {
      fetch(`${AUDIODEC_API_URL}/cancel/${this.currentJobId}`, {
        method: 'POST',
      }).catch(() => {
        // Ignore cancellation errors
      });
    }
  }

  // Get available stem types for separation
  static getStemTypes(): { id: AudioDecStemType; label: string; icon: string }[] {
    return [
      { id: 'vocals', label: 'Vocals', icon: '🎤' },
      { id: 'drums', label: 'Drums', icon: '🥁' },
      { id: 'bass', label: 'Bass', icon: '🎸' },
      { id: 'guitar', label: 'Guitar', icon: '🎸' },
      { id: 'piano', label: 'Piano', icon: '🎹' },
      { id: 'strings', label: 'Strings', icon: '🎻' },
      { id: 'wind', label: 'Wind', icon: '🎷' },
      { id: 'percussion', label: 'Percussion', icon: '🪘' },
      { id: 'synth', label: 'Synth', icon: '🎛️' },
      { id: 'other', label: 'Other', icon: '🎵' },
    ];
  }

  // Get available operations
  static getOperations(): { id: AudioDecOperation; label: string; description: string }[] {
    return [
      { id: 'separate-stems', label: 'Separate Stems', description: 'Split audio into individual instrument tracks' },
      { id: 'remove-vocals', label: 'Remove Vocals', description: 'Create instrumental version' },
      { id: 'remove-music', label: 'Remove Music', description: 'Isolate vocals from the mix' },
      { id: 'isolate-instrument', label: 'Isolate Instrument', description: 'Extract a specific instrument' },
      { id: 'style-transfer', label: 'Style Transfer', description: 'Apply a different musical style' },
      { id: 'tempo-change', label: 'Change Tempo', description: 'Speed up or slow down' },
      { id: 'key-change', label: 'Change Key', description: 'Transpose to a different key' },
      { id: 'enhance', label: 'Enhance Audio', description: 'Improve audio quality' },
      { id: 'remix', label: 'AI Remix', description: 'Create a remix using text prompts' },
    ];
  }
}

// Utility functions
export async function separateAudioStems(
  audioUrl: string,
  stemTypes?: AudioDecStemType[],
  onProgress?: (progress: AudioDecProgress) => void
): Promise<AudioDecResult> {
  const processor = new AudioDecProcessor();
  if (onProgress) {
    processor.setOnProgress(onProgress);
  }
  return processor.separateStems(audioUrl, stemTypes);
}

export async function removeVocalsFromAudio(
  audioUrl: string,
  onProgress?: (progress: AudioDecProgress) => void
): Promise<AudioDecResult> {
  const processor = new AudioDecProcessor();
  if (onProgress) {
    processor.setOnProgress(onProgress);
  }
  return processor.removeVocals(audioUrl);
}

export async function remixAudio(
  audioUrl: string,
  prompt: string,
  onProgress?: (progress: AudioDecProgress) => void
): Promise<AudioDecResult> {
  const processor = new AudioDecProcessor();
  if (onProgress) {
    processor.setOnProgress(onProgress);
  }
  return processor.remix(audioUrl, prompt);
}
