// Track Audio Processor - Manages per-track audio processing
// Includes: input gain, effects chain, mute, solo, volume, monitoring

import { ExtendedEffectsProcessor } from './effects/extended-effects-processor';
import type { ExtendedEffectsChain, TrackAudioSettings } from '@/types';

export interface TrackAudioState {
  isMuted: boolean;
  isSolo: boolean;
  volume: number;
  isArmed: boolean;
  inputGain: number; // dB (-24 to +24)
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

export class TrackAudioProcessor {
  private audioContext: AudioContext;
  private trackId: string;

  // Audio nodes
  private inputGainNode: GainNode;
  private armGainNode: GainNode; // Gates input when track is not armed
  private volumeGainNode: GainNode;
  private muteGainNode: GainNode;
  private inputAnalyser: AnalyserNode;
  private outputAnalyser: AnalyserNode;

  // Effects processor
  private effectsProcessor: ExtendedEffectsProcessor;

  // State
  private state: TrackAudioState = {
    isMuted: false,
    isSolo: false,
    volume: 1,
    isArmed: true,
    inputGain: 0,
  };

  // Solo management (class-level for all tracks)
  private static soloedTracks = new Set<string>();
  private static allProcessors = new Map<string, TrackAudioProcessor>();

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
    this.armGainNode = audioContext.createGain(); // Gates input when not armed
    this.volumeGainNode = audioContext.createGain();
    this.muteGainNode = audioContext.createGain();
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
    // input -> inputGain -> armGain -> inputAnalyser -> effects -> volumeGain -> muteGain -> outputAnalyser -> output
    // When not armed, armGain is 0, blocking all input from being processed or visualized
    this.inputGainNode.connect(this.armGainNode);
    this.armGainNode.connect(this.inputAnalyser);
    this.inputAnalyser.connect(this.effectsProcessor.getInputNode());
    this.effectsProcessor.connect(this.volumeGainNode);
    this.volumeGainNode.connect(this.muteGainNode);
    this.muteGainNode.connect(this.outputAnalyser);

    // Apply initial settings
    if (initialSettings) {
      this.state.inputGain = initialSettings.inputGain ?? 0;
      this.updateInputGain();
    }

    // Register this processor
    TrackAudioProcessor.allProcessors.set(trackId, this);
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

  // Update track state
  updateState(updates: Partial<TrackAudioState>): void {
    const prevMuted = this.state.isMuted;
    const prevSolo = this.state.isSolo;
    const prevVolume = this.state.volume;
    const prevArmed = this.state.isArmed;

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
  }

  private updateArmState(): void {
    // When not armed, block all input audio from being processed or visualized
    // This is like a traditional DAW where unarmed tracks don't receive input
    const targetGain = this.state.isArmed ? 1 : 0;
    this.armGainNode.gain.setTargetAtTime(targetGain, this.audioContext.currentTime, 0.01);
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
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const sum = data.reduce((acc, val) => acc + val, 0);
    return sum / data.length / 255;
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
    TrackAudioProcessor.allProcessors.delete(this.trackId);
    TrackAudioProcessor.soloedTracks.delete(this.trackId);

    // Update remaining tracks' mute states
    TrackAudioProcessor.updateAllMuteStates();

    this.disconnect();
    this.effectsProcessor.dispose();
    this.inputGainNode.disconnect();
    this.armGainNode.disconnect();
    this.volumeGainNode.disconnect();
    this.muteGainNode.disconnect();
    this.inputAnalyser.disconnect();
    this.outputAnalyser.disconnect();
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
