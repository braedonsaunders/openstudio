// Suno AI integration for AI-generated backing tracks
// Allows users to describe a backing track and have it generated and extended

export interface SunoGenerationConfig {
  prompt: string;
  style?: string;
  tempo?: number;
  key?: string;
  duration?: number;
  instrumental?: boolean;
  continueFromId?: string;
}

export interface SunoTrack {
  id: string;
  title: string;
  audioUrl: string;
  duration: number;
  style: string;
  prompt: string;
  createdAt: string;
  isExtension?: boolean;
  parentId?: string;
}

export interface SunoGenerationProgress {
  stage: 'queued' | 'generating' | 'processing' | 'complete' | 'error';
  progress: number;
  message: string;
  estimatedTimeRemaining?: number;
}

const SUNO_API_URL = process.env.NEXT_PUBLIC_SUNO_API_URL || '/api/suno';

export class SunoAIGenerator {
  private onProgress: ((progress: SunoGenerationProgress) => void) | null = null;
  private abortController: AbortController | null = null;
  private currentGenerationId: string | null = null;

  setOnProgress(callback: (progress: SunoGenerationProgress) => void): void {
    this.onProgress = callback;
  }

  private emitProgress(
    stage: SunoGenerationProgress['stage'],
    progress: number,
    message: string,
    estimatedTimeRemaining?: number
  ): void {
    this.onProgress?.({ stage, progress, message, estimatedTimeRemaining });
  }

  async generateTrack(config: SunoGenerationConfig): Promise<SunoTrack> {
    this.abortController = new AbortController();

    try {
      this.emitProgress('queued', 0, 'Preparing generation request...');

      // Build the enhanced prompt
      const enhancedPrompt = this.buildEnhancedPrompt(config);

      // Start generation
      const response = await fetch(`${SUNO_API_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: enhancedPrompt,
          duration: config.duration || 30,
          instrumental: config.instrumental ?? true,
          continueFromId: config.continueFromId,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to start generation');
      }

      const { generationId } = await response.json();
      this.currentGenerationId = generationId;

      this.emitProgress('generating', 10, 'AI is composing your track...');

      // Poll for completion
      return await this.pollForCompletion(generationId, config);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('Generation cancelled');
      }
      throw error;
    }
  }

  async extendTrack(parentTrackId: string, additionalPrompt?: string): Promise<SunoTrack> {
    this.abortController = new AbortController();

    try {
      this.emitProgress('queued', 0, 'Preparing extension request...');

      const response = await fetch(`${SUNO_API_URL}/extend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parentId: parentTrackId,
          additionalPrompt,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to extend track');
      }

      const { generationId } = await response.json();
      this.currentGenerationId = generationId;

      this.emitProgress('generating', 10, 'AI is extending your track...');

      return await this.pollForCompletion(generationId, { prompt: additionalPrompt || '' });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('Extension cancelled');
      }
      throw error;
    }
  }

  async generateEndlessLoop(config: SunoGenerationConfig): Promise<AsyncGenerator<SunoTrack>> {
    const self = this;

    async function* generator(): AsyncGenerator<SunoTrack> {
      let currentTrack = await self.generateTrack(config);
      yield currentTrack;

      while (true) {
        // Continuously extend the track
        currentTrack = await self.extendTrack(currentTrack.id, config.prompt);
        yield currentTrack;
      }
    }

    return generator();
  }

  private buildEnhancedPrompt(config: SunoGenerationConfig): string {
    const parts = [config.prompt];

    if (config.style) {
      parts.push(`Style: ${config.style}`);
    }

    if (config.tempo) {
      parts.push(`Tempo: ${config.tempo} BPM`);
    }

    if (config.key) {
      parts.push(`Key: ${config.key}`);
    }

    return parts.join('. ');
  }

  private async pollForCompletion(
    generationId: string,
    config: SunoGenerationConfig
  ): Promise<SunoTrack> {
    const maxAttempts = 180; // 3 minutes max
    let attempts = 0;
    const startTime = Date.now();

    while (attempts < maxAttempts) {
      const response = await fetch(`${SUNO_API_URL}/status/${generationId}`, {
        signal: this.abortController?.signal,
      });

      const status = await response.json();

      if (status.status === 'completed') {
        this.emitProgress('complete', 100, 'Track generated successfully!');
        return {
          id: status.trackId,
          title: status.title || 'AI Generated Track',
          audioUrl: status.audioUrl,
          duration: status.duration,
          style: status.style || config.style || 'generated',
          prompt: config.prompt,
          createdAt: new Date().toISOString(),
          isExtension: !!config.continueFromId,
          parentId: config.continueFromId,
        };
      }

      if (status.status === 'failed') {
        this.emitProgress('error', 0, status.error || 'Generation failed');
        throw new Error(status.error || 'Generation failed');
      }

      // Calculate progress and estimated time
      const elapsed = Date.now() - startTime;
      const progress = Math.min(10 + (attempts / maxAttempts) * 85, 95);
      const avgTimePerStep = elapsed / (attempts + 1);
      const remainingSteps = maxAttempts - attempts;
      const estimatedRemaining = Math.round((avgTimePerStep * remainingSteps) / 1000);

      this.emitProgress(
        'generating',
        progress,
        status.message || 'Generating...',
        estimatedRemaining
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error('Generation timed out');
  }

  cancel(): void {
    this.abortController?.abort();
    this.abortController = null;

    // Attempt to cancel server-side if we have a generation ID
    if (this.currentGenerationId) {
      fetch(`${SUNO_API_URL}/cancel/${this.currentGenerationId}`, {
        method: 'POST',
      }).catch(() => {
        // Ignore cancellation errors
      });
    }
  }
}

// Quick generation utility
export async function generateBackingTrack(
  prompt: string,
  options: Partial<SunoGenerationConfig> = {},
  onProgress?: (progress: SunoGenerationProgress) => void
): Promise<SunoTrack> {
  const generator = new SunoAIGenerator();
  if (onProgress) {
    generator.setOnProgress(onProgress);
  }
  return generator.generateTrack({ prompt, ...options });
}
