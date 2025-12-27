// Core Audio Engine for OpenStudio
// Manages all audio processing, routing, and playback

import { AdaptiveJitterBuffer } from './jitter-buffer';
import type { AudioStream, JitterStats, StemMixState, BackingTrack } from '@/types';

export interface AudioEngineConfig {
  sampleRate: 48000 | 44100;
  bufferSize: 128 | 256 | 512 | 1024;
  autoJitterBuffer: boolean;
  enableProcessing: boolean;
}

const defaultConfig: AudioEngineConfig = {
  sampleRate: 48000,
  bufferSize: 256,
  autoJitterBuffer: true,
  enableProcessing: true,
};

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private config: AudioEngineConfig;
  private jitterBuffer: AdaptiveJitterBuffer;
  private masterGain: GainNode | null = null;
  private backingTrackGain: GainNode | null = null;
  private localStream: MediaStream | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private remoteStreams: Map<string, AudioStream> = new Map();
  private backingTrackSource: AudioBufferSourceNode | null = null;
  private backingTrackBuffer: AudioBuffer | null = null;
  private stemSources: Map<string, AudioBufferSourceNode> = new Map();
  private stemBuffers: Map<string, AudioBuffer> = new Map();
  private stemGains: Map<string, GainNode> = new Map();
  private stemMixState: StemMixState = {
    vocals: { enabled: true, volume: 1 },
    drums: { enabled: true, volume: 1 },
    bass: { enabled: true, volume: 1 },
    other: { enabled: true, volume: 1 },
  };
  private isPlaying = false;
  private playbackStartTime = 0;
  private playbackOffset = 0;
  private workletNode: AudioWorkletNode | null = null;
  private onLevelUpdate: ((levels: Map<string, number>) => void) | null = null;
  private levelUpdateInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<AudioEngineConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.jitterBuffer = new AdaptiveJitterBuffer({
      sampleRate: this.config.sampleRate,
    });
  }

  async initialize(): Promise<void> {
    // Create audio context with optimal settings for low latency
    this.audioContext = new AudioContext({
      sampleRate: this.config.sampleRate,
      latencyHint: 'interactive',
    });

    // Create master gain node
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);

    // Create backing track gain node
    this.backingTrackGain = this.audioContext.createGain();
    this.backingTrackGain.connect(this.masterGain);

    // Load audio worklet processor
    try {
      await this.audioContext.audioWorklet.addModule('/audio/worklet-processor.js');
      this.workletNode = new AudioWorkletNode(this.audioContext, 'openstudio-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        processorOptions: {
          bufferSize: this.config.bufferSize,
        },
      });
      this.workletNode.connect(this.masterGain);
    } catch (error) {
      console.warn('AudioWorklet not available, falling back to ScriptProcessor:', error);
    }

    // Start level monitoring
    this.startLevelMonitoring();
  }

  async captureLocalAudio(): Promise<MediaStream> {
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false, // Disable for instruments
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: this.config.sampleRate,
        channelCount: 2,
      },
    });

    if (this.audioContext) {
      const source = this.audioContext.createMediaStreamSource(this.localStream);
      this.localAnalyser = this.audioContext.createAnalyser();
      this.localAnalyser.fftSize = 256;
      source.connect(this.localAnalyser);
    }

    return this.localStream;
  }

  addRemoteStream(userId: string, stream: MediaStream): void {
    if (!this.audioContext || !this.masterGain) return;

    const source = this.audioContext.createMediaStreamSource(stream);
    const gainNode = this.audioContext.createGain();
    const analyser = this.audioContext.createAnalyser();
    analyser.fftSize = 256;

    source.connect(gainNode);
    gainNode.connect(analyser);
    gainNode.connect(this.masterGain);

    this.remoteStreams.set(userId, {
      userId,
      stream,
      analyser,
      gainNode,
      level: 0,
    });
  }

  removeRemoteStream(userId: string): void {
    const streamData = this.remoteStreams.get(userId);
    if (streamData) {
      streamData.gainNode?.disconnect();
      streamData.stream.getTracks().forEach((track) => track.stop());
      this.remoteStreams.delete(userId);
    }
  }

  setRemoteVolume(userId: string, volume: number): void {
    const streamData = this.remoteStreams.get(userId);
    if (streamData?.gainNode) {
      streamData.gainNode.gain.value = volume;
    }
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
  }

  setBackingTrackVolume(volume: number): void {
    if (this.backingTrackGain) {
      this.backingTrackGain.gain.value = volume;
    }
  }

  async loadBackingTrack(url: string): Promise<void> {
    if (!this.audioContext) {
      console.error('Audio context not initialized');
      throw new Error('Audio context not initialized');
    }

    // Resume audio context if suspended (browser requires user interaction)
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) {
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      this.backingTrackBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      console.log('Backing track loaded successfully, duration:', this.backingTrackBuffer.duration);
    } catch (error) {
      console.error('Failed to load backing track:', error);
      throw error;
    }
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  async loadStem(stemType: string, url: string): Promise<void> {
    if (!this.audioContext) return;

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.stemBuffers.set(stemType, buffer);
  }

  playBackingTrack(syncTimestamp: number, offset: number = 0): void {
    if (!this.audioContext || !this.backingTrackBuffer || !this.backingTrackGain) {
      console.error('Cannot play: audio context, buffer, or gain not ready');
      return;
    }

    // Resume if suspended
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.stopBackingTrack();

    // Calculate start time based on sync timestamp
    const now = Date.now();
    const delay = Math.max(0, syncTimestamp - now) / 1000;

    this.backingTrackSource = this.audioContext.createBufferSource();
    this.backingTrackSource.buffer = this.backingTrackBuffer;
    this.backingTrackSource.connect(this.backingTrackGain);

    const startTime = this.audioContext.currentTime + delay;
    this.backingTrackSource.start(startTime, offset);

    this.playbackStartTime = startTime;
    this.playbackOffset = offset;
    this.isPlaying = true;
  }

  playStemmedTrack(syncTimestamp: number, offset: number = 0): void {
    if (!this.audioContext || !this.backingTrackGain) return;

    this.stopStemmedTrack();

    const now = Date.now();
    const delay = Math.max(0, syncTimestamp - now) / 1000;
    const startTime = this.audioContext.currentTime + delay;

    // Play each stem that is enabled
    for (const [stemType, buffer] of this.stemBuffers.entries()) {
      const stemState = this.stemMixState[stemType as keyof StemMixState];
      if (!stemState?.enabled) continue;

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      let gainNode = this.stemGains.get(stemType);
      if (!gainNode) {
        gainNode = this.audioContext.createGain();
        gainNode.connect(this.backingTrackGain);
        this.stemGains.set(stemType, gainNode);
      }
      gainNode.gain.value = stemState.volume;

      source.connect(gainNode);
      source.start(startTime, offset);

      this.stemSources.set(stemType, source);
    }

    this.playbackStartTime = startTime;
    this.playbackOffset = offset;
    this.isPlaying = true;
  }

  stopBackingTrack(): void {
    if (this.backingTrackSource) {
      try {
        this.backingTrackSource.stop();
      } catch (e) {
        // Already stopped
      }
      this.backingTrackSource.disconnect();
      this.backingTrackSource = null;
    }
    this.isPlaying = false;
  }

  stopStemmedTrack(): void {
    for (const source of this.stemSources.values()) {
      try {
        source.stop();
      } catch (e) {
        // Already stopped
      }
      source.disconnect();
    }
    this.stemSources.clear();
    this.isPlaying = false;
  }

  setStemEnabled(stemType: string, enabled: boolean): void {
    const state = this.stemMixState[stemType as keyof StemMixState];
    if (state) {
      state.enabled = enabled;
    }

    // If currently playing, update the stem
    if (this.isPlaying && this.stemSources.has(stemType)) {
      const gainNode = this.stemGains.get(stemType);
      if (gainNode) {
        gainNode.gain.value = enabled ? state.volume : 0;
      }
    }
  }

  setStemVolume(stemType: string, volume: number): void {
    const state = this.stemMixState[stemType as keyof StemMixState];
    if (state) {
      state.volume = volume;
    }

    const gainNode = this.stemGains.get(stemType);
    if (gainNode && state?.enabled) {
      gainNode.gain.value = volume;
    }
  }

  getCurrentTime(): number {
    if (!this.audioContext || !this.isPlaying) return this.playbackOffset;
    return this.playbackOffset + (this.audioContext.currentTime - this.playbackStartTime);
  }

  getDuration(): number {
    return this.backingTrackBuffer?.duration || 0;
  }

  /**
   * Extract waveform data from the loaded backing track buffer
   * @param numBars Number of bars/samples to generate for visualization
   * @returns Normalized array of amplitude values (0-1)
   */
  extractWaveformData(numBars: number = 200): number[] {
    if (!this.backingTrackBuffer) return [];

    const channelData = this.backingTrackBuffer.getChannelData(0);
    const samplesPerBar = Math.floor(channelData.length / numBars);
    const waveform: number[] = [];

    for (let i = 0; i < numBars; i++) {
      let sum = 0;
      const start = i * samplesPerBar;
      const end = Math.min(start + samplesPerBar, channelData.length);

      for (let j = start; j < end; j++) {
        sum += Math.abs(channelData[j]);
      }
      waveform.push(sum / (end - start));
    }

    // Normalize to 0-1 range
    const max = Math.max(...waveform);
    if (max === 0) return waveform.map(() => 0.5);

    return waveform.map((v) => Math.max(0.1, v / max));
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying;
  }

  updateJitterBuffer(stats: JitterStats): number {
    if (!this.config.autoJitterBuffer) {
      return this.config.bufferSize;
    }
    return this.jitterBuffer.update(stats);
  }

  getJitterStats(): JitterStats {
    return this.jitterBuffer.getStats();
  }

  getConnectionQuality(): 'excellent' | 'good' | 'fair' | 'poor' {
    return this.jitterBuffer.getConnectionQuality();
  }

  setOnLevelUpdate(callback: (levels: Map<string, number>) => void): void {
    this.onLevelUpdate = callback;
  }

  private startLevelMonitoring(): void {
    this.levelUpdateInterval = setInterval(() => {
      const levels = new Map<string, number>();

      // Local level
      if (this.localAnalyser) {
        const data = new Uint8Array(this.localAnalyser.frequencyBinCount);
        this.localAnalyser.getByteFrequencyData(data);
        const level = data.reduce((sum, val) => sum + val, 0) / data.length / 255;
        levels.set('local', level);
      }

      // Remote levels
      for (const [userId, streamData] of this.remoteStreams) {
        if (streamData.analyser) {
          const data = new Uint8Array(streamData.analyser.frequencyBinCount);
          streamData.analyser.getByteFrequencyData(data);
          const level = data.reduce((sum, val) => sum + val, 0) / data.length / 255;
          levels.set(userId, level);
        }
      }

      this.onLevelUpdate?.(levels);
    }, 50); // 20 FPS level updates
  }

  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  dispose(): void {
    if (this.levelUpdateInterval) {
      clearInterval(this.levelUpdateInterval);
      this.levelUpdateInterval = null;
    }

    this.stopBackingTrack();
    this.stopStemmedTrack();

    for (const streamData of this.remoteStreams.values()) {
      streamData.gainNode?.disconnect();
      streamData.stream.getTracks().forEach((track) => track.stop());
    }
    this.remoteStreams.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.workletNode?.disconnect();
    this.masterGain?.disconnect();
    this.backingTrackGain?.disconnect();

    this.audioContext?.close();
    this.audioContext = null;
  }
}
