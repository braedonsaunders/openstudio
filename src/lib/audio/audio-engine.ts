// Core Audio Engine for OpenStudio
// Manages all audio processing, routing, and playback

import { AdaptiveJitterBuffer } from './jitter-buffer';
import { TrackEffectsProcessor } from './effects/track-effects-processor';
import type { AudioStream, JitterStats, StemMixState, BackingTrack, InputChannelConfig, TrackEffectsChain } from '@/types';

export interface CaptureAudioOptions {
  deviceId?: string;
  channelConfig?: InputChannelConfig;
  sampleRate?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface AudioEngineConfig {
  sampleRate: 48000 | 44100;
  bufferSize: 32 | 64 | 128 | 256 | 512 | 1024;
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
  private backingTrackAnalyser: AnalyserNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private localStream: MediaStream | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private localChannelSplitter: ChannelSplitterNode | null = null;
  private localSourceNode: MediaStreamAudioSourceNode | null = null;
  private localMonitorGain: GainNode | null = null;
  private localInputGain: GainNode | null = null;
  private localMuteGain: GainNode | null = null;
  private localEffectsProcessor: TrackEffectsProcessor | null = null;
  private monitoringEnabled: boolean = true;
  private localTrackMuted: boolean = false;
  private localTrackVolume: number = 1;
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
  private onTrackEnded: (() => void) | null = null;

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

    // Create backing track analyser for audio analysis (key/BPM detection)
    this.backingTrackAnalyser = this.audioContext.createAnalyser();
    this.backingTrackAnalyser.fftSize = 2048; // Higher resolution for pitch detection
    this.backingTrackAnalyser.smoothingTimeConstant = 0.3;
    this.backingTrackGain.connect(this.backingTrackAnalyser);

    // Create master analyser for analyzing all audio (backing + all users)
    // This is useful for jam sessions where you want to detect key from all instruments
    this.masterAnalyser = this.audioContext.createAnalyser();
    this.masterAnalyser.fftSize = 2048;
    this.masterAnalyser.smoothingTimeConstant = 0.3;
    this.masterGain.connect(this.masterAnalyser);

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

  async captureLocalAudio(options: CaptureAudioOptions = {}): Promise<MediaStream> {
    const {
      deviceId,
      channelConfig,
      sampleRate = this.config.sampleRate,
      echoCancellation = false,
      noiseSuppression = false,
      autoGainControl = false,
    } = options;

    // Determine the channel count to request from the device
    // For mono mode with a specific channel (e.g., input 2), we still need to request
    // enough channels from the device to access that input
    const requestedChannelCount = channelConfig?.channelCount === 1
      ? Math.max(2, (channelConfig.leftChannel || 0) + 1) // Need at least leftChannel+1 channels
      : channelConfig?.channelCount || 2;

    const audioConstraints: MediaTrackConstraints = {
      echoCancellation,
      noiseSuppression,
      autoGainControl,
      sampleRate,
      channelCount: requestedChannelCount,
    };

    // Add device constraint if specified
    if (deviceId && deviceId !== 'default') {
      audioConstraints.deviceId = { exact: deviceId };
    }

    console.log('[AudioEngine] Capturing audio with constraints:', {
      deviceId: deviceId || 'default',
      requestedChannelCount,
      channelConfig,
      sampleRate,
    });

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
    });

    // Log actual stream settings
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      const settings = audioTrack.getSettings();
      console.log('[AudioEngine] Actual stream settings:', {
        channelCount: settings.channelCount,
        sampleRate: settings.sampleRate,
        deviceId: settings.deviceId,
      });
    }

    if (this.audioContext && this.masterGain) {
      // Clean up existing nodes
      this.localSourceNode?.disconnect();
      this.localChannelSplitter?.disconnect();
      this.localAnalyser?.disconnect();
      this.localMonitorGain?.disconnect();
      this.localInputGain?.disconnect();
      this.localMuteGain?.disconnect();
      this.localEffectsProcessor?.dispose();

      this.localSourceNode = this.audioContext.createMediaStreamSource(this.localStream);
      this.localAnalyser = this.audioContext.createAnalyser();
      this.localAnalyser.fftSize = 256;

      // Create input gain for track level control
      this.localInputGain = this.audioContext.createGain();
      this.localInputGain.gain.value = this.localTrackVolume;

      // Create mute gain for track mute/solo control
      this.localMuteGain = this.audioContext.createGain();
      this.localMuteGain.gain.value = this.localTrackMuted ? 0 : 1;

      // Create monitoring gain node for local audio output
      this.localMonitorGain = this.audioContext.createGain();
      this.localMonitorGain.gain.value = this.monitoringEnabled ? 1 : 0;

      // Audio signal flow:
      // source -> channelMerger (if mono) -> inputGain -> effects -> muteGain -> monitorGain -> masterGain

      // For mono mode with a specific channel selection, use ChannelSplitter
      // to extract only the desired channel
      if (channelConfig?.channelCount === 1 && channelConfig.leftChannel !== undefined) {
        const actualChannelCount = audioTrack?.getSettings().channelCount || requestedChannelCount;

        if (channelConfig.leftChannel < actualChannelCount) {
          console.log('[AudioEngine] Using ChannelSplitter to extract channel:', channelConfig.leftChannel);

          // Create a channel splitter to access individual channels
          this.localChannelSplitter = this.audioContext.createChannelSplitter(actualChannelCount);

          // Create a channel merger to convert back to mono for the analyser
          const merger = this.audioContext.createChannelMerger(1);

          // Connect: source -> splitter -> specific channel -> merger -> inputGain
          this.localSourceNode.connect(this.localChannelSplitter);
          this.localChannelSplitter.connect(merger, channelConfig.leftChannel, 0);
          merger.connect(this.localInputGain);
        } else {
          // Requested channel not available, fall back to default
          console.warn('[AudioEngine] Requested channel', channelConfig.leftChannel,
            'not available (device has', actualChannelCount, 'channels). Using default.');
          this.localSourceNode.connect(this.localInputGain);
        }
      } else {
        // Stereo or default: connect directly to inputGain
        this.localSourceNode.connect(this.localInputGain);
      }

      // Connect input gain to analyser (for input level metering)
      this.localInputGain.connect(this.localAnalyser);

      // Create effects processor if we have effects settings
      // Connect: inputGain -> effectsProcessor -> muteGain -> monitorGain -> masterGain
      this.localEffectsProcessor = new TrackEffectsProcessor(this.audioContext);
      this.localInputGain.connect(this.localEffectsProcessor.getInputNode());
      this.localEffectsProcessor.connect(this.localMuteGain);
      this.localMuteGain.connect(this.localMonitorGain);
      this.localMonitorGain.connect(this.masterGain);
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

  async setOutputDevice(deviceId: string): Promise<void> {
    if (!this.audioContext) {
      console.warn('[AudioEngine] Cannot set output device: audio context not initialized');
      return;
    }

    // Use setSinkId if available (modern browsers)
    if ('setSinkId' in this.audioContext) {
      try {
        const sinkId = deviceId === 'default' ? '' : deviceId;
        await (this.audioContext as AudioContext & { setSinkId: (id: string) => Promise<void> }).setSinkId(sinkId);
        console.log('[AudioEngine] Output device set to:', deviceId);
      } catch (error) {
        console.error('[AudioEngine] Failed to set output device:', error);
        throw error;
      }
    } else {
      console.warn('[AudioEngine] setSinkId not supported in this browser');
    }
  }

  setMonitoringEnabled(enabled: boolean): void {
    this.monitoringEnabled = enabled;
    if (this.localMonitorGain) {
      this.localMonitorGain.gain.value = enabled ? 1 : 0;
    }
  }

  setMonitoringVolume(volume: number): void {
    if (this.localMonitorGain && this.monitoringEnabled) {
      this.localMonitorGain.gain.value = volume;
    }
  }

  isMonitoringEnabled(): boolean {
    return this.monitoringEnabled;
  }

  /**
   * Set the local track muted state (for mute/solo functionality)
   */
  setLocalTrackMuted(muted: boolean): void {
    this.localTrackMuted = muted;
    if (this.localMuteGain) {
      this.localMuteGain.gain.setTargetAtTime(muted ? 0 : 1, this.audioContext!.currentTime, 0.01);
    }
  }

  /**
   * Set the local track volume
   */
  setLocalTrackVolume(volume: number): void {
    this.localTrackVolume = volume;
    if (this.localInputGain) {
      this.localInputGain.gain.setTargetAtTime(volume, this.audioContext!.currentTime, 0.01);
    }
  }

  /**
   * Update the local track effects
   */
  updateLocalTrackEffects(effects: Partial<TrackEffectsChain>): void {
    if (this.localEffectsProcessor) {
      this.localEffectsProcessor.updateSettings(effects);
    }
  }

  /**
   * Get the local effects processor (for direct manipulation)
   */
  getLocalEffectsProcessor(): TrackEffectsProcessor | null {
    return this.localEffectsProcessor;
  }

  /**
   * Get metering data from the local track effects
   */
  getLocalEffectsMetering(): {
    noiseGateOpen: boolean;
    compressorReduction: number;
    limiterReduction: number;
  } | null {
    if (this.localEffectsProcessor) {
      return this.localEffectsProcessor.getMeteringData();
    }
    return null;
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
      console.log('Loading backing track from:', url);
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('Failed to fetch audio:', response.status, errorText);
        throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('Content-Type') || '';
      if (!contentType.startsWith('audio/')) {
        console.error('Response is not audio:', contentType);
        throw new Error(`Invalid content type: ${contentType}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength === 0) {
        throw new Error('Audio file is empty');
      }

      console.log('Decoding audio data, size:', arrayBuffer.byteLength);
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

  getMasterGain(): GainNode | null {
    return this.masterGain;
  }

  /**
   * Get audio context latency in milliseconds
   * Includes both base latency and output latency
   */
  getContextLatency(): number {
    if (!this.audioContext) return 0;
    const baseLatency = this.audioContext.baseLatency ?? 0;
    const outputLatency = (this.audioContext as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
    return (baseLatency + outputLatency) * 1000;
  }

  /**
   * Get buffer latency in milliseconds based on current buffer size
   */
  getBufferLatency(): number {
    return (this.config.bufferSize / this.config.sampleRate) * 1000;
  }

  /**
   * Get total estimated latency
   */
  getTotalLatency(): number {
    return this.getContextLatency() + this.getBufferLatency();
  }

  /**
   * Get current engine configuration
   */
  getConfig(): AudioEngineConfig {
    return { ...this.config };
  }

  /**
   * Update engine configuration (buffer size, sample rate, etc.)
   * Note: Some changes require re-initialization to take effect
   */
  updateConfig(newConfig: Partial<AudioEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get the analyser node connected to the backing track audio.
   * This can be used for real-time audio analysis (key/BPM detection).
   */
  getBackingTrackAnalyser(): AnalyserNode | null {
    return this.backingTrackAnalyser;
  }

  /**
   * Check if backing track audio is currently available for analysis.
   * Returns true if we have a loaded backing track or stems.
   */
  hasBackingTrackAudio(): boolean {
    return this.backingTrackBuffer !== null || this.stemBuffers.size > 0;
  }

  /**
   * Get the master analyser node connected to all audio output.
   * This includes backing tracks AND all user audio streams.
   * Useful for jam sessions to detect key from combined instruments.
   */
  getMasterAnalyser(): AnalyserNode | null {
    return this.masterAnalyser;
  }

  async loadStem(stemType: string, url: string): Promise<void> {
    if (!this.audioContext) return;

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this.stemBuffers.set(stemType, buffer);
  }

  playBackingTrack(syncTimestamp: number, offset: number = 0): void {
    if (!this.audioContext) {
      console.error('Cannot play: audio context not initialized');
      return;
    }
    if (!this.backingTrackBuffer) {
      console.error('Cannot play: no audio buffer loaded');
      return;
    }
    if (!this.backingTrackGain) {
      console.error('Cannot play: gain node not ready');
      return;
    }

    // Resume if suspended
    if (this.audioContext.state === 'suspended') {
      console.log('Resuming suspended audio context');
      this.audioContext.resume();
    }

    this.stopBackingTrack();

    // Calculate start time based on sync timestamp
    const now = Date.now();
    const delay = Math.max(0, syncTimestamp - now) / 1000;

    const source = this.audioContext.createBufferSource();
    source.buffer = this.backingTrackBuffer;
    source.connect(this.backingTrackGain);

    // Handle track end - check if this source is still the active one
    // to prevent old sources from interfering during seek
    source.onended = () => {
      if (this.backingTrackSource === source && this.isPlaying) {
        this.isPlaying = false;
        this.onTrackEnded?.();
      }
    };

    this.backingTrackSource = source;

    const startTime = this.audioContext.currentTime + delay;
    console.log('Starting playback at offset:', offset, 'delay:', delay);
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

    let isFirst = true;

    // Play each stem that is enabled
    for (const [stemType, buffer] of this.stemBuffers.entries()) {
      const stemState = this.stemMixState[stemType as keyof StemMixState];
      if (!stemState?.enabled) continue;

      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      // Hook track end to the first stem source
      // Check if this source is still active to prevent old sources from interfering during seek
      if (isFirst) {
        source.onended = () => {
          if (this.stemSources.get(stemType) === source && this.isPlaying) {
            this.isPlaying = false;
            this.onTrackEnded?.();
          }
        };
        isFirst = false;
      }

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

  setOnTrackEnded(callback: () => void): void {
    this.onTrackEnded = callback;
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

    this.localSourceNode?.disconnect();
    this.localSourceNode = null;
    this.localChannelSplitter?.disconnect();
    this.localChannelSplitter = null;
    this.localAnalyser?.disconnect();
    this.localAnalyser = null;
    this.localMonitorGain?.disconnect();
    this.localMonitorGain = null;
    this.localInputGain?.disconnect();
    this.localInputGain = null;
    this.localMuteGain?.disconnect();
    this.localMuteGain = null;
    this.localEffectsProcessor?.dispose();
    this.localEffectsProcessor = null;

    this.workletNode?.disconnect();
    this.masterGain?.disconnect();
    this.backingTrackGain?.disconnect();
    this.backingTrackAnalyser?.disconnect();
    this.masterAnalyser?.disconnect();

    this.audioContext?.close();
    this.audioContext = null;
  }
}
