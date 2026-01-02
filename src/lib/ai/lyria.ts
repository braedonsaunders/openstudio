// Google Lyria RealTime - WebSocket-based real-time music generation
// Documentation: https://ai.google.dev/gemini-api/docs/music-generation
//
// SECURITY: This module now requires authentication. The API key is stored
// server-side and accessed via /api/lyria/connect which validates the user's
// auth token and rate limits before returning the WebSocket URL.

import type {
  LyriaConfig,
  LyriaWeightedPrompt,
  LyriaSessionState,
  LyriaScale,
} from '@/types';

// Rate limit status returned from the API
export interface LyriaRateLimitStatus {
  dailySecondsRemaining: number;
  connectionsRemaining: number;
  resetAt: string;
  accountType: string;
  maxSessionSeconds: number;
  dailySecondsLimit?: number;
}

// Error types for better error handling
export type LyriaErrorCode =
  | 'AUTH_REQUIRED'
  | 'PROFILE_NOT_FOUND'
  | 'ACCOUNT_BANNED'
  | 'EMAIL_NOT_VERIFIED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SERVICE_NOT_CONFIGURED'
  | 'CONNECTION_FAILED'
  | 'NETWORK_ERROR';

export class LyriaAuthError extends Error {
  code: LyriaErrorCode;
  limits?: LyriaRateLimitStatus;

  constructor(message: string, code: LyriaErrorCode, limits?: LyriaRateLimitStatus) {
    super(message);
    this.name = 'LyriaAuthError';
    this.code = code;
    this.limits = limits;
  }
}

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
// Uses exact enum values from Google Lyria API
export function keyToLyriaScale(key: string | null, keyScale: 'major' | 'minor' | null): LyriaScale {
  if (!key) return 'SCALE_UNSPECIFIED';

  const keyMap: Record<string, LyriaScale> = {
    // Major keys and their relative minors
    'C': 'C_MAJOR_A_MINOR',
    'Am': 'C_MAJOR_A_MINOR',
    'Db': 'D_FLAT_MAJOR_B_FLAT_MINOR',
    'C#': 'D_FLAT_MAJOR_B_FLAT_MINOR', // C# = Db enharmonic
    'Bbm': 'D_FLAT_MAJOR_B_FLAT_MINOR',
    'A#m': 'D_FLAT_MAJOR_B_FLAT_MINOR', // A#m = Bbm enharmonic
    'D': 'D_MAJOR_B_MINOR',
    'Bm': 'D_MAJOR_B_MINOR',
    'Eb': 'E_FLAT_MAJOR_C_MINOR',
    'D#': 'E_FLAT_MAJOR_C_MINOR', // D# = Eb enharmonic
    'Cm': 'E_FLAT_MAJOR_C_MINOR',
    'E': 'E_MAJOR_D_FLAT_MINOR',
    'C#m': 'E_MAJOR_D_FLAT_MINOR',
    'Dbm': 'E_MAJOR_D_FLAT_MINOR', // Dbm = C#m enharmonic
    'F': 'F_MAJOR_D_MINOR',
    'Dm': 'F_MAJOR_D_MINOR',
    'Gb': 'G_FLAT_MAJOR_E_FLAT_MINOR',
    'F#': 'G_FLAT_MAJOR_E_FLAT_MINOR', // F# = Gb enharmonic
    'Ebm': 'G_FLAT_MAJOR_E_FLAT_MINOR',
    'D#m': 'G_FLAT_MAJOR_E_FLAT_MINOR', // D#m = Ebm enharmonic
    'G': 'G_MAJOR_E_MINOR',
    'Em': 'G_MAJOR_E_MINOR',
    'Ab': 'A_FLAT_MAJOR_F_MINOR',
    'G#': 'A_FLAT_MAJOR_F_MINOR', // G# = Ab enharmonic
    'Fm': 'A_FLAT_MAJOR_F_MINOR',
    'A': 'A_MAJOR_G_FLAT_MINOR',
    'F#m': 'A_MAJOR_G_FLAT_MINOR',
    'Gbm': 'A_MAJOR_G_FLAT_MINOR', // Gbm = F#m enharmonic
    'Bb': 'B_FLAT_MAJOR_G_MINOR',
    'A#': 'B_FLAT_MAJOR_G_MINOR', // A# = Bb enharmonic
    'Gm': 'B_FLAT_MAJOR_G_MINOR',
    'B': 'B_MAJOR_A_FLAT_MINOR',
    'G#m': 'B_MAJOR_A_FLAT_MINOR',
    'Abm': 'B_MAJOR_A_FLAT_MINOR', // Abm = G#m enharmonic
  };

  // When keyScale is 'minor', try the minor variant first
  if (keyScale === 'minor') {
    const keyWithMinor = `${key}m`;
    if (keyMap[keyWithMinor]) return keyMap[keyWithMinor];
  }

  // Try direct match
  if (keyMap[key]) return keyMap[key];

  // Fallback to unspecified (let model decide)
  console.warn(`[Lyria] Unknown key "${key}" with scale "${keyScale}", falling back to SCALE_UNSPECIFIED`);
  return 'SCALE_UNSPECIFIED';
}

// Parse prompt string with weights like "jazz piano:0.7, ambient:0.3"
export function parseWeightedPrompts(promptString: string): LyriaWeightedPrompt[] {
  const parts = promptString.split(',').map(p => p.trim()).filter(p => p.length > 0);
  return parts.map(part => {
    const match = part.match(/^(.+?):(\d*\.?\d+)$/);
    if (match) {
      const text = match[1].trim();
      // Skip empty text after weight extraction
      if (!text) return null;
      return { text, weight: parseFloat(match[2]) };
    }
    return { text: part, weight: 1.0 };
  }).filter((p): p is LyriaWeightedPrompt => p !== null);
}

export interface LyriaSessionCallbacks {
  onStateChange?: (state: LyriaSessionState) => void;
  onError?: (error: Error) => void;
  onConfigApplied?: (config: LyriaConfig) => void;
  onRateLimitUpdate?: (limits: LyriaRateLimitStatus) => void;
}

/**
 * Lyria RealTime Session
 * Manages WebSocket connection and audio streaming for real-time music generation
 *
 * SECURITY: This class now requires authentication via setAuthToken().
 * The API key is fetched from the server via /api/lyria/connect.
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
  private audioQueue: AudioBuffer[] = [];
  private isProcessingAudio = false;
  private nextStartTime = 0;
  private scheduledSources: AudioBufferSourceNode[] = [];
  private setupComplete = false;
  private connectResolve: (() => void) | null = null;
  private connectReject: ((error: Error) => void) | null = null;

  // When true, audio is only sent to streamDestination (for external routing via AudioEngine)
  private useExternalRouting = false;

  // Authentication token (Supabase JWT)
  private authToken: string | null = null;

  // Current session ID for usage tracking
  private sessionId: string | null = null;

  // Rate limit status from last auth check
  private rateLimits: LyriaRateLimitStatus | null = null;

  // Bytes streamed for usage tracking
  private bytesStreamed = 0;

  // Session start time for tracking session duration
  private sessionStartTime: number | null = null;

  // Max session duration (from rate limits, default 600 seconds = 10 minutes)
  // NOTE: Google Lyria API has a hard 10-minute limit per session regardless of account type
  private maxSessionSeconds: number = 600;

  constructor() {
    // No API key needed - fetched from server after auth
  }

  /**
   * Get the time when the current session started
   * Returns null if not connected
   */
  getSessionStartTime(): number | null {
    return this.sessionStartTime;
  }

  /**
   * Get elapsed seconds since session started
   * Returns 0 if not connected
   */
  getSessionElapsedSeconds(): number {
    if (!this.sessionStartTime) return 0;
    return Math.floor((Date.now() - this.sessionStartTime) / 1000);
  }

  /**
   * Get remaining seconds in the session
   * Returns null if not connected, 0 if expired
   */
  getSessionRemainingSeconds(): number | null {
    if (!this.sessionStartTime) return null;
    const elapsed = this.getSessionElapsedSeconds();
    return Math.max(0, this.maxSessionSeconds - elapsed);
  }

  /**
   * Get max session duration in seconds
   */
  getMaxSessionSeconds(): number {
    return this.maxSessionSeconds;
  }

  /**
   * Set the authentication token (Supabase JWT)
   * Must be called before connect()
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Get current rate limit status
   * Available after calling connect() or checkRateLimits()
   */
  getRateLimits(): LyriaRateLimitStatus | null {
    return this.rateLimits;
  }

  /**
   * Check rate limits without connecting
   * Returns the current rate limit status from the server
   */
  async checkRateLimits(): Promise<LyriaRateLimitStatus> {
    if (!this.authToken) {
      throw new LyriaAuthError('Authentication required', 'AUTH_REQUIRED');
    }

    const response = await fetch('/api/lyria/connect', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new LyriaAuthError(
        data.error || 'Failed to check rate limits',
        data.code || 'NETWORK_ERROR',
        data.limits
      );
    }

    this.rateLimits = data.limits;
    this.callbacks.onRateLimitUpdate?.(data.limits);
    return data.limits;
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
   * Requires authentication - call setAuthToken() first
   */
  async connect(): Promise<void> {
    if (this.state !== 'disconnected' && this.state !== 'error') {
      throw new Error('Session already connected or connecting');
    }

    if (!this.authToken) {
      throw new LyriaAuthError('Authentication required - call setAuthToken() first', 'AUTH_REQUIRED');
    }

    this.setState('connecting');
    this.setupComplete = false;
    this.bytesStreamed = 0;

    try {
      // 1. Authenticate with server and get WebSocket URL
      const authResponse = await fetch('/api/lyria/connect', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          style: this.config.scale,
          bpm: this.config.bpm,
          prompt: this.prompts.map(p => p.text).join(', '),
        }),
      });

      const authData = await authResponse.json();

      if (!authResponse.ok) {
        this.setState('error');
        throw new LyriaAuthError(
          authData.error || 'Authentication failed',
          authData.code || 'CONNECTION_FAILED',
          authData.limits
        );
      }

      // Store session ID and rate limits
      this.sessionId = authData.sessionId;
      this.rateLimits = authData.limits;
      // NOTE: Google Lyria API has a hard 10-minute (600s) limit per session
      // Our app's maxSessionSeconds from rate limits is for internal tracking only
      // Always use 600 for the actual Google session limit
      this.maxSessionSeconds = 600;
      this.callbacks.onRateLimitUpdate?.(authData.limits);

      console.log('[Lyria] Authenticated, session:', this.sessionId, '(10-min Google limit)');

      // 2. Initialize Web Audio context
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

      // 3. Connect WebSocket using URL from server (contains API key)
      const wsUrl = authData.wsUrl;
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
   * Ends the usage session and reports bytes streamed
   */
  disconnect(): void {
    this.stop();

    // End the usage session
    if (this.sessionId && this.authToken) {
      fetch('/api/lyria/session/end', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: this.sessionId,
          bytesStreamed: this.bytesStreamed,
        }),
      }).catch((error) => {
        console.warn('[Lyria] Failed to end session:', error);
      });
      this.sessionId = null;
    }

    // Reset session timing
    this.sessionStartTime = null;

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
      // Filter out any prompts with empty text
      this.prompts = prompts.filter(p => p.text.trim().length > 0);
    }

    // Send new prompts if connected (works for playing, connected, or paused states)
    // Skip if no valid prompts to avoid API error for empty weighted_prompts
    const isActiveSession = this.state === 'playing' || this.state === 'connected' || this.state === 'paused';
    if (isActiveSession && this.ws?.readyState === WebSocket.OPEN && this.prompts.length > 0) {
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
  async play(): Promise<void> {
    if (this.state !== 'connected' && this.state !== 'paused') {
      console.warn('Cannot play: not connected');
      return;
    }

    // Must await resume before sending play command, otherwise audio won't play
    if (this.audioContext?.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('[Lyria] AudioContext resumed successfully');
      } catch (err) {
        console.warn('[Lyria] Failed to resume AudioContext:', err);
      }
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

    // Track bytes streamed for usage reporting
    this.bytesStreamed += data.byteLength;

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
      this.sessionStartTime = Date.now();
      console.log('[Lyria] Session started at:', this.sessionStartTime, 'max duration:', this.maxSessionSeconds, 'seconds');
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
 * Create a Lyria session
 *
 * SECURITY: The session requires authentication before connecting.
 * Call session.setAuthToken(token) with a valid Supabase JWT before calling connect().
 *
 * The API key is now stored server-side and retrieved securely via /api/lyria/connect
 * after validating the user's authentication and rate limits.
 */
export function createLyriaSession(): LyriaSession {
  return new LyriaSession();
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
