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

// Native bridge sends snake_case, we normalize to camelCase
type NativeMessage =
  | { type: 'welcome'; version: string; driverType?: string; driver_type?: string }
  | { type: 'pong'; timestamp: number; nativeTime: number }
  | { type: 'error'; code: string; message: string }
  | { type: 'devices'; inputs: BridgeDevice[]; outputs: BridgeDevice[] }
  | { type: 'audioStatus' } & BridgeAudioStatus
  | { type: 'levels' } & BridgeLevels
  | { type: 'effectsMetering' } & EffectsMetering
  | { type: 'backingTrackLoaded'; duration: number; waveform: number[] }
  | { type: 'backingTrackPosition'; time: number }
  | { type: 'backingTrackEnded' };

// === Audio Data Types ===

export interface BridgeAudioData {
  msgType: number; // 1 = local capture from native bridge
  sampleCount: number;
  timestamp: number;
  samples: Float32Array; // Stereo interleaved samples
}

// === Event Types ===

export type BridgeEventType =
  | 'connected'
  | 'disconnected'
  | 'devices'
  | 'levels'
  | 'audioStatus'
  | 'effectsMetering'
  | 'audioData'
  | 'error';

type BridgeEventData = {
  connected: { version: string; driverType: string };
  disconnected: { reason: string };
  devices: { inputs: BridgeDevice[]; outputs: BridgeDevice[] };
  levels: BridgeLevels;
  audioStatus: BridgeAudioStatus;
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

  private emit<T extends BridgeEventType>(event: T, data: BridgeEventData[T]): void {
    this.listeners.get(event)?.forEach((callback) => callback(data));
  }

  private handleMessage(data: string): void {
    try {
      const msg = JSON.parse(data) as NativeMessage;
      // Only log non-levels messages to avoid console spam
      if (msg.type !== 'levels') {
        console.log('[NativeBridge] Received message:', msg.type, msg);
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

  /**
   * Handle binary audio data from native bridge
   * Format: [msg_type: u8][sample_count: u32][timestamp: u64][samples: f32...]
   */
  private handleBinaryMessage(data: ArrayBuffer): void {
    try {
      const view = new DataView(data);

      // Parse header (13 bytes total)
      // Note: Rust uses little-endian by default with to_le_bytes
      const msgType = view.getUint8(0);
      const sampleCount = view.getUint32(1, true); // little-endian
      const timestamp = Number(view.getBigUint64(5, true)); // little-endian

      // Parse samples (f32 little-endian)
      // Header is 13 bytes, but Float32Array requires 4-byte alignment
      // So we slice the buffer to create a new aligned ArrayBuffer
      const headerSize = 13;
      const samplesBuffer = data.slice(headerSize);
      const samplesData = new Float32Array(samplesBuffer);

      // Emit audio data event
      this.emit('audioData', {
        msgType,
        sampleCount,
        timestamp,
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
   * Set channel configuration
   */
  setChannelConfig(config: InputChannelConfig): void {
    this.send({
      type: 'setChannelConfig',
      channelCount: config.channelCount,
      leftChannel: config.leftChannel,
      rightChannel: config.rightChannel,
    });
  }

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
      inputGainDb: state.inputGainDb,
      monitoringEnabled: state.monitoringEnabled,
      monitoringVolume: state.monitoringVolume,
    });
  }

  /**
   * Update effects
   */
  updateEffects(trackId: string, effects: Partial<UnifiedEffectsChain>): void {
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
