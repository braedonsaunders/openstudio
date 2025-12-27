// Meta SAM (Segment Anything Model) integration for audio source separation
// Uses the SAM Audio model for separating instruments from backing tracks
// Reference: https://ai.meta.com/blog/sam-audio/

export interface SAMSeparationResult {
  trackId: string;
  stems: {
    vocals?: string;
    drums?: string;
    bass?: string;
    other?: string;
  };
  processingTime: number;
  quality: 'high' | 'medium' | 'low';
}

export interface SAMProgress {
  stage: 'uploading' | 'processing' | 'separating' | 'encoding' | 'complete';
  progress: number;
  message: string;
}

// SAM Audio API configuration
const SAM_API_URL = process.env.NEXT_PUBLIC_SAM_API_URL || '/api/sam';

export class SAMAudioSeparator {
  private onProgress: ((progress: SAMProgress) => void) | null = null;
  private abortController: AbortController | null = null;

  setOnProgress(callback: (progress: SAMProgress) => void): void {
    this.onProgress = callback;
  }

  private emitProgress(stage: SAMProgress['stage'], progress: number, message: string): void {
    this.onProgress?.({ stage, progress, message });
  }

  async separateTrack(
    audioUrl: string,
    trackId: string,
    separationType: 'vocals' | 'drums' | 'bass' | 'all' = 'all'
  ): Promise<SAMSeparationResult> {
    this.abortController = new AbortController();

    try {
      this.emitProgress('uploading', 0, 'Preparing audio for separation...');

      // Step 1: Download the audio file
      const audioResponse = await fetch(audioUrl);
      const audioBlob = await audioResponse.blob();

      this.emitProgress('processing', 20, 'Analyzing audio structure...');

      // Step 2: Upload to SAM API for processing
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('trackId', trackId);
      formData.append('separationType', separationType);

      const startTime = Date.now();

      const response = await fetch(`${SAM_API_URL}/separate`, {
        method: 'POST',
        body: formData,
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to separate audio');
      }

      this.emitProgress('separating', 50, 'Separating audio sources...');

      // Step 3: Poll for completion or use streaming response
      const result = await response.json();

      if (result.jobId) {
        // Async processing - poll for results
        return await this.pollForCompletion(result.jobId, trackId, startTime);
      }

      this.emitProgress('complete', 100, 'Separation complete!');

      return {
        trackId,
        stems: result.stems,
        processingTime: Date.now() - startTime,
        quality: result.quality || 'high',
      };
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('Separation cancelled');
      }
      throw error;
    }
  }

  private async pollForCompletion(
    jobId: string,
    trackId: string,
    startTime: number
  ): Promise<SAMSeparationResult> {
    const maxAttempts = 120; // 2 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      const response = await fetch(`${SAM_API_URL}/status/${jobId}`, {
        signal: this.abortController?.signal,
      });

      const status = await response.json();

      if (status.status === 'completed') {
        this.emitProgress('complete', 100, 'Separation complete!');
        return {
          trackId,
          stems: status.stems,
          processingTime: Date.now() - startTime,
          quality: status.quality || 'high',
        };
      }

      if (status.status === 'failed') {
        throw new Error(status.error || 'Separation failed');
      }

      // Update progress
      const progress = 50 + (attempts / maxAttempts) * 45;
      this.emitProgress('separating', progress, status.message || 'Processing...');

      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error('Separation timed out');
  }

  cancel(): void {
    this.abortController?.abort();
    this.abortController = null;
  }
}

// Utility function for quick separation
export async function separateAudioStems(
  audioUrl: string,
  trackId: string,
  onProgress?: (progress: SAMProgress) => void
): Promise<SAMSeparationResult> {
  const separator = new SAMAudioSeparator();
  if (onProgress) {
    separator.setOnProgress(onProgress);
  }
  return separator.separateTrack(audioUrl, trackId, 'all');
}
