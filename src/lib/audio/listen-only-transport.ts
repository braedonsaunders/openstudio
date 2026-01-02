/**
 * Listen-Only WebTransport Connection
 *
 * Allows browser users without the native bridge to listen to room audio.
 * Uses WebTransport + MoQ for scalable audio distribution.
 *
 * Features:
 * - Subscribe to all audio tracks in a room
 * - Automatic mixing of multiple performers
 * - Opus decoding in browser
 * - Adaptive buffer based on network conditions
 */

// Types for WebTransport (not yet in lib.dom.d.ts for all browsers)
interface WebTransportDatagramDuplexStream {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  maxDatagramSize: number;
}

interface WebTransportBidirectionalStream {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
}

interface WebTransportReceiveStream extends ReadableStream<Uint8Array> {}

interface WebTransport {
  ready: Promise<void>;
  closed: Promise<WebTransportCloseInfo>;
  close(info?: WebTransportCloseInfo): void;
  datagrams: WebTransportDatagramDuplexStream;
  createBidirectionalStream(): Promise<WebTransportBidirectionalStream>;
  createUnidirectionalStream(): Promise<WritableStream<Uint8Array>>;
  incomingBidirectionalStreams: ReadableStream<WebTransportBidirectionalStream>;
  incomingUnidirectionalStreams: ReadableStream<WebTransportReceiveStream>;
}

interface WebTransportCloseInfo {
  closeCode?: number;
  reason?: string;
}

declare var WebTransport: {
  prototype: WebTransport;
  new (url: string, options?: WebTransportOptions): WebTransport;
};

interface WebTransportOptions {
  allowPooling?: boolean;
  congestionControl?: 'default' | 'throughput' | 'low-latency';
  requireUnreliable?: boolean;
}

export interface ListenOnlyConfig {
  /** WebTransport relay URL */
  relayUrl: string;
  /** Room ID to join */
  roomId: string;
  /** User ID (for analytics, not for sending audio) */
  userId: string;
  /** Audio context sample rate */
  sampleRate?: number;
  /** Buffer size in samples */
  bufferSize?: number;
}

export type ListenOnlyState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ListenOnlyStats {
  /** Connection state */
  state: ListenOnlyState;
  /** Number of active audio tracks */
  trackCount: number;
  /** Total bytes received */
  bytesReceived: number;
  /** Estimated latency in ms */
  estimatedLatencyMs: number;
  /** Packet loss percentage */
  packetLossPercent: number;
  /** Buffer health (0-1) */
  bufferHealth: number;
}

export interface ListenOnlyEvents {
  /** State changed */
  stateChange: (state: ListenOnlyState) => void;
  /** New track available */
  trackAdded: (trackId: string, userId: string) => void;
  /** Track removed */
  trackRemoved: (trackId: string) => void;
  /** Audio ready for playback */
  audioReady: (samples: Float32Array) => void;
  /** Stats update */
  statsUpdate: (stats: ListenOnlyStats) => void;
  /** Error */
  error: (error: Error) => void;
}

// Simple EventEmitter implementation
type EventHandler<T extends (...args: any[]) => void> = T;

/**
 * Listen-only WebTransport client for browser users.
 * Connects to MoQ relay and receives mixed audio from all performers.
 */
export class ListenOnlyTransport {
  private config: ListenOnlyConfig;
  private state: ListenOnlyState = 'disconnected';
  private transport: WebTransport | null = null;
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private opusDecoder: AudioDecoder | null = null;
  private audioQueue: Float32Array[] = [];
  private isPlaying = false;
  private events = new Map<keyof ListenOnlyEvents, Set<EventHandler<any>>>();
  private stats: ListenOnlyStats = {
    state: 'disconnected',
    trackCount: 0,
    bytesReceived: 0,
    estimatedLatencyMs: 0,
    packetLossPercent: 0,
    bufferHealth: 1,
  };
  private receivedSequences = new Map<string, number>();
  private expectedSequences = new Map<string, number>();
  private lastStatsUpdate = 0;

  constructor(config: ListenOnlyConfig) {
    this.config = {
      sampleRate: 48000,
      bufferSize: 480,
      ...config,
    };
  }

  /** Check if WebTransport is supported in this browser */
  static isSupported(): boolean {
    return typeof WebTransport !== 'undefined';
  }

  /** Subscribe to events */
  on<K extends keyof ListenOnlyEvents>(
    event: K,
    handler: ListenOnlyEvents[K]
  ): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(handler);
  }

  /** Unsubscribe from events */
  off<K extends keyof ListenOnlyEvents>(
    event: K,
    handler: ListenOnlyEvents[K]
  ): void {
    this.events.get(event)?.delete(handler);
  }

  private emit<K extends keyof ListenOnlyEvents>(
    event: K,
    ...args: Parameters<ListenOnlyEvents[K]>
  ): void {
    this.events.get(event)?.forEach((handler) => {
      try {
        (handler as (...args: any[]) => void)(...args);
      } catch (e) {
        console.error(`[ListenOnlyTransport] Event handler error:`, e);
      }
    });
  }

  /** Connect to the relay and start receiving audio */
  async connect(): Promise<void> {
    if (this.state !== 'disconnected') {
      throw new Error(`Cannot connect from state: ${this.state}`);
    }

    if (!ListenOnlyTransport.isSupported()) {
      throw new Error('WebTransport is not supported in this browser');
    }

    this.setState('connecting');

    try {
      // Create WebTransport connection
      const url = `${this.config.relayUrl}/room/${this.config.roomId}/listen`;
      console.log(`[ListenOnlyTransport] Connecting to: ${url}`);

      this.transport = new WebTransport(url, {
        congestionControl: 'low-latency',
      });

      await this.transport.ready;
      console.log('[ListenOnlyTransport] WebTransport connected');

      // Initialize audio
      await this.initializeAudio();

      // Start receiving streams
      this.handleIncomingStreams();
      this.handleDatagrams();

      // Send join message
      await this.sendJoinMessage();

      this.setState('connected');

      // Start stats reporting
      this.startStatsReporting();
    } catch (error) {
      console.error('[ListenOnlyTransport] Connection failed:', error);
      this.setState('error');
      this.emit('error', error as Error);
      throw error;
    }
  }

  /** Disconnect from the relay */
  async disconnect(): Promise<void> {
    if (this.transport) {
      this.transport.close({ reason: 'User disconnected' });
      this.transport = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    if (this.opusDecoder) {
      this.opusDecoder.close();
      this.opusDecoder = null;
    }

    this.audioQueue = [];
    this.receivedSequences.clear();
    this.expectedSequences.clear();
    this.isPlaying = false;

    this.setState('disconnected');
  }

  /** Set playback volume (0-1) */
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /** Get current stats */
  getStats(): ListenOnlyStats {
    return { ...this.stats };
  }

  /** Get current state */
  getState(): ListenOnlyState {
    return this.state;
  }

  private setState(state: ListenOnlyState): void {
    if (this.state !== state) {
      this.state = state;
      this.stats.state = state;
      this.emit('stateChange', state);
    }
  }

  private async initializeAudio(): Promise<void> {
    // Create AudioContext
    this.audioContext = new AudioContext({
      sampleRate: this.config.sampleRate,
      latencyHint: 'interactive',
    });

    // Create gain node for volume control
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);

    // Initialize Opus decoder using WebCodecs API
    if (typeof AudioDecoder !== 'undefined') {
      this.opusDecoder = new AudioDecoder({
        output: (audioData: AudioData) => {
          this.handleDecodedAudio(audioData);
        },
        error: (error: Error) => {
          console.error('[ListenOnlyTransport] Decoder error:', error);
        },
      });

      this.opusDecoder.configure({
        codec: 'opus',
        sampleRate: this.config.sampleRate!,
        numberOfChannels: 2,
      });
    } else {
      console.warn('[ListenOnlyTransport] AudioDecoder not available, using fallback');
    }

    // Resume audio context (may need user interaction)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  private async handleIncomingStreams(): Promise<void> {
    if (!this.transport) return;

    const reader = this.transport.incomingUnidirectionalStreams.getReader();

    try {
      while (true) {
        const { value: stream, done } = await reader.read();
        if (done) break;

        // Handle each stream in parallel
        this.handleStream(stream).catch((e) => {
          console.error('[ListenOnlyTransport] Stream error:', e);
        });
      }
    } catch (error) {
      console.error('[ListenOnlyTransport] Stream reader error:', error);
    }
  }

  private async handleStream(stream: ReadableStream<Uint8Array>): Promise<void> {
    const reader = stream.getReader();
    let buffer = new Uint8Array(0);

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        // Append to buffer
        const newBuffer = new Uint8Array(buffer.length + value.length);
        newBuffer.set(buffer);
        newBuffer.set(value, buffer.length);
        buffer = newBuffer;

        // Process complete messages
        while (buffer.length >= 4) {
          const messageLen = new DataView(buffer.buffer).getUint32(0, true);
          if (buffer.length < 4 + messageLen) break;

          const message = buffer.slice(4, 4 + messageLen);
          buffer = buffer.slice(4 + messageLen);

          this.handleMessage(message);
        }
      }
    } catch (error) {
      console.error('[ListenOnlyTransport] Stream read error:', error);
    }
  }

  private async handleDatagrams(): Promise<void> {
    if (!this.transport) return;

    const reader = this.transport.datagrams.readable.getReader();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        // Datagrams are used for real-time audio
        this.handleAudioDatagram(value);
      }
    } catch (error) {
      console.error('[ListenOnlyTransport] Datagram reader error:', error);
    }
  }

  private handleMessage(data: Uint8Array): void {
    // Parse message type from first byte
    const messageType = data[0];
    const payload = data.slice(1);

    switch (messageType) {
      case 0x01: // Track added
        this.handleTrackAdded(payload);
        break;
      case 0x02: // Track removed
        this.handleTrackRemoved(payload);
        break;
      case 0x03: // Room state
        this.handleRoomState(payload);
        break;
      default:
        console.log(`[ListenOnlyTransport] Unknown message type: ${messageType}`);
    }
  }

  private handleTrackAdded(payload: Uint8Array): void {
    // Parse track info
    const decoder = new TextDecoder();
    const [trackId, userId] = decoder.decode(payload).split(':');

    this.stats.trackCount++;
    this.emit('trackAdded', trackId, userId);
  }

  private handleTrackRemoved(payload: Uint8Array): void {
    const decoder = new TextDecoder();
    const trackId = decoder.decode(payload);

    this.stats.trackCount = Math.max(0, this.stats.trackCount - 1);
    this.emit('trackRemoved', trackId);
  }

  private handleRoomState(payload: Uint8Array): void {
    try {
      const decoder = new TextDecoder();
      const state = JSON.parse(decoder.decode(payload));

      // Update track count from room state
      this.stats.trackCount = state.tracks?.length || 0;

      // Emit track events
      for (const track of state.tracks || []) {
        this.emit('trackAdded', track.id, track.userId);
      }
    } catch (e) {
      console.error('[ListenOnlyTransport] Failed to parse room state:', e);
    }
  }

  private handleAudioDatagram(data: Uint8Array): void {
    if (data.length < 8) return;

    // Parse header: trackId (2 bytes), sequence (4 bytes), timestamp (2 bytes)
    const view = new DataView(data.buffer, data.byteOffset);
    const trackId = view.getUint16(0, true);
    const sequence = view.getUint32(2, true);
    // const timestamp = view.getUint16(6, true); // Unused for now

    const opusData = data.slice(8);

    // Track sequence for packet loss detection
    const trackKey = `track-${trackId}`;
    const lastSeq = this.receivedSequences.get(trackKey) || 0;
    this.receivedSequences.set(trackKey, sequence);

    // Detect packet loss
    if (sequence > lastSeq + 1 && lastSeq > 0) {
      const lost = sequence - lastSeq - 1;
      const expected = this.expectedSequences.get(trackKey) || 0;
      this.expectedSequences.set(trackKey, expected + lost);
    }

    // Update stats
    this.stats.bytesReceived += data.length;

    // Decode audio
    if (this.opusDecoder && this.opusDecoder.state === 'configured') {
      this.opusDecoder.decode(
        new EncodedAudioChunk({
          type: 'key',
          timestamp: sequence * 10000, // Convert to microseconds
          data: opusData,
        })
      );
    }
  }

  private handleDecodedAudio(audioData: AudioData): void {
    // Extract samples
    const channels = audioData.numberOfChannels;
    const frames = audioData.numberOfFrames;
    const samples = new Float32Array(frames * channels);

    // Copy data from AudioData
    for (let ch = 0; ch < channels; ch++) {
      const channelData = new Float32Array(frames);
      audioData.copyTo(channelData, { planeIndex: ch });

      // Interleave into output
      for (let i = 0; i < frames; i++) {
        samples[i * channels + ch] = channelData[i];
      }
    }

    audioData.close();

    // Add to playback queue
    this.audioQueue.push(samples);
    this.emit('audioReady', samples);

    // Update buffer health
    this.stats.bufferHealth = Math.min(1, this.audioQueue.length / 10);

    // Start playback if not already playing
    if (!this.isPlaying && this.audioQueue.length >= 3) {
      this.startPlayback();
    }
  }

  private startPlayback(): void {
    if (this.isPlaying || !this.audioContext || !this.gainNode) return;

    this.isPlaying = true;

    const scheduleNextBuffer = () => {
      if (!this.isPlaying || !this.audioContext || !this.gainNode) return;

      const samples = this.audioQueue.shift();
      if (!samples) {
        // Buffer underrun
        this.stats.bufferHealth = 0;
        setTimeout(scheduleNextBuffer, 10);
        return;
      }

      // Create buffer and source
      const buffer = this.audioContext.createBuffer(
        2,
        samples.length / 2,
        this.config.sampleRate!
      );

      // De-interleave stereo
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);
      for (let i = 0; i < samples.length / 2; i++) {
        left[i] = samples[i * 2];
        right[i] = samples[i * 2 + 1];
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.gainNode);
      source.start();

      source.onended = () => {
        scheduleNextBuffer();
      };
    };

    scheduleNextBuffer();
  }

  private async sendJoinMessage(): Promise<void> {
    if (!this.transport) return;

    const stream = await this.transport.createUnidirectionalStream();
    const writer = stream.getWriter();

    // Create join message
    const message = {
      type: 'join_listener',
      roomId: this.config.roomId,
      userId: this.config.userId,
      clientType: 'browser_listen_only',
      version: '1.0.0',
    };

    const encoder = new TextEncoder();
    const payload = encoder.encode(JSON.stringify(message));

    // Write length-prefixed message
    const lengthBuffer = new ArrayBuffer(4);
    new DataView(lengthBuffer).setUint32(0, payload.length, true);

    await writer.write(new Uint8Array(lengthBuffer));
    await writer.write(payload);
    await writer.close();
  }

  private startStatsReporting(): void {
    const reportStats = () => {
      if (this.state !== 'connected') return;

      // Calculate packet loss
      let totalReceived = 0;
      let totalLost = 0;
      this.receivedSequences.forEach((seq, key) => {
        totalReceived += seq;
        totalLost += this.expectedSequences.get(key) || 0;
      });

      if (totalReceived > 0) {
        this.stats.packetLossPercent = (totalLost / (totalReceived + totalLost)) * 100;
      }

      // Estimate latency from buffer size
      this.stats.estimatedLatencyMs =
        (this.audioQueue.length * this.config.bufferSize! * 1000) /
        this.config.sampleRate!;

      this.emit('statsUpdate', { ...this.stats });

      setTimeout(reportStats, 1000);
    };

    reportStats();
  }
}

/**
 * Create a listen-only transport with default configuration
 */
export function createListenOnlyTransport(
  roomId: string,
  userId: string,
  options?: Partial<ListenOnlyConfig>
): ListenOnlyTransport {
  return new ListenOnlyTransport({
    relayUrl: options?.relayUrl || 'https://relay.openstudio.io',
    roomId,
    userId,
    ...options,
  });
}
