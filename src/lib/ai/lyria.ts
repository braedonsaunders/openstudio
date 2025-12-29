// Google Lyria RealTime - WebSocket-based real-time music generation
// Documentation: https://ai.google.dev/gemini-api/docs/music-generation

import type {
  LyriaConfig,
  LyriaWeightedPrompt,
  LyriaSessionState,
  LyriaScale,
} from '@/types';

const LYRIA_WS_ENDPOINT = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateMusic';

// Default configuration
const DEFAULT_CONFIG: LyriaConfig = {
  bpm: 120,
  scale: 'C_MAJOR_A_MINOR',
  density: 0.5,
  brightness: 0.5,
  guidance: 4.0,
  temperature: 1.1,
  drums: 0.7,
  bass: 0.7,
  topK: 40,
};

// Map our key format to Lyria scale
export function keyToLyriaScale(key: string | null, keyScale: 'major' | 'minor' | null): LyriaScale {
  if (!key) return 'C_MAJOR_A_MINOR';

  const keyMap: Record<string, LyriaScale> = {
    // Major keys and their relative minors
    'C': 'C_MAJOR_A_MINOR',
    'Am': 'C_MAJOR_A_MINOR',
    'G': 'G_MAJOR_E_MINOR',
    'Em': 'G_MAJOR_E_MINOR',
    'D': 'D_MAJOR_B_MINOR',
    'Bm': 'D_MAJOR_B_MINOR',
    'A': 'A_MAJOR_F_SHARP_MINOR',
    'F#m': 'A_MAJOR_F_SHARP_MINOR',
    'E': 'E_MAJOR_C_SHARP_MINOR',
    'C#m': 'E_MAJOR_C_SHARP_MINOR',
    'B': 'B_MAJOR_G_SHARP_MINOR',
    'G#m': 'B_MAJOR_G_SHARP_MINOR',
    'F': 'F_MAJOR_D_MINOR',
    'Dm': 'F_MAJOR_D_MINOR',
    'Bb': 'B_FLAT_MAJOR_G_MINOR',
    'Gm': 'B_FLAT_MAJOR_G_MINOR',
    'Eb': 'E_FLAT_MAJOR_C_MINOR',
    'Cm': 'E_FLAT_MAJOR_C_MINOR',
    'Ab': 'A_FLAT_MAJOR_F_MINOR',
    'Fm': 'A_FLAT_MAJOR_F_MINOR',
    // Sharp major keys (map to enharmonic equivalents)
    'F#': 'B_MAJOR_G_SHARP_MINOR', // F# major ≈ Gb major, use B major (closest)
    'C#': 'E_MAJOR_C_SHARP_MINOR', // C# is relative minor of E
    'G#': 'A_FLAT_MAJOR_F_MINOR', // G# = Ab enharmonic
    'D#': 'E_FLAT_MAJOR_C_MINOR', // D# = Eb enharmonic
    'A#': 'B_FLAT_MAJOR_G_MINOR', // A# = Bb enharmonic
    // Minor variants without 'm' suffix
    'Db': 'E_MAJOR_C_SHARP_MINOR', // Db = C# enharmonic
    'Gb': 'B_MAJOR_G_SHARP_MINOR', // Gb = F# enharmonic
  };

  // Try direct match first
  if (keyMap[key]) return keyMap[key];

  // Try with scale suffix
  const keyWithScale = keyScale === 'minor' ? `${key}m` : key;
  if (keyMap[keyWithScale]) return keyMap[keyWithScale];

  return 'C_MAJOR_A_MINOR';
}

// Parse prompt string with weights like "jazz piano:0.7, ambient:0.3"
export function parseWeightedPrompts(promptString: string): LyriaWeightedPrompt[] {
  const parts = promptString.split(',').map(p => p.trim());
  return parts.map(part => {
    const match = part.match(/^(.+?):(\d*\.?\d+)$/);
    if (match) {
      return { text: match[1].trim(), weight: parseFloat(match[2]) };
    }
    return { text: part, weight: 1.0 };
  });
}

export interface LyriaSessionCallbacks {
  onStateChange?: (state: LyriaSessionState) => void;
  onError?: (error: Error) => void;
  onConfigApplied?: (config: LyriaConfig) => void;
}

/**
 * Lyria RealTime Session
 * Manages WebSocket connection and audio streaming for real-time music generation
 */
export class LyriaSession {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private streamDestination: MediaStreamAudioDestinationNode | null = null;
  private state: LyriaSessionState = 'disconnected';
  private config: LyriaConfig = { ...DEFAULT_CONFIG };
  private prompts: LyriaWeightedPrompt[] = [];
  private callbacks: LyriaSessionCallbacks = {};
  private apiKey: string;
  private audioQueue: AudioBuffer[] = [];
  private isProcessingAudio = false;
  private nextStartTime = 0;
  private scheduledSources: AudioBufferSourceNode[] = [];
  private setupComplete = false;
  private connectResolve: (() => void) | null = null;
  private connectReject: ((error: Error) => void) | null = null;

  // When true, audio is only sent to streamDestination (for external routing via AudioEngine)
  private useExternalRouting = false;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Set whether to use external audio routing.
   * When enabled, audio is NOT played through Lyria's local destination,
   * but only sent to the output stream for routing through AudioEngine's master bus.
   * Must be called before connect().
   */
  setUseExternalRouting(enabled: boolean): void {
    this.useExternalRouting = enabled;
  }

  /**
   * Set event callbacks
   */
  setCallbacks(callbacks: LyriaSessionCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Get current session state
   */
  getState(): LyriaSessionState {
    return this.state;
  }

  /**
   * Get current configuration
   */
  getConfig(): LyriaConfig {
    return { ...this.config };
  }

  /**
   * Get the output MediaStream for WebRTC sharing
   * This stream contains the Lyria audio and can be added to CloudflareCalls
   * Returns null if not connected
   */
  getOutputStream(): MediaStream | null {
    return this.streamDestination?.stream || null;
  }

  /**
   * Connect to Lyria RealTime
   */
  async connect(): Promise<void> {
    if (this.state !== 'disconnected' && this.state !== 'error') {
      throw new Error('Session already connected or connecting');
    }

    this.setState('connecting');
    this.setupComplete = false;

    try {
      // Initialize Web Audio context
      this.audioContext = new AudioContext({ sampleRate: 48000 });
      this.gainNode = this.audioContext.createGain();

      // Create MediaStream destination for WebRTC sharing and external routing
      // This allows Lyria audio to be shared with other room participants
      this.streamDestination = this.audioContext.createMediaStreamDestination();

      // Route audio based on routing mode
      if (this.useExternalRouting) {
        // External routing: only connect to stream destination (AudioEngine will handle output)
        this.gainNode.connect(this.streamDestination);
        console.log('[Lyria] Using external audio routing (via AudioEngine master)');
      } else {
        // Local routing: connect to both local speakers and the stream destination
        this.gainNode.connect(this.audioContext.destination);
        this.gainNode.connect(this.streamDestination);
      }

      // Connect WebSocket with API key
      const wsUrl = `${LYRIA_WS_ENDPOINT}?key=${this.apiKey}`;
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      await new Promise<void>((resolve, reject) => {
        if (!this.ws) return reject(new Error('WebSocket not initialized'));

        this.connectResolve = resolve;
        this.connectReject = reject;

        const timeoutId = setTimeout(() => {
          reject(new Error('Connection timeout'));
          this.disconnect();
        }, 10000);

        this.ws.onopen = () => {
          clearTimeout(timeoutId);
          console.log('[Lyria] WebSocket connected, sending setup...');
          // Send setup immediately on open
          this.sendSetup();
        };

        this.ws.onerror = (event) => {
          clearTimeout(timeoutId);
          console.error('[Lyria] WebSocket error:', event);
          const error = new Error('WebSocket connection failed');
          this.handleError(error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeoutId);
          console.log('[Lyria] WebSocket closed:', event.code, event.reason);
          // Only set disconnected if we were previously connected
          if (this.state !== 'connecting') {
            this.setState('disconnected');
          }
          this.cleanup();
          if (!this.setupComplete) {
            reject(new Error(`Connection closed: ${event.reason || 'Unknown reason'} (code: ${event.code})`));
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };
      });
    } catch (error) {
      this.setState('error');
      throw error;
    }
  }

  /**
   * Disconnect from Lyria RealTime
   */
  disconnect(): void {
    this.stop();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.cleanup();
    this.setState('disconnected');
  }

  /**
   * Set weighted prompts for music generation
   * If already playing, prompts are sent immediately for smooth transition
   */
  setPrompts(prompts: LyriaWeightedPrompt[] | string): void {
    if (typeof prompts === 'string') {
      this.prompts = parseWeightedPrompts(prompts);
    } else {
      this.prompts = prompts;
    }

    // If already playing, send new prompts immediately for smooth transition
    if (this.state === 'playing' && this.ws?.readyState === WebSocket.OPEN) {
      this.sendMessage({
        client_content: {
          weighted_prompts: this.prompts.map(p => ({
            text: p.text,
            weight: p.weight,
          })),
        },
      });
    }
  }

  /**
   * Update music generation configuration
   * For BPM and scale changes, resetContext is called automatically
   */
  setConfig(config: Partial<LyriaConfig>): void {
    const needsReset = config.bpm !== undefined && config.bpm !== this.config.bpm ||
                       config.scale !== undefined && config.scale !== this.config.scale;

    this.config = { ...this.config, ...config };

    if (this.ws?.readyState === WebSocket.OPEN) {
      // Send full config using Lyria's expected format
      this.sendMessage({
        music_generation_config: {
          bpm: this.config.bpm,
          scale: this.config.scale,
          density: this.config.density,
          brightness: this.config.brightness,
          guidance: this.config.guidance,
          temperature: this.config.temperature,
          top_k: this.config.topK,
          ...(this.config.seed !== undefined && { seed: this.config.seed }),
        },
      });

      if (needsReset) {
        this.resetContext();
      }

      this.callbacks.onConfigApplied?.(this.config);
    }
  }

  /**
   * Set BPM (will reset context for hard transition)
   */
  setBpm(bpm: number): void {
    const clampedBpm = Math.max(60, Math.min(200, bpm));
    this.setConfig({ bpm: clampedBpm });
  }

  /**
   * Set scale/key (will reset context for hard transition)
   */
  setScale(scale: LyriaScale): void {
    this.setConfig({ scale });
  }

  /**
   * Set density (smooth transition, no reset needed)
   */
  setDensity(density: number): void {
    this.config.density = Math.max(0, Math.min(1, density));
    this.sendConfigUpdate();
  }

  /**
   * Set brightness (smooth transition, no reset needed)
   */
  setBrightness(brightness: number): void {
    this.config.brightness = Math.max(0, Math.min(1, brightness));
    this.sendConfigUpdate();
  }

  /**
   * Set drums level - UI placeholder only
   * Note: Lyria API doesn't currently support drums parameter
   */
  setDrums(level: number): void {
    this.config.drums = Math.max(0, Math.min(1, level));
    // Drums not supported by Lyria API - stored locally only
  }

  /**
   * Set bass level - UI placeholder only
   * Note: Lyria API doesn't currently support bass parameter
   */
  setBass(level: number): void {
    this.config.bass = Math.max(0, Math.min(1, level));
    // Bass not supported by Lyria API - stored locally only
  }

  /**
   * Set temperature/chaos (smooth transition)
   */
  setTemperature(temperature: number): void {
    this.config.temperature = Math.max(0, Math.min(3, temperature));
    this.sendConfigUpdate();
  }

  /**
   * Set guidance (how strictly to follow prompts)
   */
  setGuidance(guidance: number): void {
    this.config.guidance = Math.max(0, Math.min(6, guidance));
    this.sendConfigUpdate();
  }

  /**
   * Reset context (required after BPM or scale changes)
   */
  resetContext(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // playback_control is a scalar enum field
      this.sendMessage({
        playback_control: 'RESET_CONTEXT',
      });
    }
  }

  /**
   * Start music playback by sending prompts and play command
   */
  play(): void {
    if (this.state !== 'connected' && this.state !== 'paused') {
      console.warn('Cannot play: not connected');
      return;
    }

    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      // If no prompts set, use a default
      if (this.prompts.length === 0) {
        this.prompts = [{ text: 'instrumental music', weight: 1.0 }];
      }

      // Send prompts via client_content (BidiGenerateMusicClientContent)
      this.sendMessage({
        client_content: {
          weighted_prompts: this.prompts.map(p => ({
            text: p.text,
            weight: p.weight,
          })),
        },
      });

      // Send play command - playback_control is a scalar enum
      this.sendMessage({
        playback_control: 'PLAY',
      });

      this.setState('playing');
    }
  }

  /**
   * Pause music playback
   */
  pause(): void {
    if (this.state !== 'playing') return;

    // Send pause command - playback_control is a scalar enum
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendMessage({
        playback_control: 'PAUSE',
      });
    }

    // Also pause local audio
    if (this.audioContext?.state === 'running') {
      this.audioContext.suspend();
    }

    this.setState('paused');
  }

  /**
   * Stop music playback
   */
  stop(): void {
    // Send stop command - playback_control is a scalar enum
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendMessage({
        playback_control: 'STOP',
      });
    }

    // Cancel all scheduled audio
    this.scheduledSources.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Ignore errors from already stopped sources
      }
    });
    this.scheduledSources = [];
    this.audioQueue = [];
    this.isProcessingAudio = false;
    this.nextStartTime = 0;

    if (this.state === 'playing' || this.state === 'paused') {
      this.setState('connected');
    }
  }

  /**
   * Set output volume
   */
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.setValueAtTime(
        Math.max(0, Math.min(1, volume)),
        this.audioContext?.currentTime || 0
      );
    }
  }

  private sendSetup(): void {
    // Send setup message with just the model name
    this.sendMessage({
      setup: {
        model: 'models/lyria-realtime-exp',
      },
    });
  }

  private sendConfigUpdate(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Note: drums/bass are UI-only - Lyria API doesn't support them
      this.sendMessage({
        music_generation_config: {
          density: this.config.density,
          brightness: this.config.brightness,
          guidance: this.config.guidance,
          temperature: this.config.temperature,
        },
      });
    }
  }

  private sendMessage(message: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleMessage(event: MessageEvent): void {
    if (event.data instanceof ArrayBuffer) {
      // Try to parse as JSON first (setupComplete comes as binary)
      try {
        const decoder = new TextDecoder();
        const text = decoder.decode(event.data);
        const message = JSON.parse(text);
        this.handleJsonMessage(message);
        return;
      } catch {
        // Not JSON, treat as audio data
        this.handleAudioData(event.data);
      }
    } else if (typeof event.data === 'string') {
      // JSON message as string
      try {
        const message = JSON.parse(event.data);
        this.handleJsonMessage(message);
      } catch (e) {
        console.error('[Lyria] Failed to parse message:', e);
      }
    }
  }

  private handleAudioData(data: ArrayBuffer): void {
    if (!this.audioContext || this.state !== 'playing') return;

    // Lyria sends 48kHz stereo PCM
    const float32Data = new Float32Array(data);
    const numSamples = float32Data.length / 2; // Stereo

    const audioBuffer = this.audioContext.createBuffer(2, numSamples, 48000);
    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = audioBuffer.getChannelData(1);

    // Deinterleave stereo data
    for (let i = 0; i < numSamples; i++) {
      leftChannel[i] = float32Data[i * 2];
      rightChannel[i] = float32Data[i * 2 + 1];
    }

    this.scheduleAudioBuffer(audioBuffer);
  }

  private scheduleAudioBuffer(buffer: AudioBuffer): void {
    if (!this.audioContext || !this.gainNode) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);

    const currentTime = this.audioContext.currentTime;
    const startTime = Math.max(currentTime, this.nextStartTime);

    source.start(startTime);
    this.nextStartTime = startTime + buffer.duration;

    // Track source for cleanup
    this.scheduledSources.push(source);
    source.onended = () => {
      const index = this.scheduledSources.indexOf(source);
      if (index > -1) {
        this.scheduledSources.splice(index, 1);
      }
    };

    // Keep only recent sources
    if (this.scheduledSources.length > 10) {
      this.scheduledSources.shift();
    }
  }

  private handleJsonMessage(message: Record<string, unknown>): void {
    // Handle setup complete response
    if (message.setupComplete || message.setup_complete) {
      console.log('[Lyria] Setup complete!');
      this.setupComplete = true;
      this.setState('connected');
      this.connectResolve?.();
      this.connectResolve = null;
      this.connectReject = null;
      return;
    }

    // Handle server content with audio chunks
    const serverContent = (message.serverContent || message.server_content) as {
      audioChunks?: Array<{ data: string }>;
    } | undefined;

    if (serverContent?.audioChunks) {
      // Process audio chunks - base64 encoded 16-bit PCM
      for (const chunk of serverContent.audioChunks) {
        if (chunk.data) {
          this.processAudioChunk(chunk.data);
        }
      }
      return;
    }

    // Handle error
    if (message.error) {
      const errorMsg = typeof message.error === 'object'
        ? JSON.stringify(message.error)
        : String(message.error);
      console.error('[Lyria] Error from server:', errorMsg);
      this.handleError(new Error(errorMsg));
      return;
    }

    // Log other message types for debugging
    if (!message.serverContent && !message.server_content) {
      console.log('[Lyria] Received message:', message);
    }
  }

  /**
   * Process base64-encoded 16-bit PCM audio chunk
   * Lyria outputs 48kHz stereo 16-bit PCM
   */
  private processAudioChunk(base64Data: string): void {
    if (!this.audioContext || this.state !== 'playing') return;

    try {
      // Decode base64 to binary
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert to Int16Array (16-bit PCM)
      const int16Data = new Int16Array(bytes.buffer);
      const numSamples = int16Data.length / 2; // Stereo

      if (numSamples === 0) return;

      // Create audio buffer
      const audioBuffer = this.audioContext.createBuffer(2, numSamples, 48000);
      const leftChannel = audioBuffer.getChannelData(0);
      const rightChannel = audioBuffer.getChannelData(1);

      // Convert 16-bit PCM to Float32 and deinterleave stereo
      for (let i = 0; i < numSamples; i++) {
        // Normalize Int16 (-32768 to 32767) to Float32 (-1.0 to 1.0)
        leftChannel[i] = int16Data[i * 2] / 32768;
        rightChannel[i] = int16Data[i * 2 + 1] / 32768;
      }

      this.scheduleAudioBuffer(audioBuffer);
    } catch (e) {
      console.error('[Lyria] Failed to process audio chunk:', e);
    }
  }

  private handleError(error: Error): void {
    console.error('Lyria error:', error);
    this.callbacks.onError?.(error);
    this.setState('error');
  }

  private setState(state: LyriaSessionState): void {
    this.state = state;
    this.callbacks.onStateChange?.(state);
  }

  private cleanup(): void {
    this.scheduledSources.forEach(source => {
      try {
        source.stop();
      } catch (e) {
        // Ignore
      }
    });
    this.scheduledSources = [];
    this.audioQueue = [];

    // Disconnect stream destination
    if (this.streamDestination) {
      this.streamDestination.disconnect();
      this.streamDestination = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.gainNode = null;
  }
}

/**
 * Create a Lyria session with the API key from environment
 * Uses NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY for client-side access
 */
export function createLyriaSession(): LyriaSession {
  // Check for client-side accessible key (NEXT_PUBLIC_ prefix required for browser)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY || '';
  if (!apiKey) {
    console.warn('NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY not set - Lyria will not work. Add NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY to your .env.local with your Gemini API key.');
  }
  return new LyriaSession(apiKey);
}

/**
 * Available style prompts for quick selection
 */
export const LYRIA_STYLES = [
  { id: 'jazz', label: 'Jazz', prompt: 'smooth jazz piano' },
  { id: 'rock', label: 'Rock', prompt: 'electric rock guitar drums' },
  { id: 'electronic', label: 'Electronic', prompt: 'electronic synth beats' },
  { id: 'ambient', label: 'Ambient', prompt: 'ambient atmospheric pads' },
  { id: 'lofi', label: 'Lo-Fi', prompt: 'lofi hip hop chill beats' },
  { id: 'funk', label: 'Funk', prompt: 'funky bass groove drums' },
  { id: 'classical', label: 'Classical', prompt: 'orchestral classical strings' },
  { id: 'blues', label: 'Blues', prompt: 'blues guitar soul' },
] as const;

/**
 * Available mood modifiers
 */
export const LYRIA_MOODS = [
  { id: 'energetic', label: 'Energetic', modifier: 'energetic upbeat' },
  { id: 'chill', label: 'Chill', modifier: 'chill relaxed mellow' },
  { id: 'dark', label: 'Dark', modifier: 'dark moody minor' },
  { id: 'uplifting', label: 'Uplifting', modifier: 'uplifting bright major' },
  { id: 'mysterious', label: 'Mysterious', modifier: 'mysterious ethereal' },
  { id: 'aggressive', label: 'Intense', modifier: 'intense aggressive powerful' },
] as const;

export type LyriaStyleId = typeof LYRIA_STYLES[number]['id'];
export type LyriaMoodId = typeof LYRIA_MOODS[number]['id'];

/**
 * Build a prompt string from style and mood
 */
export function buildPrompt(styleId: LyriaStyleId, moodId?: LyriaMoodId): string {
  const style = LYRIA_STYLES.find(s => s.id === styleId);
  const mood = moodId ? LYRIA_MOODS.find(m => m.id === moodId) : null;

  if (!style) return 'instrumental music';
  if (!mood) return style.prompt;

  return `${mood.modifier} ${style.prompt}`;
}
