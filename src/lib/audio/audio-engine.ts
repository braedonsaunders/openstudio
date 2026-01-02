// Core Audio Engine for OpenStudio
// Manages all audio processing, routing, and playback

import { AdaptiveJitterBuffer } from './jitter-buffer';
import { ExtendedEffectsProcessor } from './effects/extended-effects-processor';
import { MasterEffectsProcessor, type MasterEffectsChain } from './effects/master-effects-processor';
import { TrackAudioProcessor, type TrackAudioState, type TrackInputConfig } from './track-audio-processor';
import type { AudioStream, JitterStats, StemMixState, BackingTrack, InputChannelConfig, ExtendedEffectsChain, TrackAudioSettings } from '@/types';

export interface CaptureAudioOptions {
  deviceId?: string;
  channelConfig?: InputChannelConfig;
  sampleRate?: number;
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
  private songGain: GainNode | null = null;
  private songAnalyser: AnalyserNode | null = null;
  private backingTrackGain: GainNode | null = null;
  private backingTrackAnalyser: AnalyserNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;
  private localStream: MediaStream | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private localChannelSplitter: ChannelSplitterNode | null = null;
  private localSourceNode: MediaStreamAudioSourceNode | null = null;
  private localMonitorGain: GainNode | null = null;
  private localInputGain: GainNode | null = null;
  private localArmGain: GainNode | null = null;
  private localMuteGain: GainNode | null = null;
  private localEffectsProcessor: ExtendedEffectsProcessor | null = null;
  private masterEffectsProcessor: MasterEffectsProcessor | null = null;
  private monitoringEnabled: boolean = true;
  private localTrackMuted: boolean = false;
  private localTrackArmed: boolean = false;
  private localTrackVolume: number = 1;
  private remoteStreams: Map<string, AudioStream> = new Map();
  private backingTrackSource: AudioBufferSourceNode | null = null;
  private backingTrackBuffer: AudioBuffer | null = null;
  private stemSources: Map<string, AudioBufferSourceNode> = new Map();
  private stemBuffers: Map<string, AudioBuffer> = new Map();
  private stemGains: Map<string, GainNode> = new Map();

  // WebRTC broadcast support - mixes MIDI audio with mic for streaming
  private broadcastDestination: MediaStreamAudioDestinationNode | null = null;
  private broadcastMixerGain: GainNode | null = null;
  private midiSourceNode: MediaStreamAudioSourceNode | null = null;
  private midiMixGain: GainNode | null = null;

  // Native bridge audio source (replaces localSourceNode when bridge is active)
  private bridgeWorkletNode: AudioWorkletNode | null = null;
  private bridgeWorkletReady: boolean = false;
  private useBridgeAudio: boolean = false;
  private stemMixState: StemMixState = {
    vocals: { enabled: true, volume: 1 },
    drums: { enabled: true, volume: 1 },
    bass: { enabled: true, volume: 1 },
    other: { enabled: true, volume: 1 },
  };

  // External audio sources (e.g., Lyria AI music) routed through master
  private externalSources: Map<string, {
    source: MediaStreamAudioSourceNode;
    gainNode: GainNode;
    stream: MediaStream;
  }> = new Map();

  // Multi-track audio processors - each user track gets its own processor
  private trackProcessors: Map<string, TrackAudioProcessor> = new Map();
  private primaryTrackId: string | null = null; // For backward compatibility with single-track API

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
    // Using latencyHint: 0 requests the absolute minimum latency the system can provide
    this.audioContext = new AudioContext({
      sampleRate: this.config.sampleRate,
      latencyHint: 0,
    });

    // Install console warning interceptor to detect BiquadFilterNode errors
    this.installFilterErrorDetection();

    // iOS Safari requires explicit resume after user interaction
    // The AudioContext starts in 'suspended' state on iOS and must be resumed
    if (this.audioContext.state === 'suspended') {
      console.log('[AudioEngine] AudioContext suspended, attempting resume...');
      try {
        await this.audioContext.resume();
        console.log('[AudioEngine] AudioContext resumed successfully');
      } catch (err) {
        console.warn('[AudioEngine] Failed to resume AudioContext:', err);
        // Continue anyway - will be resumed on user interaction (e.g., getUserMedia)
      }
    }

    // Create master gain node
    this.masterGain = this.audioContext.createGain();

    // Create master effects processor (optional effects chain on master bus)
    // Signal flow: masterGain → masterEffects → destination
    this.masterEffectsProcessor = new MasterEffectsProcessor(this.audioContext);
    this.masterGain.connect(this.masterEffectsProcessor.getInputNode());
    this.masterEffectsProcessor.connect(this.audioContext.destination);

    // Create song gain node (controls all song-related audio: backing tracks, stems, Lyria AI, etc.)
    // Signal flow: backingTrackGain/externalSources → songGain → masterGain
    this.songGain = this.audioContext.createGain();
    this.songGain.connect(this.masterGain);

    // Create song analyser for metering
    this.songAnalyser = this.audioContext.createAnalyser();
    this.songAnalyser.fftSize = 256;
    this.songGain.connect(this.songAnalyser);

    // Create backing track gain node (routes through song gain)
    this.backingTrackGain = this.audioContext.createGain();
    this.backingTrackGain.connect(this.songGain);

    // Create backing track analyser for audio analysis (key/BPM detection)
    this.backingTrackAnalyser = this.audioContext.createAnalyser();
    this.backingTrackAnalyser.fftSize = 2048; // Higher resolution for pitch detection
    this.backingTrackAnalyser.smoothingTimeConstant = 0.3;
    this.backingTrackGain.connect(this.backingTrackAnalyser);

    // Create master analyser for analyzing all audio (backing + all users)
    // Placed after master effects to analyze the final output
    this.masterAnalyser = this.audioContext.createAnalyser();
    this.masterAnalyser.fftSize = 2048;
    this.masterAnalyser.smoothingTimeConstant = 0.3;
    this.masterEffectsProcessor.getOutputNode().connect(this.masterAnalyser);

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

  /**
   * Change the sample rate by recreating the AudioContext.
   * This is necessary because AudioContext sample rate is fixed at creation.
   * All audio nodes will be recreated and state will be restored.
   */
  async changeSampleRate(newRate: 44100 | 48000): Promise<void> {
    if (!this.audioContext) {
      console.warn('[AudioEngine] Cannot change sample rate: not initialized');
      return;
    }

    if (this.audioContext.sampleRate === newRate) {
      console.log('[AudioEngine] Sample rate already', newRate);
      return;
    }

    console.log('[AudioEngine] Changing sample rate from', this.audioContext.sampleRate, 'to', newRate);

    // Save current state
    const savedState = {
      useBridgeAudio: this.useBridgeAudio,
      localTrackArmed: this.localTrackArmed,
      localTrackMuted: this.localTrackMuted,
      localTrackVolume: this.localTrackVolume,
      monitoringEnabled: this.monitoringEnabled,
      effectsSettings: this.localEffectsProcessor?.getSettings() ?? null,
      masterEffectsEnabled: this.masterEffectsProcessor?.isEnabled() ?? false,
      masterEffectsSettings: this.masterEffectsProcessor?.getSettings() ?? null,
    };

    // Stop level monitoring
    if (this.levelUpdateInterval) {
      clearInterval(this.levelUpdateInterval);
      this.levelUpdateInterval = null;
    }

    // Disable bridge audio if active
    if (this.useBridgeAudio) {
      this.disableBridgeAudio();
    }

    // CRITICAL: Dispose all track processors before closing context
    // This prevents race conditions where useTrackAudioSync triggers
    // processor recreation during the sample rate change
    console.log('[AudioEngine] Disposing', this.trackProcessors.size, 'track processors for sample rate change');
    for (const processor of this.trackProcessors.values()) {
      processor.dispose();
    }
    this.trackProcessors.clear();
    this.primaryTrackId = null;

    // Clean up local audio nodes
    this.localSourceNode?.disconnect();
    this.localAnalyser?.disconnect();
    this.localInputGain?.disconnect();
    this.localArmGain?.disconnect();
    this.localMuteGain?.disconnect();
    this.localMonitorGain?.disconnect();
    this.localEffectsProcessor?.dispose();

    // Clean up master nodes
    this.masterGain?.disconnect();
    this.masterEffectsProcessor?.dispose();
    this.songGain?.disconnect();
    this.backingTrackGain?.disconnect();

    // Close old context
    await this.audioContext.close();
    this.audioContext = null;

    // Update config
    this.config.sampleRate = newRate;

    // Reinitialize with new sample rate
    await this.initialize();

    // Restore state
    this.localTrackArmed = savedState.localTrackArmed;
    this.localTrackMuted = savedState.localTrackMuted;
    this.localTrackVolume = savedState.localTrackVolume;
    this.monitoringEnabled = savedState.monitoringEnabled;

    // Restore master effects
    if (savedState.masterEffectsSettings) {
      this.masterEffectsProcessor?.updateSettings(savedState.masterEffectsSettings);
    }
    this.masterEffectsProcessor?.setEnabled(savedState.masterEffectsEnabled);

    // Note: Bridge audio for tracks is re-enabled via setTrackBridgeInput calls
    // from useNativeBridge after sample rate change completes

    console.log('[AudioEngine] Sample rate changed to', this.config.sampleRate);
  }

  /**
   * Capture audio from a device via getUserMedia.
   * Returns the raw MediaStream - routing to TrackAudioProcessor is handled by the caller.
   */
  async captureLocalAudio(options: CaptureAudioOptions = {}): Promise<MediaStream> {
    const {
      deviceId,
      channelConfig,
      sampleRate = this.config.sampleRate,
    } = options;

    // Determine the channel count to request from the device
    // For mono mode with a specific channel (e.g., input 2), we still need to request
    // enough channels from the device to access that input
    const requestedChannelCount = channelConfig?.channelCount === 1
      ? Math.max(2, (channelConfig.leftChannel || 0) + 1) // Need at least leftChannel+1 channels
      : channelConfig?.channelCount || 2;

    // Audio processing (echo cancellation, noise suppression, auto gain) is always disabled
    // for lowest latency - these add significant processing delay.
    const audioConstraints: MediaTrackConstraints & { latency?: number } = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate,
      channelCount: requestedChannelCount,
      // Request minimum capture latency for live jamming (Chrome/Edge support)
      latency: 0,
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

    // Stop any existing stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
    }

    // Try with full constraints first, fall back to minimal for iOS Safari compatibility
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });
    } catch (err) {
      const error = err as Error;
      if (error.name === 'OverconstrainedError' || error.name === 'NotSupportedError') {
        console.warn('[AudioEngine] Constraints not supported, falling back:', error.message);

        const fallbackConstraints: MediaTrackConstraints = deviceId && deviceId !== 'default'
          ? { deviceId: { ideal: deviceId } }
          : {};

        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: fallbackConstraints.deviceId ? fallbackConstraints : true,
        });
      } else {
        throw err;
      }
    }

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

    return this.localStream;
  }

  /**
   * Enable native bridge audio mode.
   * This creates an AudioWorkletNode that receives audio from the native bridge
   * and routes it through the same effects chain as local microphone audio.
   * AudioWorklet runs on a dedicated audio thread for consistent timing.
   */
  async enableBridgeAudio(): Promise<void> {
    if (!this.audioContext || !this.masterGain) {
      console.warn('[AudioEngine] Cannot enable bridge audio: AudioContext not initialized');
      return;
    }

    console.log('[AudioEngine] Enabling bridge audio mode with AudioWorklet');

    // Ensure AudioContext is running (may be suspended after recreation)
    if (this.audioContext.state === 'suspended') {
      console.log('[AudioEngine] Resuming suspended AudioContext for bridge audio');
      try {
        await this.audioContext.resume();
        console.log('[AudioEngine] AudioContext resumed, state:', this.audioContext.state);
      } catch (err) {
        console.error('[AudioEngine] Failed to resume AudioContext:', err);
      }
    }

    // IMPORTANT: Save current effects settings before disposing the processor
    // This ensures effects are preserved when switching to bridge audio
    const savedEffectsSettings = this.localEffectsProcessor?.getSettings() ?? null;
    if (savedEffectsSettings) {
      console.log('[AudioEngine] Saved effects settings before bridge switch');
    }

    this.useBridgeAudio = true;

    // Clean up any existing local source
    this.localSourceNode?.disconnect();
    this.localSourceNode = null;

    // Load bridge audio worklet if not already loaded
    try {
      await this.audioContext.audioWorklet.addModule('/audio/bridge-processor.js');
      console.log('[AudioEngine] Bridge audio worklet loaded');
    } catch (err) {
      // Module may already be loaded, which is fine
      console.log('[AudioEngine] Bridge audio worklet already loaded or error:', err);
    }

    // Create AudioWorkletNode for bridge audio
    // This runs on the audio thread for consistent timing
    this.bridgeWorkletNode = new AudioWorkletNode(this.audioContext, 'bridge-audio-processor', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2], // Stereo output
    });

    // Handle messages from worklet (stats, etc.)
    this.bridgeWorkletNode.port.onmessage = (event) => {
      const { type, underruns, overruns, bufferFill } = event.data;
      if (type === 'stats') {
        // Log stats periodically
        console.log('[AudioEngine] Bridge worklet stats:', {
          underruns,
          overruns,
          bufferFill: (bufferFill * 100).toFixed(1) + '%',
          armGain: this.localArmGain?.gain.value,
          monitorGain: this.localMonitorGain?.gain.value,
        });
      }
    };

    this.bridgeWorkletReady = true;
    console.log('[AudioEngine] Bridge AudioWorklet created');

    // Set up the audio chain: bridgeWorklet -> inputGain -> armGain -> effects -> ...
    // We need to create the same chain as captureLocalAudio but with bridge source

    // Clean up existing nodes
    this.localAnalyser?.disconnect();
    this.localInputGain?.disconnect();
    this.localArmGain?.disconnect();
    this.localMuteGain?.disconnect();
    this.localMonitorGain?.disconnect();
    this.localEffectsProcessor?.dispose();

    // Create gain nodes
    this.localAnalyser = this.audioContext.createAnalyser();
    this.localAnalyser.fftSize = 256;

    this.localInputGain = this.audioContext.createGain();
    this.localInputGain.gain.value = this.localTrackVolume;

    this.localArmGain = this.audioContext.createGain();
    this.localArmGain.gain.value = this.localTrackArmed ? 1 : 0;

    this.localMuteGain = this.audioContext.createGain();
    this.localMuteGain.gain.value = this.localTrackMuted ? 0 : 1;

    this.localMonitorGain = this.audioContext.createGain();
    this.localMonitorGain.gain.value = this.monitoringEnabled ? 1 : 0;

    // Connect the chain
    // bridgeWorklet -> inputGain -> analyser
    // bridgeWorklet -> inputGain -> armGain -> effects -> muteGain -> monitorGain -> masterGain
    this.bridgeWorkletNode.connect(this.localInputGain);
    this.localInputGain.connect(this.localAnalyser);
    this.localInputGain.connect(this.localArmGain);

    // Create effects processor and restore saved settings
    this.localEffectsProcessor = new ExtendedEffectsProcessor(this.audioContext);

    // Restore effects settings that were saved before switching
    if (savedEffectsSettings) {
      console.log('[AudioEngine] Restoring effects settings to new processor');
      this.localEffectsProcessor.updateSettings(savedEffectsSettings);
    }

    this.localArmGain.connect(this.localEffectsProcessor.getInputNode());
    this.localEffectsProcessor.connect(this.localMuteGain);
    this.localMuteGain.connect(this.localMonitorGain);
    this.localMonitorGain.connect(this.masterGain);

    // Also connect to broadcast for WebRTC
    if (this.broadcastMixerGain) {
      this.localMuteGain.connect(this.broadcastMixerGain);
    }

    console.log('[AudioEngine] Bridge audio enabled, signal chain connected. Gain values:', {
      inputGain: this.localInputGain.gain.value,
      armGain: this.localArmGain.gain.value,
      muteGain: this.localMuteGain.gain.value,
      monitorGain: this.localMonitorGain.gain.value,
      localTrackArmed: this.localTrackArmed,
      localTrackMuted: this.localTrackMuted,
      monitoringEnabled: this.monitoringEnabled,
    });
  }

  /**
   * Disable bridge audio mode and clean up resources.
   */
  disableBridgeAudio(): void {
    console.log('[AudioEngine] Disabling bridge audio mode');
    this.useBridgeAudio = false;
    this.bridgeWorkletReady = false;

    if (this.bridgeWorkletNode) {
      // Tell worklet to reset its buffer
      this.bridgeWorkletNode.port.postMessage({ type: 'reset' });
      this.bridgeWorkletNode.disconnect();
      this.bridgeWorkletNode = null;
    }
  }

  // Counter for bridge audio logging
  private bridgeAudioLogCounter = 0;

  /**
   * Push audio samples from native bridge into the audio engine.
   * Called when we receive binary audio data from the WebSocket.
   * Sends samples to the AudioWorklet via postMessage for processing.
   * @param samples Interleaved stereo Float32Array samples
   */
  pushBridgeAudio(samples: Float32Array): void {
    if (!this.useBridgeAudio || !this.bridgeWorkletReady || !this.bridgeWorkletNode) {
      // Log occasionally if bridge mode not enabled
      if (this.bridgeAudioLogCounter++ % 500 === 0) {
        console.warn('[AudioEngine] pushBridgeAudio called but bridge not ready:', {
          useBridgeAudio: this.useBridgeAudio,
          bridgeWorkletReady: this.bridgeWorkletReady,
          hasBridgeWorkletNode: !!this.bridgeWorkletNode,
        });
      }
      return;
    }

    // Validate samples
    if (!samples || samples.length === 0) {
      return;
    }

    // Send samples to the AudioWorklet for buffering and playback
    // The worklet runs on the audio thread and handles timing
    this.bridgeWorkletNode.port.postMessage({
      type: 'audio',
      samples: samples, // Float32Array is transferable
    });

    // Log occasionally to confirm audio is flowing
    if (this.bridgeAudioLogCounter++ % 500 === 0) {
      const peak = samples.reduce((max, s) => Math.max(max, Math.abs(s)), 0);
      console.log('[AudioEngine] pushBridgeAudio -> worklet:', {
        sampleCount: samples.length,
        peak: peak.toFixed(4),
        armGain: this.localArmGain?.gain.value,
        monitorGain: this.localMonitorGain?.gain.value,
        contextState: this.audioContext?.state,
      });
    }
  }

  /**
   * Check if bridge audio mode is active
   */
  isBridgeAudioEnabled(): boolean {
    return this.useBridgeAudio;
  }

  async addRemoteStream(userId: string, stream: MediaStream): Promise<void> {
    if (!this.audioContext || !this.masterGain) {
      console.warn('[AudioEngine] Cannot add remote stream: AudioContext not initialized');
      return;
    }

    // iOS Safari: Ensure AudioContext is running before connecting remote stream
    // Unlike local getUserMedia, remote WebRTC streams don't auto-resume the context
    if (this.audioContext.state === 'suspended') {
      try {
        console.log('[AudioEngine] Resuming suspended AudioContext for remote stream');
        await this.audioContext.resume();
      } catch (err) {
        console.error('[AudioEngine] Failed to resume AudioContext for remote stream:', err);
        return;
      }
    }

    // Validate stream has active audio tracks
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) {
      console.warn('[AudioEngine] Remote stream has no audio tracks:', userId);
      return;
    }

    // Log track state for debugging
    const enabledTracks = audioTracks.filter(t => t.enabled && t.readyState === 'live');
    if (enabledTracks.length === 0) {
      console.warn('[AudioEngine] Remote stream has no live enabled audio tracks:', userId,
        audioTracks.map(t => ({ enabled: t.enabled, readyState: t.readyState })));
      // Continue anyway - track might become live shortly
    }

    try {
      const source = this.audioContext.createMediaStreamSource(stream);
      const gainNode = this.audioContext.createGain();
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;

      // Create delay node for per-user latency compensation
      // Max delay of 200ms to match LatencyCompensator's maxCompensation
      const delayNode = this.audioContext.createDelay(0.2);
      delayNode.delayTime.value = 0; // Initially no delay, will be set by compensation system

      // Signal flow: source -> delayNode -> gainNode -> analyser & masterGain
      source.connect(delayNode);
      delayNode.connect(gainNode);
      gainNode.connect(analyser);
      gainNode.connect(this.masterGain);

      this.remoteStreams.set(userId, {
        userId,
        stream,
        analyser,
        gainNode,
        delayNode,
        level: 0,
      });

      console.log('[AudioEngine] Added remote stream for user:', userId,
        'AudioContext state:', this.audioContext.state);
    } catch (err) {
      console.error('[AudioEngine] Failed to add remote stream:', userId, err);
      // On iOS Safari, this can fail if the stream is invalid or context is in wrong state
      // Try to resume and retry once
      if (this.audioContext.state !== 'running') {
        try {
          await this.audioContext.resume();
          console.log('[AudioEngine] Retrying remote stream connection after resume');
          // Retry the connection
          const source = this.audioContext.createMediaStreamSource(stream);
          const gainNode = this.audioContext.createGain();
          const analyser = this.audioContext.createAnalyser();
          analyser.fftSize = 256;
          const delayNode = this.audioContext.createDelay(0.2);
          delayNode.delayTime.value = 0;
          source.connect(delayNode);
          delayNode.connect(gainNode);
          gainNode.connect(analyser);
          gainNode.connect(this.masterGain);
          this.remoteStreams.set(userId, { userId, stream, analyser, gainNode, delayNode, level: 0 });
          console.log('[AudioEngine] Remote stream connected after retry:', userId);
        } catch (retryErr) {
          console.error('[AudioEngine] Retry failed for remote stream:', userId, retryErr);
        }
      }
    }
  }

  /**
   * Set the latency compensation delay for a specific remote user's stream.
   * This is used to synchronize audio from users with different network latencies.
   * @param userId The user ID to set compensation for
   * @param delayMs Delay in milliseconds (0-200)
   */
  setRemoteCompensationDelay(userId: string, delayMs: number): void {
    const streamData = this.remoteStreams.get(userId);
    if (streamData?.delayNode && this.audioContext) {
      const clampedDelay = Math.max(0, Math.min(0.2, delayMs / 1000)); // Clamp to 0-200ms
      streamData.delayNode.delayTime.setTargetAtTime(
        clampedDelay,
        this.audioContext.currentTime,
        0.05 // Smooth transition over 50ms
      );
    }
  }

  /**
   * Get the current compensation delay for a remote user
   * @param userId The user ID
   * @returns Delay in milliseconds, or 0 if not found
   */
  getRemoteCompensationDelay(userId: string): number {
    const streamData = this.remoteStreams.get(userId);
    return streamData?.delayNode ? streamData.delayNode.delayTime.value * 1000 : 0;
  }

  removeRemoteStream(userId: string): void {
    const streamData = this.remoteStreams.get(userId);
    if (streamData) {
      streamData.delayNode?.disconnect();
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

  /**
   * Mute or unmute a remote user's audio stream
   * Stores the pre-mute volume so it can be restored when unmuted
   */
  setRemoteMuted(userId: string, muted: boolean): void {
    const streamData = this.remoteStreams.get(userId);
    if (streamData?.gainNode && this.audioContext) {
      if (muted) {
        // Store the current volume before muting
        streamData.preMuteVolume = streamData.gainNode.gain.value;
        streamData.gainNode.gain.setTargetAtTime(0, this.audioContext.currentTime, 0.01);
      } else {
        // Restore the pre-mute volume (default to 1 if not stored)
        const volume = streamData.preMuteVolume ?? 1;
        streamData.gainNode.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.01);
      }
    }
  }

  /**
   * Add an external audio source (like Lyria AI music) to the song bus.
   * This routes external MediaStreams through the song gain, then master gain and effects.
   * The stream will go through: songGain → masterGain → masterEffects → output
   * @param id Unique identifier for this source
   * @param stream MediaStream from the external source
   * @param volume Initial volume (0-1)
   */
  async addExternalAudioSource(id: string, stream: MediaStream, volume: number = 1): Promise<void> {
    if (!this.audioContext || !this.songGain) {
      console.warn('[AudioEngine] Cannot add external source: not initialized');
      return;
    }

    // Ensure AudioContext is running before adding external source
    if (this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log('[AudioEngine] Resumed AudioContext for external source:', id);
      } catch (err) {
        console.warn('[AudioEngine] Failed to resume AudioContext for external source:', err);
      }
    }

    // Remove existing source with same ID
    this.removeExternalAudioSource(id);

    const source = this.audioContext.createMediaStreamSource(stream);
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = Math.max(0, Math.min(1, volume));

    source.connect(gainNode);
    gainNode.connect(this.songGain);

    this.externalSources.set(id, { source, gainNode, stream });
    console.log('[AudioEngine] External audio source added:', id);
  }

  /**
   * Remove an external audio source
   */
  removeExternalAudioSource(id: string): void {
    const data = this.externalSources.get(id);
    if (data) {
      data.gainNode.disconnect();
      data.source.disconnect();
      this.externalSources.delete(id);
      console.log('[AudioEngine] External audio source removed:', id);
    }
  }

  /**
   * Set volume for an external audio source
   */
  setExternalAudioVolume(id: string, volume: number): void {
    const data = this.externalSources.get(id);
    if (data?.gainNode && this.audioContext) {
      data.gainNode.gain.setTargetAtTime(
        Math.max(0, Math.min(1, volume)),
        this.audioContext.currentTime,
        0.01
      );
    }
  }

  /**
   * Check if an external audio source is connected
   */
  hasExternalAudioSource(id: string): boolean {
    return this.externalSources.has(id);
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

  /**
   * Set the song bus volume (controls all song-related audio: backing tracks, stems, Lyria AI, etc.)
   * @param volume Volume from 0-1
   */
  setSongVolume(volume: number): void {
    if (this.songGain) {
      this.songGain.gain.value = volume;
    }
  }

  /**
   * Get the current audio level for the song bus (0-1 normalized)
   */
  getSongLevel(): number {
    if (!this.songAnalyser) return 0;
    return this.calculateLevel(this.songAnalyser);
  }

  // Master effects chain controls
  setMasterEffectsEnabled(enabled: boolean): void {
    this.masterEffectsProcessor?.setEnabled(enabled);
  }

  isMasterEffectsEnabled(): boolean {
    return this.masterEffectsProcessor?.isEnabled() ?? false;
  }

  updateMasterEffects(settings: Partial<MasterEffectsChain>): void {
    this.masterEffectsProcessor?.updateSettings(settings);
  }

  getMasterEffectsSettings(): MasterEffectsChain | null {
    return this.masterEffectsProcessor?.getSettings() ?? null;
  }

  getMasterEffectsMetering(): { compressorReduction: number; limiterReduction: number } | null {
    return this.masterEffectsProcessor?.getMeteringData() ?? null;
  }

  getMasterEffectsLatency(): number {
    return this.masterEffectsProcessor?.getEstimatedLatency() ?? 0;
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
    console.log('[AudioEngine] setMonitoringEnabled:', enabled, 'hasGainNode:', !!this.localMonitorGain);
    this.monitoringEnabled = enabled;
    if (this.localMonitorGain) {
      this.localMonitorGain.gain.value = enabled ? 1 : 0;
      console.log('[AudioEngine] monitorGain.value set to:', this.localMonitorGain.gain.value);
    } else {
      console.warn('[AudioEngine] localMonitorGain is null, cannot set monitoring gain');
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
   * Set the local track armed state
   * When not armed, blocks all audio from being processed or monitored
   */
  setLocalTrackArmed(armed: boolean): void {
    console.log('[AudioEngine] setLocalTrackArmed:', armed, 'hasArmGain:', !!this.localArmGain);
    this.localTrackArmed = armed;
    if (this.localArmGain && this.audioContext) {
      this.localArmGain.gain.setTargetAtTime(armed ? 1 : 0, this.audioContext.currentTime, 0.01);
      console.log('[AudioEngine] armGain.value set to:', armed ? 1 : 0);
    }
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
   * Set the local track input gain in dB
   * This is separate from track volume and applies gain/attenuation to the input signal
   * @param gainDb Gain in decibels (-24 to +24 dB)
   */
  private localInputGainDb: number = 0;
  private localInputGainNode: GainNode | null = null;

  setLocalInputGainDb(gainDb: number): void {
    this.localInputGainDb = Math.max(-24, Math.min(24, gainDb));
    if (this.localInputGainNode && this.audioContext) {
      // Convert dB to linear gain: gain = 10^(dB/20)
      const linearGain = Math.pow(10, this.localInputGainDb / 20);
      this.localInputGainNode.gain.setTargetAtTime(linearGain, this.audioContext.currentTime, 0.01);
    }
  }

  /**
   * Get the current local input gain in dB
   */
  getLocalInputGainDb(): number {
    return this.localInputGainDb;
  }

  /**
   * Update the local track effects (extended - all 35 effects)
   * Updates the primary track processor
   */
  updateLocalEffects(effects: Partial<ExtendedEffectsChain>): void {
    if (this.primaryTrackId) {
      const processor = this.trackProcessors.get(this.primaryTrackId);
      processor?.updateEffects(effects);
    }
  }

  /**
   * Get the local effects processor (for direct manipulation)
   */
  getLocalEffectsProcessor(): ExtendedEffectsProcessor | null {
    return this.localEffectsProcessor;
  }

  // ==========================================
  // Multi-Track Audio Processor Management
  // ==========================================

  /**
   * Create or get a track audio processor for a specific track
   * Each track gets its own effects chain, gain controls, and routing
   * @param trackId Unique track identifier
   * @param settings Optional initial audio settings
   * @param onEffectsChange Optional callback when effects change
   * @returns The TrackAudioProcessor instance
   */
  getOrCreateTrackProcessor(
    trackId: string,
    settings?: TrackAudioSettings,
    onEffectsChange?: (effects: ExtendedEffectsChain) => void
  ): TrackAudioProcessor | null {
    if (!this.audioContext || !this.masterGain) {
      console.warn('[AudioEngine] Cannot create track processor: AudioContext not initialized');
      return null;
    }

    // Check existing processor
    let processor = this.trackProcessors.get(trackId);
    if (processor) {
      // Check if processor's AudioContext is still valid and matches current context
      // If the context was recreated (e.g., sample rate change), we need to recreate the processor
      if (processor.getAudioContext() !== this.audioContext || !processor.isContextValid()) {
        console.log(`[AudioEngine] Recreating track processor for ${trackId} - AudioContext changed`);
        processor.dispose();
        this.trackProcessors.delete(trackId);
        processor = undefined;
      } else {
        return processor;
      }
    }

    // Create new processor
    processor = new TrackAudioProcessor(
      this.audioContext,
      trackId,
      settings,
      onEffectsChange
    );

    // Connect track output to master gain
    processor.connect(this.masterGain);

    // Connect track monitor output to master gain for local monitoring
    processor.connectMonitor(this.masterGain);

    // If this is the first track, set it as primary for backward compat
    if (this.trackProcessors.size === 0) {
      this.primaryTrackId = trackId;
    }

    this.trackProcessors.set(trackId, processor);
    console.log(`[AudioEngine] Created track processor for track ${trackId}`);

    return processor;
  }

  /**
   * Get an existing track processor
   */
  getTrackProcessor(trackId: string): TrackAudioProcessor | undefined {
    return this.trackProcessors.get(trackId);
  }

  /**
   * Remove a track processor and clean up resources
   */
  removeTrackProcessor(trackId: string): void {
    const processor = this.trackProcessors.get(trackId);
    if (processor) {
      processor.dispose();
      this.trackProcessors.delete(trackId);

      // Update primary track if needed
      if (this.primaryTrackId === trackId) {
        const remaining = Array.from(this.trackProcessors.keys());
        this.primaryTrackId = remaining.length > 0 ? remaining[0] : null;
      }

      console.log(`[AudioEngine] Removed track processor for track ${trackId}`);
    }
  }

  /**
   * Get all track processors
   */
  getAllTrackProcessors(): Map<string, TrackAudioProcessor> {
    return new Map(this.trackProcessors);
  }

  /**
   * Set up MediaStream input for a track (web audio mode)
   * @param trackId The track to set up
   * @param stream MediaStream from getUserMedia
   * @param config Channel configuration
   */
  async setTrackMediaStreamInput(
    trackId: string,
    stream: MediaStream,
    config: TrackInputConfig
  ): Promise<void> {
    const processor = this.trackProcessors.get(trackId);
    if (!processor) {
      console.warn(`[AudioEngine] Cannot set input: track ${trackId} not found`);
      return;
    }

    await processor.setMediaStreamInput(stream, config);
    console.log(`[AudioEngine] Set MediaStream input for track ${trackId}`);
  }

  /**
   * Set up bridge input for a track (native bridge mode)
   * @param trackId The track to set up
   * @param config Channel configuration
   */
  async setTrackBridgeInput(trackId: string, config: TrackInputConfig): Promise<void> {
    const processor = this.trackProcessors.get(trackId);
    if (!processor) {
      console.warn(`[AudioEngine] Cannot set bridge input: track ${trackId} not found`);
      return;
    }

    await processor.setBridgeInput(config);
    console.log(`[AudioEngine] Set bridge input for track ${trackId}`);
  }

  /**
   * Push bridge audio to a specific track
   * Called when receiving audio data from native bridge with trackId
   * @param trackId The target track
   * @param samples Interleaved stereo samples
   * @param timestamp Native bridge timestamp for clock synchronization
   */
  private trackAudioLogCounter = 0;
  pushTrackBridgeAudio(trackId: string, samples: Float32Array, timestamp?: number): void {
    const processor = this.trackProcessors.get(trackId);
    if (processor) {
      processor.pushBridgeAudio(samples, timestamp);
      // Only log first push per track to confirm routing works
      if (this.trackAudioLogCounter++ === 0) {
        console.log(`[AudioEngine] Bridge audio routed to track ${trackId.slice(-8)}`);
      }
    } else if (this.trackAudioLogCounter === 0) {
      this.trackAudioLogCounter++;
      console.warn(`[AudioEngine] No processor for track ${trackId.slice(-8)}`);
    }
  }

  /**
   * Update track state (arm, mute, solo, volume, etc.)
   * @param trackId The track to update
   * @param state Partial state to update
   */
  updateTrackState(trackId: string, state: Partial<TrackAudioState>): void {
    const processor = this.trackProcessors.get(trackId);
    if (processor) {
      processor.updateState(state);
    }
  }

  /**
   * Update track effects
   * @param trackId The track to update
   * @param effects Effects settings
   */
  updateTrackEffects(trackId: string, effects: Partial<ExtendedEffectsChain>): void {
    const processor = this.trackProcessors.get(trackId);
    if (processor) {
      processor.updateEffects(effects);
    }
  }

  /**
   * Get audio levels for a track
   * @returns Object with input and output levels (0-1)
   */
  getTrackLevels(trackId: string): { input: number; output: number } {
    const processor = this.trackProcessors.get(trackId);
    if (processor) {
      return {
        input: processor.getInputLevel(),
        output: processor.getOutputLevel(),
      };
    }
    return { input: 0, output: 0 };
  }

  /**
   * Get metrics for a track (levels, effects metering, etc.)
   */
  getTrackMetrics(trackId: string) {
    const processor = this.trackProcessors.get(trackId);
    return processor?.getMetrics() ?? null;
  }

  /**
   * Set the primary track (for backward compatibility with single-track API)
   */
  setPrimaryTrack(trackId: string): void {
    if (this.trackProcessors.has(trackId)) {
      this.primaryTrackId = trackId;
    }
  }

  /**
   * Get the primary track ID
   */
  getPrimaryTrackId(): string | null {
    return this.primaryTrackId;
  }

  /**
   * Enable multi-track bridge audio mode
   * Sets up bridge input for all configured tracks
   * @param trackConfigs Array of track configurations
   */
  async enableMultiTrackBridgeAudio(
    trackConfigs: Array<{ trackId: string; config: TrackInputConfig; settings?: TrackAudioSettings }>
  ): Promise<void> {
    if (!this.audioContext || !this.masterGain) {
      console.warn('[AudioEngine] Cannot enable multi-track bridge: AudioContext not initialized');
      return;
    }

    console.log('[AudioEngine] Enabling multi-track bridge audio for', trackConfigs.length, 'tracks');

    for (const { trackId, config, settings } of trackConfigs) {
      // Create or get processor
      const processor = this.getOrCreateTrackProcessor(trackId, settings);
      if (processor) {
        // Set up bridge input
        await processor.setBridgeInput(config);
      }
    }

    this.useBridgeAudio = true;
    console.log('[AudioEngine] Multi-track bridge audio enabled');
  }

  /**
   * Disable multi-track bridge audio and clean up
   */
  disableMultiTrackBridgeAudio(): void {
    console.log('[AudioEngine] Disabling multi-track bridge audio');

    for (const processor of this.trackProcessors.values()) {
      processor.disconnectInputSource();
    }

    this.useBridgeAudio = false;
  }

  /**
   * Enable or disable "Live Jamming Mode" for ultra-low latency.
   * This mode activates multiple optimizations:
   * - Aggressive jitter buffer settings (min latency)
   * - Effects chain bypass optimization
   * - Lower buffer targets
   *
   * Use this mode for real-time collaborative jamming where
   * latency is critical. May sacrifice some audio stability
   * on poor network connections.
   *
   * @param enabled Whether to enable live jamming mode
   */
  setLiveJammingMode(enabled: boolean): void {
    // Set jitter buffer mode
    if (enabled) {
      this.jitterBuffer.setMode('live-jamming');
    } else {
      this.jitterBuffer.setMode('balanced');
    }

    // Set effects processor low-latency mode
    if (this.localEffectsProcessor) {
      this.localEffectsProcessor.setLowLatencyMode(enabled);
    }

    console.log(`[AudioEngine] Live Jamming Mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`[AudioEngine] Estimated latency savings: ${enabled ? '~30-40ms round-trip' : 'none (balanced mode)'}`);
  }

  /**
   * Check if live jamming mode is currently enabled
   */
  isLiveJammingMode(): boolean {
    return this.jitterBuffer.getMode() === 'live-jamming';
  }

  /**
   * Get the current jitter buffer mode
   */
  getJitterBufferMode(): 'live-jamming' | 'balanced' | 'stable' | 'custom' {
    return this.jitterBuffer.getMode();
  }

  /**
   * Set the jitter buffer mode directly
   * @param mode 'live-jamming' | 'balanced' | 'stable'
   */
  setJitterBufferMode(mode: 'live-jamming' | 'balanced' | 'stable'): void {
    this.jitterBuffer.setMode(mode);
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

  /**
   * Create a mixed broadcast stream for WebRTC that combines:
   * - All armed user tracks (after effects processing)
   * - MIDI loop audio (optional)
   *
   * This is the stream sent to other participants in a jam session.
   * @param midiStream Optional MediaStream from SoundEngine.enableBroadcast()
   * @param midiVolume Volume for MIDI audio (0-1)
   * @returns MediaStream containing the mixed audio for WebRTC
   */
  createBroadcastStream(midiStream?: MediaStream | null, midiVolume: number = 0.8): MediaStream | null {
    if (!this.audioContext) {
      console.warn('[AudioEngine] Cannot create broadcast stream: audio context not initialized');
      return null;
    }

    // Create broadcast destination if not exists
    if (!this.broadcastDestination) {
      this.broadcastDestination = this.audioContext.createMediaStreamDestination();
      this.broadcastMixerGain = this.audioContext.createGain();
      this.broadcastMixerGain.connect(this.broadcastDestination);
    }

    // Connect all track processor outputs to broadcast mixer
    // Each track's output goes through its own mute/solo logic
    if (this.broadcastMixerGain) {
      for (const processor of this.trackProcessors.values()) {
        processor.getBroadcastNode().connect(this.broadcastMixerGain);
      }
      console.log(`[AudioEngine] Connected ${this.trackProcessors.size} tracks to broadcast mix`);
    }

    // Connect MIDI stream to broadcast mixer if provided
    if (midiStream && this.broadcastMixerGain) {
      if (this.midiSourceNode) {
        this.midiSourceNode.disconnect();
      }
      if (this.midiMixGain) {
        this.midiMixGain.disconnect();
      }

      this.midiSourceNode = this.audioContext.createMediaStreamSource(midiStream);
      this.midiMixGain = this.audioContext.createGain();
      this.midiMixGain.gain.value = midiVolume;

      this.midiSourceNode.connect(this.midiMixGain);
      this.midiMixGain.connect(this.broadcastMixerGain);

      console.log('[AudioEngine] MIDI stream connected to broadcast mix');
    }

    console.log('[AudioEngine] Broadcast stream created');
    return this.broadcastDestination.stream;
  }

  /**
   * Reconnect all track processors to broadcast stream
   * Call this after adding new tracks while broadcast is active
   */
  updateBroadcastConnections(): void {
    if (!this.broadcastMixerGain) return;

    for (const processor of this.trackProcessors.values()) {
      // Only connect if not already connected
      processor.getBroadcastNode().connect(this.broadcastMixerGain);
    }
  }

  /**
   * Update the MIDI volume in the broadcast mix
   */
  setBroadcastMidiVolume(volume: number): void {
    if (this.midiMixGain) {
      this.midiMixGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Get the broadcast stream if it has been created
   */
  getBroadcastStream(): MediaStream | null {
    return this.broadcastDestination?.stream || null;
  }

  /**
   * Disconnect MIDI from broadcast (e.g., when stopping loops)
   */
  disconnectMidiFromBroadcast(): void {
    if (this.midiSourceNode) {
      this.midiSourceNode.disconnect();
      this.midiSourceNode = null;
    }
    if (this.midiMixGain) {
      this.midiMixGain.disconnect();
      this.midiMixGain = null;
    }
    console.log('[AudioEngine] MIDI disconnected from broadcast');
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
      // Accept audio/* types, application/octet-stream (common fallback), and empty content types
      // The browser's decodeAudioData will fail if it's not actually audio
      const isValidContentType = contentType.startsWith('audio/') ||
        contentType === 'application/octet-stream' ||
        contentType === '';
      if (!isValidContentType) {
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
   * Get hardware output latency in milliseconds
   * This is the latency added by the audio output hardware/driver
   */
  getOutputLatency(): number {
    if (!this.audioContext) return 0;
    const outputLatency = (this.audioContext as AudioContext & { outputLatency?: number }).outputLatency ?? 0;
    return outputLatency * 1000;
  }

  /**
   * Get audio context latency in milliseconds (baseLatency only)
   * This represents the processing latency controlled by latencyHint
   */
  getContextLatency(): number {
    if (!this.audioContext) return 0;
    const baseLatency = this.audioContext.baseLatency ?? 0;
    return baseLatency * 1000;
  }

  /**
   * Get the actual buffer size in samples based on audio context's baseLatency
   * This reflects what the browser is actually using, not our config value
   */
  getActualBufferSize(): number {
    if (!this.audioContext) return this.config.bufferSize;
    const baseLatency = this.audioContext.baseLatency ?? 0;
    // Calculate buffer samples from baseLatency (which is in seconds)
    const actualBuffer = Math.round(baseLatency * this.config.sampleRate);
    // Return actual value, or config value if not available
    return actualBuffer > 0 ? actualBuffer : this.config.bufferSize;
  }

  /**
   * Get buffer latency in milliseconds based on actual audio context buffer
   */
  getBufferLatency(): number {
    if (!this.audioContext) {
      return (this.config.bufferSize / this.config.sampleRate) * 1000;
    }
    // Use the actual baseLatency from the context - this IS the buffer latency
    const baseLatency = this.audioContext.baseLatency ?? 0;
    return baseLatency * 1000;
  }

  /**
   * Get total estimated latency (processing + hardware output)
   */
  getTotalLatency(): number {
    return this.getContextLatency() + this.getOutputLatency();
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

  /**
   * Get the current audio level for the backing track (0-1 normalized)
   */
  getBackingTrackLevel(): number {
    if (!this.backingTrackAnalyser) return 0;
    return this.calculateLevel(this.backingTrackAnalyser);
  }

  /**
   * Get the current audio level for the master output (0-1 normalized)
   */
  getMasterLevel(): number {
    if (!this.masterAnalyser) return 0;
    return this.calculateLevel(this.masterAnalyser);
  }

  /**
   * Get the current audio level for a specific remote user (0-1 normalized)
   */
  getRemoteLevel(userId: string): number {
    const streamData = this.remoteStreams.get(userId);
    if (!streamData?.analyser) return 0;
    return this.calculateLevel(streamData.analyser);
  }

  /**
   * Get the current audio level for the local input (0-1 normalized)
   */
  getLocalLevel(): number {
    if (!this.localAnalyser) return 0;
    return this.calculateLevel(this.localAnalyser);
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

  // Track audio health state for recovery
  private consecutiveUnhealthyFrames: number = 0;
  private lastRecoveryTime: number = 0;
  private static readonly UNHEALTHY_THRESHOLD = 3; // Frames before triggering recovery
  private static readonly RECOVERY_COOLDOWN_MS = 5000; // Min time between recoveries

  /**
   * Calculate audio level from an analyser node using time-domain data.
   * Uses peak detection for responsive metering.
   * @param analyser The AnalyserNode to read from
   * @returns Normalized level from 0-1
   */
  private calculateLevel(analyser: AnalyserNode): number {
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);

    // Find peak amplitude (max deviation from center at 128)
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const amplitude = Math.abs(data[i] - 128);
      if (amplitude > peak) peak = amplitude;
    }

    // Normalize to 0-1 range (128 is max deviation from center)
    return peak / 128;
  }

  private startLevelMonitoring(): void {
    this.levelUpdateInterval = setInterval(() => {
      const levels = new Map<string, number>();

      // Local level (aggregate of all armed tracks)
      if (this.localAnalyser) {
        levels.set('local', this.calculateLevel(this.localAnalyser));
      }

      // Per-track levels
      for (const [trackId, processor] of this.trackProcessors) {
        levels.set(`track:${trackId}`, processor.getOutputLevel());
      }

      // Remote levels
      for (const [userId, streamData] of this.remoteStreams) {
        if (streamData.analyser) {
          levels.set(userId, this.calculateLevel(streamData.analyser));
        }
      }

      // Backing track level
      if (this.backingTrackAnalyser) {
        levels.set('backingTrack', this.calculateLevel(this.backingTrackAnalyser));
      }

      // Song bus level (all song-related audio: backing tracks + Lyria + stems)
      if (this.songAnalyser) {
        levels.set('song', this.calculateLevel(this.songAnalyser));
      }

      // Master output level
      if (this.masterAnalyser) {
        const level = this.calculateLevel(this.masterAnalyser);
        levels.set('master', level);

        // Health check: detect NaN/Infinity in level which indicates filter failure
        if (!Number.isFinite(level) || Number.isNaN(level)) {
          this.handleUnhealthyAudio();
        } else {
          this.consecutiveUnhealthyFrames = 0;
        }
      }

      this.onLevelUpdate?.(levels);
    }, 50); // 20 FPS level updates
  }

  // Handle detection of unhealthy audio (NaN/Infinity in signal)
  private handleUnhealthyAudio(): void {
    this.consecutiveUnhealthyFrames++;

    if (this.consecutiveUnhealthyFrames >= AudioEngine.UNHEALTHY_THRESHOLD) {
      const now = Date.now();
      if (now - this.lastRecoveryTime > AudioEngine.RECOVERY_COOLDOWN_MS) {
        this.recoverFromAudioError();
        this.lastRecoveryTime = now;
        this.consecutiveUnhealthyFrames = 0;
      }
    }
  }

  // Attempt to recover from audio processing errors
  private recoverFromAudioError(): void {
    console.warn('[AudioEngine] Detected audio processing error, attempting recovery...');

    try {
      // Recover local effects processor
      if (this.localEffectsProcessor) {
        this.localEffectsProcessor.recoverFromError();
      }

      // Recover master effects processor
      if (this.masterEffectsProcessor) {
        this.masterEffectsProcessor.recoverFromError();
      }

      // Resume audio context if suspended
      if (this.audioContext?.state === 'suspended') {
        this.audioContext.resume().catch(e => {
          console.error('[AudioEngine] Failed to resume AudioContext:', e);
        });
      }

      console.log('[AudioEngine] Recovery attempt complete - effects bypassed');
    } catch (e) {
      console.error('[AudioEngine] Recovery failed:', e);
    }
  }

  // Public method to manually trigger recovery
  public forceRecovery(): void {
    console.log('[AudioEngine] Manual recovery triggered');
    this.recoverFromAudioError();
  }

  // Original console.warn reference for cleanup
  private originalConsoleWarn: typeof console.warn | null = null;
  private filterErrorCount = 0;
  private filterErrorDebounceTimeout: NodeJS.Timeout | null = null;

  // Install console warning interceptor to detect BiquadFilterNode errors immediately
  private installFilterErrorDetection(): void {
    // Only install once
    if (this.originalConsoleWarn) return;

    this.originalConsoleWarn = console.warn.bind(console);
    // Keep a stable reference that won't be nulled out
    const savedOriginalWarn = this.originalConsoleWarn;
    const self = this;

    console.warn = function (...args: unknown[]) {
      // Check if this is a BiquadFilterNode error
      const message = args[0];
      if (typeof message === 'string' && message.includes('BiquadFilterNode') && message.includes('state is bad')) {
        self.filterErrorCount++;

        // Debounce recovery - wait for errors to stop before recovering
        if (self.filterErrorDebounceTimeout) {
          clearTimeout(self.filterErrorDebounceTimeout);
        }

        self.filterErrorDebounceTimeout = setTimeout(() => {
          console.log(`[AudioEngine] Detected ${self.filterErrorCount} BiquadFilterNode errors, triggering recovery...`);
          self.filterErrorCount = 0;

          const now = Date.now();
          if (now - self.lastRecoveryTime > AudioEngine.RECOVERY_COOLDOWN_MS) {
            self.recoverFromAudioError();
            self.lastRecoveryTime = now;
          }
        }, 100); // Wait 100ms for errors to stop
      }

      // Call original console.warn using the stable reference
      // This prevents "Cannot read properties of null" if uninstall races with this call
      savedOriginalWarn.apply(console, args);
    };

    console.log('[AudioEngine] BiquadFilterNode error detection installed');
  }

  // Uninstall console warning interceptor
  private uninstallFilterErrorDetection(): void {
    if (this.originalConsoleWarn) {
      console.warn = this.originalConsoleWarn;
      this.originalConsoleWarn = null;
    }
    if (this.filterErrorDebounceTimeout) {
      clearTimeout(this.filterErrorDebounceTimeout);
      this.filterErrorDebounceTimeout = null;
    }
  }

  async resume(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  dispose(): void {
    // Uninstall console warning interceptor
    this.uninstallFilterErrorDetection();

    if (this.levelUpdateInterval) {
      clearInterval(this.levelUpdateInterval);
      this.levelUpdateInterval = null;
    }

    this.stopBackingTrack();
    this.stopStemmedTrack();

    // Clean up track processors
    for (const processor of this.trackProcessors.values()) {
      processor.dispose();
    }
    this.trackProcessors.clear();
    this.primaryTrackId = null;

    // Clean up external audio sources
    for (const data of this.externalSources.values()) {
      data.gainNode?.disconnect();
      data.source?.disconnect();
    }
    this.externalSources.clear();

    for (const streamData of this.remoteStreams.values()) {
      streamData.gainNode?.disconnect();
      streamData.stream.getTracks().forEach((track) => track.stop());
    }
    this.remoteStreams.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Clean up broadcast resources
    this.disconnectMidiFromBroadcast();
    this.broadcastMixerGain?.disconnect();
    this.broadcastMixerGain = null;
    this.broadcastDestination = null;

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
    this.localInputGainNode?.disconnect();
    this.localInputGainNode = null;
    this.localArmGain?.disconnect();
    this.localArmGain = null;
    this.localMuteGain?.disconnect();
    this.localMuteGain = null;
    this.localEffectsProcessor?.dispose();
    this.localEffectsProcessor = null;

    this.masterEffectsProcessor?.dispose();
    this.masterEffectsProcessor = null;

    this.workletNode?.disconnect();
    this.masterGain?.disconnect();
    this.songGain?.disconnect();
    this.songAnalyser?.disconnect();
    this.backingTrackGain?.disconnect();
    this.backingTrackAnalyser?.disconnect();
    this.masterAnalyser?.disconnect();

    this.audioContext?.close();
    this.audioContext = null;
  }
}
