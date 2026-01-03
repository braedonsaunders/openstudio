/**
 * Native Audio Bridge Client
 *
 * Connects to the native OpenStudio Bridge application for ultra-low-latency
 * ASIO/CoreAudio audio I/O. Falls back to Web Audio API if bridge unavailable.
 */

import type { UnifiedEffectsChain, InputChannelConfig } from '@/types';

// === Message Types ===

interface BridgeDevice {
  id: string;
  name: string;
  isInput: boolean;
  isOutput: boolean;
  channels: { index: number; name: string }[];
  sampleRates: number[];
  isDefault: boolean;
  driverType: 'Asio' | 'Wasapi' | 'CoreAudio' | 'Alsa' | 'Jack' | 'Unknown';
}

interface BridgeLevels {
  inputLevel: number;
  inputPeak: number;
  outputLevel: number;
  outputPeak: number;
  remoteLevels: [string, number][];
}

interface BridgeAudioStatus {
  isRunning: boolean;
  inputLatencyMs: number;
  outputLatencyMs: number;
  totalLatencyMs: number;
}

interface EffectsMetering {
  trackId: string;
  noiseGateOpen: boolean;
  compressorReduction: number;
  limiterReduction: number;
}

interface BridgeStreamHealth {
  bufferOccupancy: number; // 0.0 - 1.0
  overflowCount: number;
  overflowSamples: number;
  isHealthy: boolean;
  msSinceLastRead: number;
}

// Native bridge sends snake_case, we normalize to camelCase
type NativeMessage =
  | { type: 'welcome'; version: string; driverType?: string; driver_type?: string }
  | { type: 'pong'; timestamp: number; nativeTime: number }
  | { type: 'error'; code: string; message: string }
  | { type: 'devices'; inputs: BridgeDevice[]; outputs: BridgeDevice[] }
  | { type: 'audioStatus' } & BridgeAudioStatus
  | { type: 'levels' } & BridgeLevels
  | { type: 'streamHealth' } & BridgeStreamHealth
  | { type: 'effectsMetering' } & EffectsMetering
  | { type: 'backingTrackLoaded'; duration: number; waveform: number[] }
  | { type: 'backingTrackPosition'; time: number }
  | { type: 'backingTrackEnded' };

// === Audio Data Types ===

export interface BridgeAudioData {
  msgType: number; // 1 = local capture from native bridge
  sampleCount: number;
  timestamp: number;
  trackId?: string; // Track identifier for multi-track audio
  samples: Float32Array; // Stereo interleaved samples
}

// Multi-track channel configuration
export interface TrackChannelConfig {
  trackId: string;
  channelCount: 1 | 2;
  leftChannel: number;
  rightChannel?: number;
}

// === Event Types ===

export type BridgeEventType =
  | 'connected'
  | 'disconnected'
  | 'devices'
  | 'levels'
  | 'audioStatus'
  | 'streamHealth'
  | 'effectsMetering'
  | 'audioData'
  | 'error';

type BridgeEventData = {
  connected: { version: string; driverType: string };
  disconnected: { reason: string };
  devices: { inputs: BridgeDevice[]; outputs: BridgeDevice[] };
  levels: BridgeLevels;
  audioStatus: BridgeAudioStatus;
  streamHealth: BridgeStreamHealth;
  effectsMetering: EffectsMetering;
  audioData: BridgeAudioData;
  error: { code: string; message: string };
};

type BridgeEventCallback<T extends BridgeEventType> = (data: BridgeEventData[T]) => void;

// === Native Bridge Client ===

export class NativeBridge {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectingPromise: Promise<boolean> | null = null;
  private listeners: Map<BridgeEventType, Set<BridgeEventCallback<any>>> = new Map();
  private isConnected = false;
  private version: string | null = null;
  private driverType: string | null = null;

  // Track last sent channel config to avoid redundant restarts
  private lastChannelConfig: { channelCount: number; leftChannel: number; rightChannel?: number } | null = null;

  // Singleton instance
  private static instance: NativeBridge | null = null;

  static getInstance(): NativeBridge {
    if (!NativeBridge.instance) {
      NativeBridge.instance = new NativeBridge();
    }
    return NativeBridge.instance;
  }

  private constructor() {
    // Initialize listener maps
    const eventTypes: BridgeEventType[] = [
      'connected',
      'disconnected',
      'devices',
      'levels',
      'audioStatus',
      'streamHealth',
      'effectsMetering',
      'audioData',
      'error',
    ];
    for (const type of eventTypes) {
      this.listeners.set(type, new Set());
    }
  }

  // === Connection Management ===

  /**
   * Attempt to connect to the native bridge
   * @returns Promise that resolves to true if connected, false if unavailable
   */
  async connect(): Promise<boolean> {
    if (this.isConnected) {
      return true;
    }

    // Prevent concurrent connection attempts - return existing promise if connecting
    if (this.connectingPromise) {
      console.log('[NativeBridge] Connection already in progress, waiting...');
      return this.connectingPromise;
    }

    this.connectingPromise = new Promise<boolean>((resolve) => {
      try {
        this.ws = new WebSocket('ws://127.0.0.1:9999');

        const cleanup = () => {
          this.connectingPromise = null;
        };

        const timeout = setTimeout(() => {
          this.ws?.close();
          cleanup();
          resolve(false);
        }, 2000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          console.log('[NativeBridge] Connected to native audio bridge');
        };

        this.ws.binaryType = 'arraybuffer';
        this.ws.onmessage = (event) => {
          if (event.data instanceof ArrayBuffer) {
            // Binary message - audio data
            this.handleBinaryMessage(event.data);
          } else {
            // Text message - JSON
            this.handleMessage(event.data);

            // First message should be welcome - mark as connected and resolve
            if (!this.isConnected) {
              this.isConnected = true;
              cleanup();
              resolve(true);
            }
          }
        };

        this.ws.onclose = () => {
          clearTimeout(timeout);
          const wasConnected = this.isConnected;
          this.isConnected = false;
          this.version = null;
          this.driverType = null;

          if (wasConnected) {
            console.log('[NativeBridge] Disconnected from native audio bridge');
            this.emit('disconnected', { reason: 'Connection closed' });
          }

          cleanup();
          resolve(false);
        };

        this.ws.onerror = () => {
          clearTimeout(timeout);
          cleanup();
          resolve(false);
        };
      } catch {
        this.connectingPromise = null;
        resolve(false);
      }
    });

    return this.connectingPromise;
  }

  /**
   * Disconnect from the native bridge
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
    // Reset cached config so next connection will properly configure
    this.lastChannelConfig = null;
  }

  /**
   * Check if connected to native bridge
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Get the driver type (ASIO, CoreAudio, WASAPI, etc.)
   */
  getDriverType(): string | null {
    return this.driverType;
  }

  // === Event Handling ===

  on<T extends BridgeEventType>(event: T, callback: BridgeEventCallback<T>): void {
    this.listeners.get(event)?.add(callback);
  }

  off<T extends BridgeEventType>(event: T, callback: BridgeEventCallback<T>): void {
    this.listeners.get(event)?.delete(callback);
  }

  /**
   * Remove all listeners for a specific event type.
   * Useful for ensuring only one handler exists (e.g., audioData handler).
   */
  removeAllListeners<T extends BridgeEventType>(event: T): void {
    this.listeners.get(event)?.clear();
  }

  /**
   * Get the number of listeners for a specific event type.
   * Useful for debugging duplicate listener issues.
   */
  getListenerCount<T extends BridgeEventType>(event: T): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  private emit<T extends BridgeEventType>(event: T, data: BridgeEventData[T]): void {
    this.listeners.get(event)?.forEach((callback) => callback(data));
  }

  private handleMessage(data: string): void {
    try {
      const msg = JSON.parse(data) as NativeMessage;
      // Only log significant messages (not high-frequency status updates)
      const quietMessages = ['levels', 'streamHealth'];
      if (!quietMessages.includes(msg.type)) {
        console.log('[NativeBridge] Received message:', msg.type);
      }

      switch (msg.type) {
        case 'welcome':
          this.version = msg.version;
          // Handle both camelCase and snake_case from native bridge
          const driverType = msg.driverType || msg.driver_type || 'Unknown';
          this.driverType = driverType;
          console.log('[NativeBridge] Welcome received, driver:', driverType);
          this.emit('connected', { version: msg.version, driverType });
          break;

        case 'devices':
          console.log('[NativeBridge] Devices received:', msg.inputs?.length, 'inputs,', msg.outputs?.length, 'outputs');
          this.emit('devices', { inputs: msg.inputs, outputs: msg.outputs });
          break;

        case 'levels':
          this.emit('levels', {
            inputLevel: msg.inputLevel,
            inputPeak: msg.inputPeak,
            outputLevel: msg.outputLevel,
            outputPeak: msg.outputPeak,
            remoteLevels: msg.remoteLevels,
          });
          break;

        case 'audioStatus':
          this.emit('audioStatus', {
            isRunning: msg.isRunning,
            inputLatencyMs: msg.inputLatencyMs,
            outputLatencyMs: msg.outputLatencyMs,
            totalLatencyMs: msg.totalLatencyMs,
          });
          break;

        case 'streamHealth':
          // Only log if there's an issue (overflow or unhealthy)
          if (msg.overflowCount > 0 || !msg.isHealthy) {
            console.warn('[NativeBridge] Stream health issue:', msg);
          }
          this.emit('streamHealth', {
            bufferOccupancy: msg.bufferOccupancy,
            overflowCount: msg.overflowCount,
            overflowSamples: msg.overflowSamples,
            isHealthy: msg.isHealthy,
            msSinceLastRead: msg.msSinceLastRead,
          });
          break;

        case 'effectsMetering':
          this.emit('effectsMetering', {
            trackId: msg.trackId,
            noiseGateOpen: msg.noiseGateOpen,
            compressorReduction: msg.compressorReduction,
            limiterReduction: msg.limiterReduction,
          });
          break;

        case 'error':
          console.error('[NativeBridge] Error:', msg.code, msg.message);
          this.emit('error', { code: msg.code, message: msg.message });
          break;

        case 'pong':
          // Handle latency measurement
          const rtt = Date.now() - msg.timestamp;
          console.log(`[NativeBridge] RTT: ${rtt}ms`);
          break;
      }
    } catch (e) {
      console.error('[NativeBridge] Failed to parse message:', e);
    }
  }

  // Counter for binary message logging
  private binaryMessageCounter = 0;

  /**
   * Handle binary audio data from native bridge
   * Format v1 (msgType=1): [msg_type: u8][sample_count: u32][timestamp: u64][samples: f32...]
   * Format v2 (msgType=2): [msg_type: u8][sample_count: u32][timestamp: u64][track_id_len: u8][track_id: utf8][samples: f32...]
   */
  private handleBinaryMessage(data: ArrayBuffer): void {
    try {
      const view = new DataView(data);

      // Parse header base (13 bytes)
      // Note: Rust uses little-endian by default with to_le_bytes
      const msgType = view.getUint8(0);
      const sampleCount = view.getUint32(1, true); // little-endian
      const timestamp = Number(view.getBigUint64(5, true)); // little-endian

      let headerSize = 13;
      let trackId: string | undefined;

      // Multi-track format includes track ID
      if (msgType === 2) {
        const trackIdLen = view.getUint8(13);
        if (trackIdLen > 0) {
          const trackIdBytes = new Uint8Array(data, 14, trackIdLen);
          trackId = new TextDecoder().decode(trackIdBytes);
        }
        headerSize = 14 + trackIdLen;
      }

      // Parse samples (f32 little-endian)
      // Need to slice buffer for proper alignment
      const samplesBuffer = data.slice(headerSize);
      const samplesData = new Float32Array(samplesBuffer);

      // Only log first message to confirm binary audio is working
      if (this.binaryMessageCounter++ === 0) {
        console.log('[NativeBridge] Binary audio streaming started');
      }

      // Emit audio data event
      this.emit('audioData', {
        msgType,
        sampleCount,
        timestamp,
        trackId,
        samples: samplesData,
      });
    } catch (e) {
      console.error('[NativeBridge] Failed to parse binary message:', e);
    }
  }

  // === Commands ===

  private send(message: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[NativeBridge] Sending message:', message);
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[NativeBridge] Cannot send - WebSocket not open. State:', this.ws?.readyState);
    }
  }

  /**
   * Send hello message with room/user info
   */
  hello(roomId?: string, userId?: string): void {
    this.send({
      type: 'hello',
      version: '1.0.0',
      room_id: roomId,
      user_id: userId,
    });
  }

  /**
   * Request list of audio devices
   */
  getDevices(): void {
    this.send({ type: 'getDevices' });
  }

  /**
   * Set input device
   */
  setInputDevice(deviceId: string): void {
    this.send({ type: 'setInputDevice', device_id: deviceId });
  }

  /**
   * Set output device
   */
  setOutputDevice(deviceId: string): void {
    this.send({ type: 'setOutputDevice', device_id: deviceId });
  }

  /**
   * Set channel configuration (global - for single track mode)
   * Only sends if config has actually changed to avoid unnecessary ASIO restarts
   */
  setChannelConfig(config: InputChannelConfig): void {
    // Check if config has changed to avoid redundant ASIO restarts
    const last = this.lastChannelConfig;
    if (
      last &&
      last.channelCount === config.channelCount &&
      last.leftChannel === config.leftChannel &&
      last.rightChannel === config.rightChannel
    ) {
      console.log('[NativeBridge] setChannelConfig: config unchanged, skipping');
      return;
    }

    this.lastChannelConfig = {
      channelCount: config.channelCount,
      leftChannel: config.leftChannel,
      rightChannel: config.rightChannel,
    };

    this.send({
      type: 'setChannelConfig',
      channelCount: config.channelCount,
      leftChannel: config.leftChannel,
      rightChannel: config.rightChannel,
    });
  }

  /**
   * Force send channel config even if unchanged (for initial setup)
   */
  forceSetChannelConfig(config: InputChannelConfig): void {
    this.lastChannelConfig = {
      channelCount: config.channelCount,
      leftChannel: config.leftChannel,
      rightChannel: config.rightChannel,
    };

    this.send({
      type: 'setChannelConfig',
      channelCount: config.channelCount,
      leftChannel: config.leftChannel,
      rightChannel: config.rightChannel,
    });
  }

  // Note: Multi-track channel config is handled in the browser, not the native bridge.
  // The native bridge captures audio as a single stream; per-track channel routing
  // is done by TrackAudioProcessor in the browser's Web Audio API.

  /**
   * Start audio capture and playback
   */
  startAudio(): void {
    this.send({ type: 'startAudio' });
  }

  /**
   * Stop audio
   */
  stopAudio(): void {
    this.send({ type: 'stopAudio' });
  }

  /**
   * Set buffer size
   */
  setBufferSize(size: 32 | 64 | 128 | 256 | 512 | 1024): void {
    this.send({ type: 'setBufferSize', size });
  }

  /**
   * Set sample rate
   */
  setSampleRate(rate: 44100 | 48000): void {
    this.send({ type: 'setSampleRate', rate });
  }

  /**
   * Update track state
   */
  updateTrackState(
    trackId: string,
    state: {
      isArmed?: boolean;
      isMuted?: boolean;
      isSolo?: boolean;
      volume?: number;
      pan?: number;
      inputGainDb?: number;
      monitoringEnabled?: boolean;
      monitoringVolume?: number;
    }
  ): void {
    console.log('[NativeBridge] updateTrackState:', { trackId, ...state });
    // Rust serde uses rename_all = "camelCase" so we send camelCase
    this.send({
      type: 'updateTrackState',
      trackId: trackId,
      isArmed: state.isArmed,
      isMuted: state.isMuted,
      isSolo: state.isSolo,
      volume: state.volume,
      pan: state.pan,
      inputGainDb: state.inputGainDb,
      monitoringEnabled: state.monitoringEnabled,
      monitoringVolume: state.monitoringVolume,
    });
  }

  /**
   * Update effects
   */
  updateEffects(trackId: string, effects: Partial<UnifiedEffectsChain>): void {
    // Log which effects are enabled for debugging
    const enabledEffects = Object.entries(effects)
      .filter(([, v]) => v && typeof v === 'object' && 'enabled' in v && v.enabled)
      .map(([k]) => k);
    console.log('[NativeBridge] updateEffects:', { trackId, enabledEffects });
    this.send({ type: 'updateEffects', trackId: trackId, effects });
  }

  /**
   * Set monitoring
   */
  setMonitoring(enabled: boolean, volume: number): void {
    this.send({ type: 'setMonitoring', enabled, volume });
  }

  /**
   * Set master volume
   */
  setMasterVolume(volume: number): void {
    this.send({ type: 'setMasterVolume', volume });
  }

  /**
   * Add remote user
   */
  addRemoteUser(userId: string, userName: string): void {
    this.send({ type: 'addRemoteUser', user_id: userId, user_name: userName });
  }

  /**
   * Remove remote user
   */
  removeRemoteUser(userId: string): void {
    this.send({ type: 'removeRemoteUser', user_id: userId });
  }

  /**
   * Update remote user settings
   */
  updateRemoteUser(
    userId: string,
    volume: number,
    muted: boolean,
    compensationDelayMs: number
  ): void {
    this.send({
      type: 'updateRemoteUser',
      user_id: userId,
      volume,
      muted,
      compensation_delay_ms: compensationDelayMs,
    });
  }

  /**
   * Load backing track
   */
  loadBackingTrack(url: string, duration: number): void {
    this.send({ type: 'loadBackingTrack', url, duration });
  }

  /**
   * Play backing track
   */
  playBackingTrack(syncTimestamp: number, offset: number): void {
    this.send({ type: 'playBackingTrack', sync_timestamp: syncTimestamp, offset });
  }

  /**
   * Stop backing track
   */
  stopBackingTrack(): void {
    this.send({ type: 'stopBackingTrack' });
  }

  /**
   * Seek backing track
   */
  seekBackingTrack(time: number): void {
    this.send({ type: 'seekBackingTrack', time });
  }

  /**
   * Set backing track volume
   */
  setBackingTrackVolume(volume: number): void {
    this.send({ type: 'setBackingTrackVolume', volume });
  }

  /**
   * Set stem state (for stem separation playback)
   */
  setStemState(stem: string, enabled: boolean, volume: number): void {
    this.send({ type: 'setStemState', stem, enabled, volume });
  }

  /**
   * Set master effects enabled
   */
  setMasterEffectsEnabled(enabled: boolean): void {
    this.send({ type: 'setMasterEffectsEnabled', enabled });
  }

  /**
   * Update master effects settings
   */
  updateMasterEffects(settings: {
    eq?: unknown;
    compressor?: unknown;
    reverb?: unknown;
    limiter?: unknown;
  }): void {
    this.send({
      type: 'updateMasterEffects',
      eq: settings.eq,
      compressor: settings.compressor,
      reverb: settings.reverb,
      limiter: settings.limiter,
    });
  }

  /**
   * Ping for latency measurement
   */
  ping(): void {
    this.send({ type: 'ping', timestamp: Date.now() });
  }

  /**
   * Send remote user audio to native bridge for mixing
   * Used to route WebRTC audio through the native audio engine
   * Format: [msg_type: 0][sample_count: u32][timestamp: u64][user_id_len: u8][user_id: utf8][samples: f32 LE...]
   */
  sendRemoteAudio(userId: string, samples: Float32Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const userIdBytes = new TextEncoder().encode(userId);
    const headerSize = 13; // msg_type(1) + sample_count(4) + timestamp(8)
    const totalSize = headerSize + 1 + userIdBytes.length + samples.length * 4;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    // Header
    view.setUint8(0, 0); // msg_type 0 = remote audio from browser
    view.setUint32(1, samples.length, true); // little-endian
    view.setBigUint64(5, BigInt(Date.now()), true); // little-endian

    // User ID length and bytes
    view.setUint8(headerSize, userIdBytes.length);
    new Uint8Array(buffer, headerSize + 1, userIdBytes.length).set(userIdBytes);

    // Samples as f32 little-endian
    const samplesView = new Float32Array(buffer, headerSize + 1 + userIdBytes.length);
    samplesView.set(samples);

    this.ws.send(buffer);
  }

  /**
   * Send backing track audio to native bridge
   * Format: [msg_type: 1][sample_count: u32][timestamp: u64][samples: f32 LE...]
   */
  sendBackingAudio(samples: Float32Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const headerSize = 13; // msg_type(1) + sample_count(4) + timestamp(8)
    const totalSize = headerSize + samples.length * 4;

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);

    // Header
    view.setUint8(0, 1); // msg_type 1 = backing track audio
    view.setUint32(1, samples.length, true); // little-endian
    view.setBigUint64(5, BigInt(Date.now()), true); // little-endian

    // Samples as f32 little-endian
    const samplesView = new Float32Array(buffer, headerSize);
    samplesView.set(samples);

    this.ws.send(buffer);
  }
}

// === Protocol Handler ===

/**
 * Launch the native bridge with room context
 */
export function launchNativeBridge(roomId: string, userId: string, token: string): void {
  const url = `openstudio://join?room=${encodeURIComponent(roomId)}&user=${encodeURIComponent(userId)}&token=${encodeURIComponent(token)}`;
  window.location.href = url;
}

/**
 * Check if native bridge is available (try to connect)
 */
export async function isNativeBridgeAvailable(): Promise<boolean> {
  const bridge = NativeBridge.getInstance();
  const connected = await bridge.connect();

  if (!connected) {
    bridge.disconnect();
  }

  return connected;
}

// R2 public URL - uses same bucket as tracks, files stored under bridge/ path
// This should match CLOUDFLARE_R2_PUBLIC_URL env var
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://cdn.openstudio.cafe';

/**
 * Get download URL for native bridge from Cloudflare R2
 */
export function getNativeBridgeDownloadUrl(): string {
  const baseUrl = `${R2_PUBLIC_URL}/bridge/latest`;
  const platform = navigator.platform.toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();

  if (platform.includes('win')) {
    return `${baseUrl}/openstudio-bridge-windows.exe`;
  } else if (platform.includes('mac')) {
    // Detect Apple Silicon vs Intel
    const isAppleSilicon = userAgent.includes('arm') ||
      (platform.includes('mac') && !userAgent.includes('intel'));

    if (isAppleSilicon) {
      return `${baseUrl}/openstudio-bridge-macos-arm64`;
    }
    return `${baseUrl}/openstudio-bridge-macos-x64`;
  } else if (platform.includes('linux')) {
    return `${baseUrl}/openstudio-bridge-linux`;
  }

  // Fallback to latest directory
  return baseUrl;
}

/**
 * Get all download URLs for all platforms
 */
export function getAllDownloadUrls(): Record<string, string> {
  const baseUrl = `${R2_PUBLIC_URL}/bridge/latest`;

  return {
    windows: `${baseUrl}/openstudio-bridge-windows.exe`,
    macosIntel: `${baseUrl}/openstudio-bridge-macos-x64`,
    macosArm: `${baseUrl}/openstudio-bridge-macos-arm64`,
    linux: `${baseUrl}/openstudio-bridge-linux`,
  };
}

/**
 * Get the current bridge version from R2
 */
export async function getLatestBridgeVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${R2_PUBLIC_URL}/bridge/latest/version.json`);
    if (res.ok) {
      const data = await res.json();
      return data.version;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

// Export singleton
export const nativeBridge = NativeBridge.getInstance();
