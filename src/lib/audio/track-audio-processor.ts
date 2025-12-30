// Track Audio Processor - Manages per-track audio processing
// Includes: input gain, effects chain, mute, solo, volume, monitoring
// Supports multiple input sources: MediaStream (web) or AudioWorklet (native bridge)

import { ExtendedEffectsProcessor } from './effects/extended-effects-processor';
import type { ExtendedEffectsChain, TrackAudioSettings, InputChannelConfig } from '@/types';

export interface TrackAudioState {
  isMuted: boolean;
  isSolo: boolean;
  volume: number;
  isArmed: boolean;
  inputGain: number; // dB (-24 to +24)
  monitoringEnabled: boolean;
}

export interface TrackInputConfig {
  channelConfig: InputChannelConfig;
  deviceId?: string; // For web audio mode
}

export interface TrackProcessingMetrics {
  inputLevel: number;
  outputLevel: number;
  effectsProcessingTime: number; // ms
  isClipping: boolean;
  noiseGateOpen: boolean;
  compressorReduction: number;
  limiterReduction: number;
}

export type TrackInputSourceType = 'none' | 'mediastream' | 'bridge';

export class TrackAudioProcessor {
  private audioContext: AudioContext;
  private trackId: string;

  // Input source management
  private inputSourceType: TrackInputSourceType = 'none';
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private mediaStream: MediaStream | null = null;
  private bridgeWorkletNode: AudioWorkletNode | null = null;
  private channelSplitter: ChannelSplitterNode | null = null;
  private channelMerger: ChannelMergerNode | null = null;
  private inputConfig: TrackInputConfig | null = null;

  // Audio nodes
  private inputGainNode: GainNode;
  private armGainNode: GainNode; // Gates input when track is not armed
  private volumeGainNode: GainNode;
  private muteGainNode: GainNode;
  private monitorGainNode: GainNode; // Controls monitoring output
  private inputAnalyser: AnalyserNode;
  private outputAnalyser: AnalyserNode;

  // Effects processor
  private effectsProcessor: ExtendedEffectsProcessor;

  // State
  private state: TrackAudioState = {
    isMuted: false,
    isSolo: false,
    volume: 1,
    isArmed: false,
    inputGain: 0,
    monitoringEnabled: false,
  };

  // Solo management (class-level for all tracks)
  private static soloedTracks = new Set<string>();
  private static allProcessors = new Map<string, TrackAudioProcessor>();

  // Track which AudioContexts have the bridge worklet module loaded
  // Using WeakSet so closed contexts can be garbage collected
  private static bridgeWorkletLoadedContexts = new WeakSet<AudioContext>();

  // Metrics
  private lastProcessingTime = 0;

  constructor(
    audioContext: AudioContext,
    trackId: string,
    initialSettings?: TrackAudioSettings,
    onEffectsChange?: (effects: ExtendedEffectsChain) => void
  ) {
    this.audioContext = audioContext;
    this.trackId = trackId;

    // Create audio nodes
    this.inputGainNode = audioContext.createGain();
    this.armGainNode = audioContext.createGain();
    this.armGainNode.gain.value = 0; // Start disarmed
    this.volumeGainNode = audioContext.createGain();
    this.muteGainNode = audioContext.createGain();
    this.monitorGainNode = audioContext.createGain();
    this.monitorGainNode.gain.value = 0; // Start with monitoring off
    this.inputAnalyser = audioContext.createAnalyser();
    this.inputAnalyser.fftSize = 256;
    this.outputAnalyser = audioContext.createAnalyser();
    this.outputAnalyser.fftSize = 256;

    // Create effects processor
    this.effectsProcessor = new ExtendedEffectsProcessor(
      audioContext,
      initialSettings?.effects,
      onEffectsChange
    );

    // Wire up the signal chain:
    // [source] -> inputGain -> armGain -> inputAnalyser -> effects -> volumeGain -> muteGain -> outputAnalyser
    // outputAnalyser branches to:
    //   1. monitorGain -> [monitoring output]
    //   2. [broadcast/mix output]
    this.inputGainNode.connect(this.armGainNode);
    this.armGainNode.connect(this.inputAnalyser);
    this.inputAnalyser.connect(this.effectsProcessor.getInputNode());
    this.effectsProcessor.connect(this.volumeGainNode);
    this.volumeGainNode.connect(this.muteGainNode);
    this.muteGainNode.connect(this.outputAnalyser);
    this.outputAnalyser.connect(this.monitorGainNode);

    // Apply initial settings
    if (initialSettings) {
      this.state.inputGain = initialSettings.inputGain ?? 0;
      this.state.monitoringEnabled = initialSettings.directMonitoring ?? false;
      this.updateInputGain();
      this.updateMonitoringState();
    }

    // Register this processor
    TrackAudioProcessor.allProcessors.set(trackId, this);
    console.log(`[TrackAudioProcessor] Created processor for track ${trackId}`);
  }

  getTrackId(): string {
    return this.trackId;
  }

  /**
   * Get the AudioContext this processor was created with.
   * Used to detect stale processors that need recreation.
   */
  getAudioContext(): AudioContext {
    return this.audioContext;
  }

  /**
   * Check if the AudioContext is still valid (not closed)
   */
  isContextValid(): boolean {
    return this.audioContext && this.audioContext.state !== 'closed';
  }

  // Get the input node (where audio enters this processor)
  getInputNode(): GainNode {
    return this.inputGainNode;
  }

  // Get the output node (where audio exits this processor)
  getOutputNode(): AnalyserNode {
    return this.outputAnalyser;
  }

  // Connect output to a destination
  connect(destination: AudioNode): void {
    this.outputAnalyser.connect(destination);
  }

  // Disconnect output
  disconnect(): void {
    this.outputAnalyser.disconnect();
  }

  // Get the monitor output node (for connecting to speakers)
  getMonitorNode(): GainNode {
    return this.monitorGainNode;
  }

  // Get the broadcast output node (for WebRTC - before monitor gain)
  getBroadcastNode(): AnalyserNode {
    return this.outputAnalyser;
  }

  // Connect monitor output to destination (speakers)
  connectMonitor(destination: AudioNode): void {
    this.monitorGainNode.connect(destination);
  }

  // ==========================================
  // Input Source Management
  // ==========================================

  /**
   * Set up MediaStream input (web audio mode)
   * Captures from device microphone/interface via getUserMedia
   */
  async setMediaStreamInput(stream: MediaStream, config: TrackInputConfig): Promise<void> {
    // Clean up existing input
    this.disconnectInputSource();

    this.inputConfig = config;
    this.mediaStream = stream;
    this.inputSourceType = 'mediastream';

    // Create source from stream
    this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);

    const channelCount = config.channelConfig.channelCount;
    const leftChannel = config.channelConfig.leftChannel;
    const rightChannel = config.channelConfig.rightChannel;

    if (channelCount === 1) {
      // Mono: extract single channel and connect
      const numChannels = stream.getAudioTracks()[0]?.getSettings().channelCount || 2;
      this.channelSplitter = this.audioContext.createChannelSplitter(numChannels);
      this.channelMerger = this.audioContext.createChannelMerger(2);

      this.mediaStreamSource.connect(this.channelSplitter);
      // Route selected channel to both L and R
      this.channelSplitter.connect(this.channelMerger, leftChannel, 0);
      this.channelSplitter.connect(this.channelMerger, leftChannel, 1);
      this.channelMerger.connect(this.inputGainNode);
    } else {
      // Stereo: extract L/R channels
      const numChannels = stream.getAudioTracks()[0]?.getSettings().channelCount || 2;
      this.channelSplitter = this.audioContext.createChannelSplitter(numChannels);
      this.channelMerger = this.audioContext.createChannelMerger(2);

      this.mediaStreamSource.connect(this.channelSplitter);
      this.channelSplitter.connect(this.channelMerger, leftChannel, 0);
      this.channelSplitter.connect(this.channelMerger, rightChannel ?? leftChannel, 1);
      this.channelMerger.connect(this.inputGainNode);
    }

    console.log(`[TrackAudioProcessor] ${this.trackId} - MediaStream input connected`, config);
  }

  /**
   * Set up bridge worklet input (native bridge mode)
   * Receives audio via postMessage from native ASIO bridge
   */
  async setBridgeInput(config: TrackInputConfig): Promise<void> {
    // Validate AudioContext is in a usable state
    if (!this.audioContext || this.audioContext.state === 'closed') {
      console.error(`[TrackAudioProcessor] ${this.trackId} - Cannot set bridge input: AudioContext is closed or invalid`);
      throw new Error('AudioContext is not valid for creating AudioWorkletNode');
    }

    // Resume AudioContext if suspended
    if (this.audioContext.state === 'suspended') {
      console.log(`[TrackAudioProcessor] ${this.trackId} - Resuming suspended AudioContext`);
      await this.audioContext.resume();
    }

    // Clean up existing input
    this.disconnectInputSource();

    this.inputConfig = config;
    this.inputSourceType = 'bridge';

    // Load bridge worklet if not already loaded on this AudioContext
    // Each AudioContext needs its own module registration
    if (!TrackAudioProcessor.bridgeWorkletLoadedContexts.has(this.audioContext)) {
      try {
        await this.audioContext.audioWorklet.addModule('/audio/bridge-processor.js');
        TrackAudioProcessor.bridgeWorkletLoadedContexts.add(this.audioContext);
        console.log(`[TrackAudioProcessor] ${this.trackId} - Bridge worklet module loaded on AudioContext`);
      } catch (err) {
        // Module may already be loaded on this context (e.g., by AudioEngine)
        console.log(`[TrackAudioProcessor] ${this.trackId} - Bridge worklet already loaded or error:`, err);
        TrackAudioProcessor.bridgeWorkletLoadedContexts.add(this.audioContext);
      }
    }

    // Create AudioWorkletNode for this track's bridge audio
    try {
      this.bridgeWorkletNode = new AudioWorkletNode(this.audioContext, 'bridge-audio-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
    } catch (err) {
      console.error(`[TrackAudioProcessor] ${this.trackId} - Failed to create AudioWorkletNode:`, err);
      this.inputSourceType = 'none';
      throw err;
    }

    // Handle worklet messages (stats)
    this.bridgeWorkletNode.port.onmessage = (event) => {
      if (event.data.type === 'stats') {
        const { underruns, overruns, bufferFill } = event.data;
        console.log(`[TrackAudioProcessor] ${this.trackId.slice(-8)} worklet stats:`, {
          underruns,
          overruns,
          bufferFill: (bufferFill * 100).toFixed(1) + '%',
          armGain: this.armGainNode.gain.value,
          monitorGain: this.monitorGainNode.gain.value,
          inputSourceType: this.inputSourceType,
        });
      }
    };

    // Connect worklet to input chain
    this.bridgeWorkletNode.connect(this.inputGainNode);

    console.log(`[TrackAudioProcessor] ${this.trackId} - Bridge input connected`, config);
  }

  /**
   * Push audio samples to bridge worklet (called from native bridge WebSocket)
   */
  pushBridgeAudio(samples: Float32Array): void {
    if (this.inputSourceType !== 'bridge' || !this.bridgeWorkletNode) {
      return;
    }

    this.bridgeWorkletNode.port.postMessage({
      type: 'audio',
      samples: samples,
    });
  }

  /**
   * Disconnect current input source
   */
  disconnectInputSource(): void {
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }
    if (this.channelSplitter) {
      this.channelSplitter.disconnect();
      this.channelSplitter = null;
    }
    if (this.channelMerger) {
      this.channelMerger.disconnect();
      this.channelMerger = null;
    }
    if (this.bridgeWorkletNode) {
      this.bridgeWorkletNode.port.postMessage({ type: 'reset' });
      this.bridgeWorkletNode.disconnect();
      this.bridgeWorkletNode = null;
    }
    if (this.mediaStream) {
      // Don't stop tracks - they may be shared with other tracks
      this.mediaStream = null;
    }
    this.inputSourceType = 'none';
    this.inputConfig = null;
  }

  getInputSourceType(): TrackInputSourceType {
    return this.inputSourceType;
  }

  getInputConfig(): TrackInputConfig | null {
    return this.inputConfig;
  }

  // ==========================================
  // State Management
  // ==========================================

  // Update track state
  updateState(updates: Partial<TrackAudioState>): void {
    const prevMuted = this.state.isMuted;
    const prevSolo = this.state.isSolo;
    const prevVolume = this.state.volume;
    const prevArmed = this.state.isArmed;
    const prevMonitoring = this.state.monitoringEnabled;

    Object.assign(this.state, updates);

    if (updates.volume !== undefined && updates.volume !== prevVolume) {
      this.updateVolume();
    }

    if (updates.isMuted !== undefined && updates.isMuted !== prevMuted) {
      this.updateMuteState();
    }

    if (updates.isSolo !== undefined && updates.isSolo !== prevSolo) {
      this.updateSoloState();
    }

    if (updates.inputGain !== undefined) {
      this.updateInputGain();
    }

    if (updates.isArmed !== undefined && updates.isArmed !== prevArmed) {
      this.updateArmState();
    }

    if (updates.monitoringEnabled !== undefined && updates.monitoringEnabled !== prevMonitoring) {
      this.updateMonitoringState();
    }
  }

  private updateArmState(): void {
    // When not armed, block all input audio from being processed or visualized
    // This is like a traditional DAW where unarmed tracks don't receive input
    const targetGain = this.state.isArmed ? 1 : 0;
    this.armGainNode.gain.setTargetAtTime(targetGain, this.audioContext.currentTime, 0.01);
    console.log(`[TrackAudioProcessor] ${this.trackId.slice(-8)} arm state changed:`, {
      isArmed: this.state.isArmed,
      armGain: targetGain,
    });
  }

  private updateInputGain(): void {
    // Convert dB to linear gain
    const linearGain = Math.pow(10, this.state.inputGain / 20);
    this.inputGainNode.gain.setTargetAtTime(linearGain, this.audioContext.currentTime, 0.01);
  }

  private updateVolume(): void {
    this.volumeGainNode.gain.setTargetAtTime(this.state.volume, this.audioContext.currentTime, 0.01);
  }

  private updateMuteState(): void {
    this.applyMuteSolo();
  }

  private updateSoloState(): void {
    if (this.state.isSolo) {
      TrackAudioProcessor.soloedTracks.add(this.trackId);
    } else {
      TrackAudioProcessor.soloedTracks.delete(this.trackId);
    }

    // Update all tracks when solo state changes
    TrackAudioProcessor.updateAllMuteStates();
  }

  private static updateAllMuteStates(): void {
    for (const processor of TrackAudioProcessor.allProcessors.values()) {
      processor.applyMuteSolo();
    }
  }

  private applyMuteSolo(): void {
    const hasSoloedTracks = TrackAudioProcessor.soloedTracks.size > 0;

    let shouldMute = this.state.isMuted;

    // If there are soloed tracks and this isn't one of them, mute it
    if (hasSoloedTracks && !this.state.isSolo) {
      shouldMute = true;
    }

    // Use setTargetAtTime for smooth transitions
    const targetGain = shouldMute ? 0 : 1;
    this.muteGainNode.gain.setTargetAtTime(targetGain, this.audioContext.currentTime, 0.01);
  }

  private updateMonitoringState(): void {
    // Monitoring allows hearing input through speakers when armed
    // When armed + monitoring enabled: hear yourself
    // When not armed OR monitoring disabled: no monitoring output
    const shouldMonitor = this.state.isArmed && this.state.monitoringEnabled;
    const targetGain = shouldMonitor ? 1 : 0;
    this.monitorGainNode.gain.setTargetAtTime(targetGain, this.audioContext.currentTime, 0.01);
    console.log(`[TrackAudioProcessor] ${this.trackId.slice(-8)} monitoring state changed:`, {
      isArmed: this.state.isArmed,
      monitoringEnabled: this.state.monitoringEnabled,
      shouldMonitor,
      monitorGain: targetGain,
    });
  }

  // Update effects settings
  updateEffects(effects: Partial<ExtendedEffectsChain>): void {
    const start = performance.now();
    this.effectsProcessor.updateSettings(effects);
    this.lastProcessingTime = performance.now() - start;
  }

  // Get effects processor for direct manipulation
  getEffectsProcessor(): ExtendedEffectsProcessor {
    return this.effectsProcessor;
  }

  // Get current state
  getState(): TrackAudioState {
    return { ...this.state };
  }

  // Get audio levels
  getInputLevel(): number {
    return this.calculateLevel(this.inputAnalyser);
  }

  getOutputLevel(): number {
    return this.calculateLevel(this.outputAnalyser);
  }

  private calculateLevel(analyser: AnalyserNode): number {
    // Use time-domain data for accurate peak level metering
    // This matches the approach in audio-engine.ts for consistency
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);

    // Find peak deviation from center (128)
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const deviation = Math.abs(data[i] - 128);
      if (deviation > peak) peak = deviation;
    }

    // Normalize to 0-1 range
    return peak / 128;
  }

  // Get processing metrics
  getMetrics(): TrackProcessingMetrics {
    const effectsMetering = this.effectsProcessor.getMeteringData();
    const outputLevel = this.getOutputLevel();

    return {
      inputLevel: this.getInputLevel(),
      outputLevel,
      effectsProcessingTime: this.lastProcessingTime,
      isClipping: outputLevel > 0.95,
      noiseGateOpen: effectsMetering.noiseGateOpen,
      compressorReduction: effectsMetering.compressorReduction,
      limiterReduction: effectsMetering.limiterReduction,
    };
  }

  // Check if track is effectively outputting audio
  isOutputting(): boolean {
    return !this.state.isMuted &&
           (TrackAudioProcessor.soloedTracks.size === 0 || this.state.isSolo);
  }

  // Dispose and clean up
  dispose(): void {
    console.log(`[TrackAudioProcessor] Disposing processor for track ${this.trackId}`);

    TrackAudioProcessor.allProcessors.delete(this.trackId);
    TrackAudioProcessor.soloedTracks.delete(this.trackId);

    // Update remaining tracks' mute states
    TrackAudioProcessor.updateAllMuteStates();

    // Clean up input source first
    this.disconnectInputSource();

    // Disconnect all nodes
    this.disconnect();
    this.effectsProcessor.dispose();
    this.inputGainNode.disconnect();
    this.armGainNode.disconnect();
    this.volumeGainNode.disconnect();
    this.muteGainNode.disconnect();
    this.monitorGainNode.disconnect();
    this.inputAnalyser.disconnect();
    this.outputAnalyser.disconnect();
  }

  // Static method to get a specific processor
  static getProcessor(trackId: string): TrackAudioProcessor | undefined {
    return TrackAudioProcessor.allProcessors.get(trackId);
  }

  // Static method to dispose all processors
  static disposeAll(): void {
    for (const processor of TrackAudioProcessor.allProcessors.values()) {
      processor.dispose();
    }
    TrackAudioProcessor.allProcessors.clear();
    TrackAudioProcessor.soloedTracks.clear();
  }

  // Static method to get all active processors
  static getActiveProcessors(): Map<string, TrackAudioProcessor> {
    return new Map(TrackAudioProcessor.allProcessors);
  }

  // Static method to check if any track is soloed
  static hasSoloedTracks(): boolean {
    return TrackAudioProcessor.soloedTracks.size > 0;
  }

  // Static method to clear all solo states
  static clearAllSolo(): void {
    TrackAudioProcessor.soloedTracks.clear();
    TrackAudioProcessor.updateAllMuteStates();
  }
}
