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

type NativeMessage =
  | { type: 'welcome'; version: string; driverType: string }
  | { type: 'pong'; timestamp: number; nativeTime: number }
  | { type: 'error'; code: string; message: string }
  | { type: 'devices'; inputs: BridgeDevice[]; outputs: BridgeDevice[] }
  | { type: 'audioStatus' } & BridgeAudioStatus
  | { type: 'levels' } & BridgeLevels
  | { type: 'effectsMetering' } & EffectsMetering
  | { type: 'backingTrackLoaded'; duration: number; waveform: number[] }
  | { type: 'backingTrackPosition'; time: number }
  | { type: 'backingTrackEnded' };

// === Event Types ===

export type BridgeEventType =
  | 'connected'
  | 'disconnected'
  | 'devices'
  | 'levels'
  | 'audioStatus'
  | 'effectsMetering'
  | 'error';

type BridgeEventData = {
  connected: { version: string; driverType: string };
  disconnected: { reason: string };
  devices: { inputs: BridgeDevice[]; outputs: BridgeDevice[] };
  levels: BridgeLevels;
  audioStatus: BridgeAudioStatus;
  effectsMetering: EffectsMetering;
  error: { code: string; message: string };
};

type BridgeEventCallback<T extends BridgeEventType> = (data: BridgeEventData[T]) => void;

// === Native Bridge Client ===

export class NativeBridge {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
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

    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket('ws://127.0.0.1:9999');

        const timeout = setTimeout(() => {
          this.ws?.close();
          resolve(false);
        }, 2000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          console.log('[NativeBridge] Connected to native audio bridge');
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);

          // First message should be welcome
          if (!this.isConnected) {
            this.isConnected = true;
            resolve(true);
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

          resolve(false);
        };

        this.ws.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
      } catch {
        resolve(false);
      }
    });
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

      switch (msg.type) {
        case 'welcome':
          this.version = msg.version;
          this.driverType = msg.driverType;
          this.emit('connected', { version: msg.version, driverType: msg.driverType });
          break;

        case 'devices':
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

  // === Commands ===

  private send(message: object): void {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send hello message with room/user info
   */
  hello(roomId?: string, userId?: string): void {
    this.send({
      type: 'hello',
      version: '1.0.0',
      roomId,
      userId,
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
    this.send({ type: 'setInputDevice', deviceId });
  }

  /**
   * Set output device
   */
  setOutputDevice(deviceId: string): void {
    this.send({ type: 'setOutputDevice', deviceId });
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
    this.send({ type: 'updateTrackState', trackId, ...state });
  }

  /**
   * Update effects
   */
  updateEffects(trackId: string, effects: Partial<UnifiedEffectsChain>): void {
    this.send({ type: 'updateEffects', trackId, effects });
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
    this.send({ type: 'addRemoteUser', userId, userName });
  }

  /**
   * Remove remote user
   */
  removeRemoteUser(userId: string): void {
    this.send({ type: 'removeRemoteUser', userId });
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
    this.send({ type: 'updateRemoteUser', userId, volume, muted, compensationDelayMs });
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
    this.send({ type: 'playBackingTrack', syncTimestamp, offset });
  }

  /**
   * Stop backing track
   */
  stopBackingTrack(): void {
    this.send({ type: 'stopBackingTrack' });
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

/**
 * Get download URL for native bridge
 */
export function getNativeBridgeDownloadUrl(): string {
  const platform = navigator.platform.toLowerCase();

  if (platform.includes('win')) {
    return '/downloads/openstudio-bridge-windows.exe';
  } else if (platform.includes('mac')) {
    return '/downloads/openstudio-bridge-macos.dmg';
  } else if (platform.includes('linux')) {
    return '/downloads/openstudio-bridge-linux.AppImage';
  }

  return '/downloads';
}

// Export singleton
export const nativeBridge = NativeBridge.getInstance();
