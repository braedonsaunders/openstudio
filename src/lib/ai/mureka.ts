// Mureka AI integration for AI-generated music with vocals and instrumentals
// Mureka API provides high-quality music generation with custom lyrics support
// Reference: https://mureka.ai

export interface MurekaGenerationConfig {
  prompt: string;
  lyrics?: string;
  style?: MurekaStyle;
  mood?: MurekaMood;
  tempo?: 'slow' | 'medium' | 'fast' | 'very_fast';
  duration?: number; // 15-180 seconds
  instrumental?: boolean;
  model?: 'standard' | 'pro' | 'ultra';
  referenceAudioUrl?: string;
  key?: string;
  customTags?: string[];
}

export type MurekaStyle =
  | 'pop'
  | 'rock'
  | 'hiphop'
  | 'rnb'
  | 'electronic'
  | 'jazz'
  | 'classical'
  | 'folk'
  | 'country'
  | 'metal'
  | 'reggae'
  | 'latin'
  | 'ambient'
  | 'lofi'
  | 'cinematic'
  | 'funk'
  | 'soul'
  | 'blues';

export type MurekaMood =
  | 'happy'
  | 'sad'
  | 'energetic'
  | 'chill'
  | 'romantic'
  | 'dark'
  | 'uplifting'
  | 'melancholic'
  | 'aggressive'
  | 'peaceful'
  | 'mysterious'
  | 'epic'
  | 'dreamy'
  | 'nostalgic';

export interface MurekaTrack {
  id: string;
  title: string;
  audioUrl: string;
  duration: number;
  style: MurekaStyle;
  mood?: MurekaMood;
  prompt: string;
  lyrics?: string;
  hasVocals: boolean;
  createdAt: string;
  waveformUrl?: string;
  coverArtUrl?: string;
  stems?: {
    vocals?: string;
    instrumental?: string;
  };
}

export interface MurekaGenerationProgress {
  stage: 'queued' | 'composing' | 'arranging' | 'vocals' | 'mixing' | 'mastering' | 'complete' | 'error';
  progress: number;
  message: string;
  estimatedTimeRemaining?: number;
  currentStep?: string;
}

export interface MurekaLyricsConfig {
  theme?: string;
  style?: 'verse-chorus' | 'freeform' | 'spoken-word' | 'rap';
  language?: string;
  mood?: MurekaMood;
}

const MUREKA_API_URL = process.env.NEXT_PUBLIC_MUREKA_API_URL || '/api/mureka';

export class MurekaGenerator {
  private onProgress: ((progress: MurekaGenerationProgress) => void) | null = null;
  private abortController: AbortController | null = null;
  private currentGenerationId: string | null = null;

  setOnProgress(callback: (progress: MurekaGenerationProgress) => void): void {
    this.onProgress = callback;
  }

  private emitProgress(
    stage: MurekaGenerationProgress['stage'],
    progress: number,
    message: string,
    estimatedTimeRemaining?: number,
    currentStep?: string
  ): void {
    this.onProgress?.({ stage, progress, message, estimatedTimeRemaining, currentStep });
  }

  async generateTrack(config: MurekaGenerationConfig): Promise<MurekaTrack> {
    this.abortController = new AbortController();

    try {
      this.emitProgress('queued', 0, 'Preparing your music request...');

      // Start generation
      const response = await fetch(`${MUREKA_API_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: config.prompt,
          lyrics: config.lyrics,
          style: config.style || 'pop',
          mood: config.mood,
          tempo: config.tempo || 'medium',
          duration: config.duration || 60,
          instrumental: config.instrumental ?? false,
          model: config.model || 'standard',
          referenceAudioUrl: config.referenceAudioUrl,
          key: config.key,
          customTags: config.customTags,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to start generation' }));
        throw new Error(error.error || 'Failed to start generation');
      }

      const { generationId } = await response.json();
      this.currentGenerationId = generationId;

      this.emitProgress('composing', 10, 'AI is composing your music...', undefined, 'Creating melody');

      // Poll for completion
      return await this.pollForCompletion(generationId, config);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('Generation cancelled');
      }
      throw error;
    }
  }

  async generateLyrics(config: MurekaLyricsConfig): Promise<string> {
    const response = await fetch(`${MUREKA_API_URL}/lyrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error('Failed to generate lyrics');
    }

    const { lyrics } = await response.json();
    return lyrics;
  }

  async generateFromReference(
    audioUrl: string,
    modifications: {
      keepMelody?: boolean;
      keepRhythm?: boolean;
      newStyle?: MurekaStyle;
      newMood?: MurekaMood;
      newLyrics?: string;
    }
  ): Promise<MurekaTrack> {
    this.abortController = new AbortController();

    try {
      this.emitProgress('queued', 0, 'Analyzing reference audio...');

      const response = await fetch(`${MUREKA_API_URL}/transform`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          referenceUrl: audioUrl,
          ...modifications,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to start transformation');
      }

      const { generationId } = await response.json();
      this.currentGenerationId = generationId;

      return await this.pollForCompletion(generationId, {
        prompt: 'Transformation from reference',
        style: modifications.newStyle,
        mood: modifications.newMood,
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new Error('Transformation cancelled');
      }
      throw error;
    }
  }

  private async pollForCompletion(
    generationId: string,
    config: Partial<MurekaGenerationConfig>
  ): Promise<MurekaTrack> {
    const maxAttempts = 300; // 5 minutes max for longer tracks
    let attempts = 0;
    const startTime = Date.now();

    const stageMessages: Record<string, { message: string; progress: number }> = {
      queued: { message: 'Waiting in queue...', progress: 5 },
      composing: { message: 'Composing melody and harmony...', progress: 20 },
      arranging: { message: 'Arranging instruments...', progress: 40 },
      vocals: { message: 'Generating vocals...', progress: 60 },
      mixing: { message: 'Mixing tracks...', progress: 75 },
      mastering: { message: 'Mastering audio...', progress: 90 },
    };

    while (attempts < maxAttempts) {
      const response = await fetch(`${MUREKA_API_URL}/status/${generationId}`, {
        signal: this.abortController?.signal,
      });

      const status = await response.json();

      if (status.status === 'completed' || status.status === 'complete') {
        this.emitProgress('complete', 100, 'Your track is ready!');
        return {
          id: status.trackId || generationId,
          title: status.title || `AI Song: ${config.prompt?.slice(0, 30)}...`,
          audioUrl: status.audioUrl,
          duration: status.duration || config.duration || 60,
          style: status.style || config.style || 'pop',
          mood: status.mood || config.mood,
          prompt: config.prompt || '',
          lyrics: status.lyrics || config.lyrics,
          hasVocals: !config.instrumental,
          createdAt: new Date().toISOString(),
          waveformUrl: status.waveformUrl,
          coverArtUrl: status.coverArtUrl,
          stems: status.stems,
        };
      }

      if (status.status === 'failed' || status.status === 'error') {
        this.emitProgress('error', 0, status.error || 'Generation failed');
        throw new Error(status.error || 'Generation failed');
      }

      // Get stage-specific progress
      const currentStage = status.stage || 'composing';
      const stageInfo = stageMessages[currentStage] || { message: 'Processing...', progress: 50 };

      // Calculate estimated time
      const elapsed = Date.now() - startTime;
      const progressPercent = status.progress || stageInfo.progress;
      const estimatedTotal = elapsed / (progressPercent / 100);
      const estimatedRemaining = Math.max(0, Math.round((estimatedTotal - elapsed) / 1000));

      this.emitProgress(
        currentStage as MurekaGenerationProgress['stage'],
        progressPercent,
        status.message || stageInfo.message,
        estimatedRemaining,
        status.currentStep
      );

      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error('Generation timed out');
  }

  cancel(): void {
    this.abortController?.abort();
    this.abortController = null;

    // Attempt to cancel server-side
    if (this.currentGenerationId) {
      fetch(`${MUREKA_API_URL}/cancel/${this.currentGenerationId}`, {
        method: 'POST',
      }).catch(() => {
        // Ignore cancellation errors
      });
    }
  }

  // Get available styles
  static getStyles(): { id: MurekaStyle; label: string; icon: string }[] {
    return [
      { id: 'pop', label: 'Pop', icon: '🎤' },
      { id: 'rock', label: 'Rock', icon: '🎸' },
      { id: 'hiphop', label: 'Hip Hop', icon: '🎧' },
      { id: 'rnb', label: 'R&B', icon: '🎵' },
      { id: 'electronic', label: 'Electronic', icon: '🎹' },
      { id: 'jazz', label: 'Jazz', icon: '🎷' },
      { id: 'classical', label: 'Classical', icon: '🎻' },
      { id: 'folk', label: 'Folk', icon: '🪕' },
      { id: 'country', label: 'Country', icon: '🤠' },
      { id: 'metal', label: 'Metal', icon: '🤘' },
      { id: 'reggae', label: 'Reggae', icon: '🌴' },
      { id: 'latin', label: 'Latin', icon: '💃' },
      { id: 'ambient', label: 'Ambient', icon: '🌙' },
      { id: 'lofi', label: 'Lo-Fi', icon: '📻' },
      { id: 'cinematic', label: 'Cinematic', icon: '🎬' },
      { id: 'funk', label: 'Funk', icon: '🕺' },
      { id: 'soul', label: 'Soul', icon: '💜' },
      { id: 'blues', label: 'Blues', icon: '🎺' },
    ];
  }

  // Get available moods
  static getMoods(): { id: MurekaMood; label: string; icon: string }[] {
    return [
      { id: 'happy', label: 'Happy', icon: '😊' },
      { id: 'sad', label: 'Sad', icon: '😢' },
      { id: 'energetic', label: 'Energetic', icon: '⚡' },
      { id: 'chill', label: 'Chill', icon: '😎' },
      { id: 'romantic', label: 'Romantic', icon: '💕' },
      { id: 'dark', label: 'Dark', icon: '🌑' },
      { id: 'uplifting', label: 'Uplifting', icon: '🌟' },
      { id: 'melancholic', label: 'Melancholic', icon: '🥀' },
      { id: 'aggressive', label: 'Aggressive', icon: '🔥' },
      { id: 'peaceful', label: 'Peaceful', icon: '☮️' },
      { id: 'mysterious', label: 'Mysterious', icon: '🔮' },
      { id: 'epic', label: 'Epic', icon: '🏔️' },
      { id: 'dreamy', label: 'Dreamy', icon: '💭' },
      { id: 'nostalgic', label: 'Nostalgic', icon: '📷' },
    ];
  }
}

// Quick generation utility
export async function generateMurekaTrack(
  prompt: string,
  options: Partial<MurekaGenerationConfig> = {},
  onProgress?: (progress: MurekaGenerationProgress) => void
): Promise<MurekaTrack> {
  const generator = new MurekaGenerator();
  if (onProgress) {
    generator.setOnProgress(onProgress);
  }
  return generator.generateTrack({ prompt, ...options });
}

// Generate a quick jam track
export async function generateJamTrack(
  style: MurekaStyle,
  mood: MurekaMood,
  tempo: 'slow' | 'medium' | 'fast',
  duration: number = 60,
  onProgress?: (progress: MurekaGenerationProgress) => void
): Promise<MurekaTrack> {
  const generator = new MurekaGenerator();
  if (onProgress) {
    generator.setOnProgress(onProgress);
  }

  const prompt = `Create a ${tempo} ${mood} ${style} jam track perfect for musicians to practice and improvise over`;

  return generator.generateTrack({
    prompt,
    style,
    mood,
    tempo,
    duration,
    instrumental: true,
    model: 'standard',
  });
}
