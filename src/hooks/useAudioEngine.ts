'use client';

import { useCallback, useEffect, useRef } from 'react';
import { AudioEngine, type CaptureAudioOptions } from '@/lib/audio/audio-engine';
import { useAudioStore } from '@/stores/audio-store';
import { useRoomStore } from '@/stores/room-store';
import { useBridgeAudioStore } from '@/stores/bridge-audio-store';
import type { BackingTrack, TrackAudioSettings } from '@/types';

// Singleton audio engine instance - shared across all components
// This prevents issues when multiple components call useAudioEngine()
// and ensures the engine persists across component remounts
let globalEngine: AudioEngine | null = null;
let globalEngineInitPromise: Promise<AudioEngine> | null = null;

export function useAudioEngine() {
  const animationFrameRef = useRef<number | null>(null);
  const performanceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get values from stores - only subscribe to values we need reactively
  // For setter functions, use getState() inside callbacks to avoid dependency issues
  const {
    settings,
    isInitialized,
    isPlaying,
    audioContext,
    backingTrackAnalyser,
    masterAnalyser,
  } = useAudioStore();

  const {
    currentTrack,
    stemMixState,
    stemsAvailable,
  } = useRoomStore();

  // Initialize audio engine (singleton pattern)
  // Uses getState() for all store setters to avoid dependency issues
  const initialize = useCallback(async () => {
    // Get store setters via getState() to avoid infinite loop issues
    const {
      setInitialized,
      setLocalLevel,
      setPerformanceMetrics,
      setInputDevices,
      setOutputDevices,
      setAudioContext,
      setBackingTrackAnalyser,
      setMasterAnalyser,
    } = useAudioStore.getState();
    const { setAudioLevels } = useRoomStore.getState();

    // Return existing engine if already initialized
    if (globalEngine) {
      console.log('Audio engine already initialized (singleton)');
      // Update state with existing analyser nodes
      setAudioContext(globalEngine.getAudioContext());
      setBackingTrackAnalyser(globalEngine.getBackingTrackAnalyser());
      setMasterAnalyser(globalEngine.getMasterAnalyser());
      return globalEngine;
    }

    // If initialization is in progress, wait for it
    if (globalEngineInitPromise) {
      console.log('Audio engine initialization in progress, waiting...');
      const engine = await globalEngineInitPromise;
      // Update state with analyser nodes after waiting
      setAudioContext(engine.getAudioContext());
      setBackingTrackAnalyser(engine.getBackingTrackAnalyser());
      setMasterAnalyser(engine.getMasterAnalyser());
      return engine;
    }

    console.log('Initializing audio engine...');

    // Create initialization promise to prevent race conditions
    globalEngineInitPromise = (async () => {
      const engine = new AudioEngine({
        sampleRate: settings.sampleRate,
        bufferSize: settings.bufferSize,
        autoJitterBuffer: settings.autoJitterBuffer,
        enableProcessing: true,
      });

      await engine.initialize();
      console.log('Audio engine initialized successfully');

      // Set up level monitoring - use getState() inside callback
      engine.setOnLevelUpdate((levels) => {
        useRoomStore.getState().setAudioLevels(levels);
        const localLevel = levels.get('local') || 0;
        useAudioStore.getState().setLocalLevel(localLevel);
      });

      globalEngine = engine;
      setInitialized(true);

      // Expose engine globally for native bridge audio integration
      // This allows the native bridge to push audio samples directly
      if (typeof window !== 'undefined') {
        (window as any).__openStudioAudioEngine = engine;
      }

      // Start performance monitoring
      // Note: We get fresh state inside the interval to avoid stale closures
      if (!performanceIntervalRef.current) {
        performanceIntervalRef.current = setInterval(() => {
          if (globalEngine) {
            // Check if native bridge is active
            const bridgeState = useBridgeAudioStore.getState();
            const useNativeBridge = bridgeState.isConnected && bridgeState.preferNativeBridge && bridgeState.isRunning;

            let contextLatency: number;
            let outputLatency: number;
            let actualBufferSize: number;

            if (useNativeBridge) {
              // Use native bridge latency (much lower than Web Audio)
              contextLatency = bridgeState.latency.input;
              outputLatency = bridgeState.latency.output;
              actualBufferSize = bridgeState.bufferSize;
            } else {
              // Get actual latency values from the audio context
              contextLatency = globalEngine.getContextLatency(); // baseLatency (processing)
              outputLatency = globalEngine.getOutputLatency(); // hardware output latency
              actualBufferSize = globalEngine.getActualBufferSize(); // buffer in samples
            }

            // Get effects metering if effects processor exists
            const effectsMetering = globalEngine.getLocalEffectsMetering();
            let effectsProcessingTime = 0;

            // Estimate effects processing time based on active effects
            // This is a rough estimate since actual processing happens in real-time
            if (effectsMetering) {
              // If compressor or limiter is actively reducing gain, effects are processing
              const isProcessing = Math.abs(effectsMetering.compressorReduction) > 0.1 ||
                                   Math.abs(effectsMetering.limiterReduction) > 0.1 ||
                                   !effectsMetering.noiseGateOpen;
              // Estimate ~0.1-0.5ms for effects processing when active
              effectsProcessingTime = isProcessing ? 0.2 : 0.05;
            }

            useAudioStore.getState().setPerformanceMetrics({
              audioContextLatency: contextLatency,
              outputLatency: outputLatency,
              effectsProcessingTime,
              totalLatency: contextLatency + outputLatency,
              currentBufferSize: actualBufferSize,
            });
          }
        }, 200); // Update every 200ms
      }

      // Get available devices
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputDevices = devices.filter((d) => d.kind === 'audiooutput');
        useAudioStore.getState().setInputDevices(devices.filter((d) => d.kind === 'audioinput'));
        useAudioStore.getState().setOutputDevices(outputDevices);

        // Auto-apply saved output device if it exists and is still available
        const savedOutputDeviceId = useAudioStore.getState().outputDeviceId;
        if (savedOutputDeviceId && savedOutputDeviceId !== 'default') {
          const deviceExists = outputDevices.some((d) => d.deviceId === savedOutputDeviceId);
          if (deviceExists) {
            console.log('[AudioEngine] Restoring saved output device:', savedOutputDeviceId);
            await engine.setOutputDevice(savedOutputDeviceId);
          } else {
            console.warn('[AudioEngine] Saved output device no longer available:', savedOutputDeviceId);
            // Clear invalid device ID
            useAudioStore.getState().setOutputDevice('default');
          }
        }
      } catch (err) {
        console.warn('Failed to enumerate devices:', err);
      }

      return engine;
    })();

    try {
      const engine = await globalEngineInitPromise;

      // Store analyser nodes in state so they trigger re-renders
      // Get fresh setters in case state changed during async operations
      const audioStore = useAudioStore.getState();
      audioStore.setAudioContext(engine.getAudioContext());
      audioStore.setBackingTrackAnalyser(engine.getBackingTrackAnalyser());
      audioStore.setMasterAnalyser(engine.getMasterAnalyser());

      console.log('Audio engine analysers ready:', {
        backingTrackAnalyser: !!engine.getBackingTrackAnalyser(),
        masterAnalyser: !!engine.getMasterAnalyser(),
      });

      return engine;
    } finally {
      globalEngineInitPromise = null;
    }
  }, [settings]);

  // Capture local audio
  const startCapture = useCallback(async (trackSettings?: TrackAudioSettings) => {
    if (!globalEngine) {
      await initialize();
    }

    // Build capture options from track settings
    // Note: echoCancellation, noiseSuppression, autoGainControl are always disabled
    // in the audio engine for lowest latency
    const captureOptions: CaptureAudioOptions = trackSettings ? {
      deviceId: trackSettings.inputDeviceId,
      channelConfig: trackSettings.channelConfig,
      sampleRate: trackSettings.sampleRate,
    } : {};

    const stream = await globalEngine!.captureLocalAudio(captureOptions);
    useAudioStore.getState().setCapturing(true);
    return stream;
  }, [initialize]);

  // Stop capture
  const stopCapture = useCallback(() => {
    const { setCapturing, setMuted } = useAudioStore.getState();
    setCapturing(false);
    setMuted(true);
  }, []);

  // Recapture audio with new settings (e.g., when user changes device or channel config)
  // This sets up the MediaStream input for the TrackAudioProcessor
  const recaptureWithSettings = useCallback(async (trackId: string, trackSettings: TrackAudioSettings) => {
    if (!globalEngine) {
      console.warn('[useAudioEngine] Cannot recapture: engine not initialized');
      return null;
    }

    console.log('[useAudioEngine] Recapturing audio with new settings:', {
      trackId,
      deviceId: trackSettings.inputDeviceId,
      channelConfig: trackSettings.channelConfig,
    });

    const captureOptions: CaptureAudioOptions = {
      deviceId: trackSettings.inputDeviceId,
      channelConfig: trackSettings.channelConfig,
      sampleRate: trackSettings.sampleRate,
    };

    // Get the media stream
    const stream = await globalEngine.captureLocalAudio(captureOptions);

    // Set up TrackAudioProcessor with this stream
    if (stream && trackId) {
      await globalEngine.setTrackMediaStreamInput(trackId, stream, {
        channelConfig: trackSettings.channelConfig,
      });
      console.log(`[useAudioEngine] Connected MediaStream to TrackAudioProcessor for ${trackId}`);
    }

    return stream;
  }, []);

  // Mute/unmute local audio
  const toggleMute = useCallback((muted: boolean) => {
    useAudioStore.getState().setMuted(muted);
  }, []);

  // Add remote stream (async for iOS Safari AudioContext resume)
  const addRemoteStream = useCallback(async (userId: string, stream: MediaStream) => {
    await globalEngine?.addRemoteStream(userId, stream);
  }, []);

  // Remove remote stream
  const removeRemoteStream = useCallback((userId: string) => {
    globalEngine?.removeRemoteStream(userId);
  }, []);

  // Set remote user volume
  const setRemoteVolume = useCallback((userId: string, volume: number) => {
    globalEngine?.setRemoteVolume(userId, volume);
  }, []);

  // Set remote user muted state
  const setRemoteMuted = useCallback((userId: string, muted: boolean) => {
    globalEngine?.setRemoteMuted(userId, muted);
  }, []);

  // Set remote user latency compensation delay
  const setRemoteCompensationDelay = useCallback((userId: string, delayMs: number) => {
    globalEngine?.setRemoteCompensationDelay(userId, delayMs);
  }, []);

  // Set master volume
  const setMasterVolume = useCallback((volume: number) => {
    globalEngine?.setMasterVolume(volume);
    useAudioStore.getState().setMasterVolume(volume);
  }, []);

  // Set backing track volume
  const setBackingTrackVolume = useCallback((volume: number) => {
    globalEngine?.setBackingTrackVolume(volume);
    useAudioStore.getState().setBackingTrackVolume(volume);
  }, []);

  // Set song volume (controls all song-related audio: backing tracks, stems, Lyria AI, etc.)
  const setSongVolume = useCallback((volume: number) => {
    globalEngine?.setSongVolume(volume);
    useAudioStore.getState().setSongVolume(volume);
  }, []);

  // Set output device
  const setOutputDevice = useCallback(async (deviceId: string) => {
    await globalEngine?.setOutputDevice(deviceId);
    useAudioStore.getState().setOutputDevice(deviceId);
  }, []);

  // Set monitoring enabled/disabled
  const setMonitoringEnabled = useCallback((enabled: boolean) => {
    globalEngine?.setMonitoringEnabled(enabled);
  }, []);

  // Set monitoring volume
  const setMonitoringVolume = useCallback((volume: number) => {
    globalEngine?.setMonitoringVolume(volume);
  }, []);

  // Set local track armed state (blocks audio when unarmed)
  const setLocalTrackArmed = useCallback((armed: boolean) => {
    globalEngine?.setLocalTrackArmed(armed);
  }, []);

  // Set local track muted state (for mute/solo)
  const setLocalTrackMuted = useCallback((muted: boolean) => {
    globalEngine?.setLocalTrackMuted(muted);
  }, []);

  // Set local track volume
  const setLocalTrackVolume = useCallback((volume: number) => {
    globalEngine?.setLocalTrackVolume(volume);
  }, []);

  // Set local track input gain in dB (-24 to +24 dB)
  const setLocalInputGainDb = useCallback((gainDb: number) => {
    globalEngine?.setLocalInputGainDb(gainDb);
  }, []);

  // Update local effects (extended chain - all 35 effects)
  const updateLocalEffects = useCallback((effects: Partial<import('@/types').ExtendedEffectsChain>) => {
    globalEngine?.updateLocalEffects(effects);
  }, []);

  // Set local monitoring enabled (for browser-side WET monitoring)
  const setLocalMonitoring = useCallback((enabled: boolean) => {
    globalEngine?.setMonitoringEnabled(enabled);
  }, []);

  // Check if backing track audio is available for analysis
  const hasBackingTrackAudio = useCallback((): boolean => {
    return globalEngine?.hasBackingTrackAudio() || false;
  }, []);

  // External audio sources (like Lyria AI music)
  const addExternalAudioSource = useCallback((id: string, stream: MediaStream, volume: number = 1) => {
    globalEngine?.addExternalAudioSource(id, stream, volume);
  }, []);

  const removeExternalAudioSource = useCallback((id: string) => {
    globalEngine?.removeExternalAudioSource(id);
  }, []);

  const setExternalAudioVolume = useCallback((id: string, volume: number) => {
    globalEngine?.setExternalAudioVolume(id, volume);
  }, []);

  const hasExternalAudioSource = useCallback((id: string): boolean => {
    return globalEngine?.hasExternalAudioSource(id) || false;
  }, []);

  // Load and play backing track
  // Returns true if loading was successful, false otherwise
  const loadBackingTrack = useCallback(async (track: BackingTrack): Promise<boolean> => {
    if (!globalEngine) {
      console.error('Audio engine not initialized');
      return false;
    }

    const { setDuration } = useAudioStore.getState();
    const { setWaveformData } = useRoomStore.getState();

    // Skip loading for YouTube tracks (handled by iframe)
    if (track.youtubeId) {
      console.log('YouTube track - skipping audio engine load');
      setDuration(track.duration);
      setWaveformData(null); // No waveform for YouTube
      return true; // YouTube tracks don't need audio engine loading
    }

    // Validate track URL exists
    if (!track.url) {
      console.error('Track URL is missing:', track.id, track.name);
      return false;
    }

    try {
      console.log('Loading track:', track.name, 'URL:', track.url);
      await globalEngine.loadBackingTrack(track.url);
      // Use actual buffer duration if available, otherwise use track.duration
      const actualDuration = globalEngine.getDuration() || track.duration;
      setDuration(actualDuration);

      // Extract real waveform data from the audio buffer
      const waveform = globalEngine.extractWaveformData(300);
      setWaveformData(waveform);
    } catch (error) {
      console.error('Failed to load backing track:', error);
      // Still set duration from metadata
      setDuration(track.duration);
      setWaveformData(null);
      return false; // Loading failed
    }

    // Load stems if available
    if (track.stems) {
      const stemPromises = [];
      if (track.stems.vocals) {
        stemPromises.push(globalEngine.loadStem('vocals', track.stems.vocals));
      }
      if (track.stems.drums) {
        stemPromises.push(globalEngine.loadStem('drums', track.stems.drums));
      }
      if (track.stems.bass) {
        stemPromises.push(globalEngine.loadStem('bass', track.stems.bass));
      }
      if (track.stems.other) {
        stemPromises.push(globalEngine.loadStem('other', track.stems.other));
      }
      await Promise.all(stemPromises);
    }

    return true; // Loading succeeded
  }, []);

  // Play backing track with sync
  const playBackingTrack = useCallback((syncTimestamp: number, offset: number = 0) => {
    if (!globalEngine) {
      console.error('Audio engine not ready for playback');
      return;
    }

    // Check if buffer is loaded
    if (!globalEngine.getDuration()) {
      console.error('No audio buffer loaded');
      return;
    }

    // Ensure audio context is resumed
    globalEngine.resume().catch(console.error);

    if (stemsAvailable) {
      globalEngine.playStemmedTrack(syncTimestamp, offset);
    } else {
      globalEngine.playBackingTrack(syncTimestamp, offset);
    }
    useAudioStore.getState().setPlaying(true);

    // Start time update loop
    const updateTime = () => {
      if (globalEngine?.isCurrentlyPlaying()) {
        useAudioStore.getState().setCurrentTime(globalEngine.getCurrentTime());
        animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    };
    updateTime();
  }, [stemsAvailable]);

  // Pause backing track
  const pauseBackingTrack = useCallback(() => {
    if (!globalEngine) return;

    if (stemsAvailable) {
      globalEngine.stopStemmedTrack();
    } else {
      globalEngine.stopBackingTrack();
    }
    useAudioStore.getState().setPlaying(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [stemsAvailable]);

  // Seek to position
  const seekTo = useCallback((time: number, syncTimestamp: number) => {
    pauseBackingTrack();
    playBackingTrack(syncTimestamp, time);
    useAudioStore.getState().setCurrentTime(time);
  }, [pauseBackingTrack, playBackingTrack]);

  // Toggle stem
  const toggleStem = useCallback((stem: string, enabled: boolean) => {
    globalEngine?.setStemEnabled(stem, enabled);
  }, []);

  // Set stem volume
  const setStemVolume = useCallback((stem: string, volume: number) => {
    globalEngine?.setStemVolume(stem, volume);
  }, []);

  // ============================================================================
  // Multi-track playback
  // ============================================================================

  // Load a track for multi-track playback
  const loadMultiTrack = useCallback(async (trackId: string, url: string): Promise<boolean> => {
    if (!globalEngine) return false;
    return globalEngine.loadMultiTrack(trackId, url);
  }, []);

  // Check if a track is loaded
  const isMultiTrackLoaded = useCallback((trackId: string): boolean => {
    return globalEngine?.isMultiTrackLoaded(trackId) ?? false;
  }, []);

  // Play multiple tracks simultaneously
  const playMultiTracks = useCallback((
    syncTimestamp: number,
    trackConfigs: Array<{ trackId: string; offset: number; volume: number; muted: boolean }>
  ) => {
    if (!globalEngine) return;
    globalEngine.playMultiTracks(syncTimestamp, trackConfigs);
    useAudioStore.getState().setPlaying(true);

    // Start time update animation
    const updateTime = () => {
      if (!globalEngine) return;
      const currentTime = globalEngine.getCurrentTime();
      useAudioStore.getState().setCurrentTime(currentTime);
      animationFrameRef.current = requestAnimationFrame(updateTime);
    };
    animationFrameRef.current = requestAnimationFrame(updateTime);
  }, []);

  // Update volume for a track during playback
  const setMultiTrackVolume = useCallback((trackId: string, volume: number, muted: boolean) => {
    globalEngine?.setMultiTrackVolume(trackId, volume, muted);
  }, []);

  // Stop multi-track playback
  const stopMultiTracks = useCallback(() => {
    if (!globalEngine) return;
    globalEngine.stopMultiTracks();
    useAudioStore.getState().setPlaying(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  // Clear all loaded multi-tracks
  const clearMultiTracks = useCallback(() => {
    globalEngine?.clearMultiTracks();
  }, []);

  // Resume audio context (required after user interaction)
  const resume = useCallback(async () => {
    await globalEngine?.resume();
  }, []);

  // Set callback for when track ends naturally
  const setOnTrackEnded = useCallback((callback: () => void) => {
    globalEngine?.setOnTrackEnded(() => {
      // Cancel animation frame when track ends
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      useAudioStore.getState().setPlaying(false);
      callback();
    });
  }, []);

  // Update jitter buffer from stats
  const updateFromStats = useCallback((stats: { jitter: number; packetLoss: number; roundTripTime: number }) => {
    if (!globalEngine) return;

    const jitterStats = {
      averageJitter: stats.jitter,
      maxJitter: stats.jitter * 1.5,
      packetLoss: stats.packetLoss,
      roundTripTime: stats.roundTripTime,
      recommendedBuffer: 256,
    };

    const newBufferSize = globalEngine.updateJitterBuffer(jitterStats);
    const { setCurrentBufferSize, setJitterStats, setConnectionQuality } = useAudioStore.getState();
    setCurrentBufferSize(newBufferSize);
    setJitterStats(globalEngine.getJitterStats());
    setConnectionQuality(globalEngine.getConnectionQuality());
  }, []);

  // Cleanup animation frame on unmount
  // Note: We don't dispose the global engine here since it's shared across components
  // The engine will be cleaned up when the user leaves the room (via destroyEngine)
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Apply stem mix state changes
  useEffect(() => {
    if (!globalEngine || !stemsAvailable) return;

    Object.entries(stemMixState).forEach(([stem, state]) => {
      globalEngine?.setStemEnabled(stem, state.enabled);
      globalEngine?.setStemVolume(stem, state.volume);
    });
  }, [stemMixState, stemsAvailable]);

  // Sync settings changes to the engine
  useEffect(() => {
    if (!globalEngine) return;

    globalEngine.updateConfig({
      sampleRate: settings.sampleRate,
      bufferSize: settings.bufferSize,
      autoJitterBuffer: settings.autoJitterBuffer,
    });
  }, [settings.sampleRate, settings.bufferSize, settings.autoJitterBuffer]);

  // Destroy the global engine (call when leaving room)
  const destroyEngine = useCallback(() => {
    // Stop performance monitoring
    if (performanceIntervalRef.current) {
      clearInterval(performanceIntervalRef.current);
      performanceIntervalRef.current = null;
    }

    if (globalEngine) {
      globalEngine.dispose();
      globalEngine = null;
      globalEngineInitPromise = null;
      // Use getState() to avoid dependency issues
      const { setInitialized, setAudioContext, setBackingTrackAnalyser, setMasterAnalyser } = useAudioStore.getState();
      setInitialized(false);
      // Clear analyser state from the store
      setAudioContext(null);
      setBackingTrackAnalyser(null);
      setMasterAnalyser(null);
    }
  }, []);

  // Get the master gain node for external connections (like track processors)
  const getMasterGain = useCallback((): GainNode | null => {
    return globalEngine?.getMasterGain() || null;
  }, []);

  // Native bridge audio methods
  const enableBridgeAudio = useCallback(async () => {
    if (!globalEngine) {
      await initialize();
    }
    await globalEngine?.enableBridgeAudio();
  }, [initialize]);

  const disableBridgeAudio = useCallback(() => {
    globalEngine?.disableBridgeAudio();
  }, []);

  const pushBridgeAudio = useCallback((samples: Float32Array) => {
    globalEngine?.pushBridgeAudio(samples);
  }, []);

  const isBridgeAudioEnabled = useCallback((): boolean => {
    return globalEngine?.isBridgeAudioEnabled() ?? false;
  }, []);

  // Change sample rate (recreates AudioContext)
  const changeSampleRate = useCallback(async (rate: 44100 | 48000) => {
    if (!globalEngine) {
      console.warn('[useAudioEngine] Cannot change sample rate: engine not initialized');
      return;
    }
    await globalEngine.changeSampleRate(rate);
  }, []);

  // Get current AudioContext sample rate
  const getAudioContextSampleRate = useCallback((): number | null => {
    return globalEngine?.getAudioContext()?.sampleRate ?? null;
  }, []);

  // ==========================================
  // Multi-Track Audio Processor Methods
  // ==========================================

  // Get or create a track audio processor
  const getOrCreateTrackProcessor = useCallback((
    trackId: string,
    settings?: TrackAudioSettings
  ) => {
    // Use globalEngine or fall back to window reference (for native bridge initialization)
    const engine = globalEngine || (typeof window !== 'undefined' && (window as any).__openStudioAudioEngine);
    return engine?.getOrCreateTrackProcessor(trackId, settings) ?? null;
  }, []);

  // Get an existing track processor
  const getTrackProcessor = useCallback((trackId: string) => {
    return globalEngine?.getTrackProcessor(trackId);
  }, []);

  // Remove a track processor
  const removeTrackProcessor = useCallback((trackId: string) => {
    // Use globalEngine or fall back to window reference (for native bridge initialization)
    const engine = globalEngine || (typeof window !== 'undefined' && (window as any).__openStudioAudioEngine);
    engine?.removeTrackProcessor(trackId);
  }, []);

  // Update track state (arm, mute, solo, volume, etc.)
  const updateTrackState = useCallback((
    trackId: string,
    state: Partial<import('@/lib/audio/track-audio-processor').TrackAudioState>
  ) => {
    // Use globalEngine or fall back to window reference (for native bridge initialization)
    const engine = globalEngine || (typeof window !== 'undefined' && (window as any).__openStudioAudioEngine);
    engine?.updateTrackState(trackId, state);
  }, []);

  // Update track effects
  const updateTrackEffects = useCallback((
    trackId: string,
    effects: Partial<import('@/types').ExtendedEffectsChain>
  ) => {
    // Use globalEngine or fall back to window reference (for native bridge initialization)
    const engine = globalEngine || (typeof window !== 'undefined' && (window as any).__openStudioAudioEngine);
    engine?.updateTrackEffects(trackId, effects);
  }, []);

  // Get track levels (input and output)
  const getTrackLevels = useCallback((trackId: string) => {
    return globalEngine?.getTrackLevels(trackId) ?? { input: 0, output: 0 };
  }, []);

  // Get track metrics (levels, effects metering, etc.)
  const getTrackMetrics = useCallback((trackId: string) => {
    return globalEngine?.getTrackMetrics(trackId);
  }, []);

  // Set up MediaStream input for a track (web audio mode)
  const setTrackMediaStreamInput = useCallback(async (
    trackId: string,
    stream: MediaStream,
    config: import('@/lib/audio/track-audio-processor').TrackInputConfig
  ) => {
    await globalEngine?.setTrackMediaStreamInput(trackId, stream, config);
  }, []);

  // Set up bridge input for a track (native bridge mode)
  const setTrackBridgeInput = useCallback(async (
    trackId: string,
    config: import('@/lib/audio/track-audio-processor').TrackInputConfig
  ) => {
    await globalEngine?.setTrackBridgeInput(trackId, config);
  }, []);

  // Push bridge audio to a specific track
  const pushTrackBridgeAudio = useCallback((trackId: string, samples: Float32Array) => {
    globalEngine?.pushTrackBridgeAudio(trackId, samples);
  }, []);

  // Enable multi-track bridge audio mode
  const enableMultiTrackBridgeAudio = useCallback(async (
    trackConfigs: Array<{
      trackId: string;
      config: import('@/lib/audio/track-audio-processor').TrackInputConfig;
      settings?: TrackAudioSettings;
    }>
  ) => {
    if (!globalEngine) {
      await initialize();
    }
    await globalEngine?.enableMultiTrackBridgeAudio(trackConfigs);
  }, [initialize]);

  // Disable multi-track bridge audio
  const disableMultiTrackBridgeAudio = useCallback(() => {
    globalEngine?.disableMultiTrackBridgeAudio();
  }, []);

  // Update broadcast connections (call after adding new tracks)
  const updateBroadcastConnections = useCallback(() => {
    globalEngine?.updateBroadcastConnections();
  }, []);

  return {
    isInitialized,
    isPlaying,
    initialize,
    startCapture,
    stopCapture,
    recaptureWithSettings,
    toggleMute,
    addRemoteStream,
    removeRemoteStream,
    setRemoteVolume,
    setRemoteMuted,
    setRemoteCompensationDelay,
    setMasterVolume,
    setBackingTrackVolume,
    setSongVolume,
    setOutputDevice,
    setMonitoringEnabled,
    setMonitoringVolume,
    setLocalTrackArmed,
    setLocalTrackMuted,
    setLocalTrackVolume,
    setLocalInputGainDb,
    updateLocalEffects,
    setLocalMonitoring,
    // Analyser nodes as state (triggers re-render when available)
    audioContext,
    backingTrackAnalyser,
    masterAnalyser,
    hasBackingTrackAudio,
    // External audio sources (Lyria AI music, etc.)
    addExternalAudioSource,
    removeExternalAudioSource,
    setExternalAudioVolume,
    hasExternalAudioSource,
    loadBackingTrack,
    playBackingTrack,
    pauseBackingTrack,
    seekTo,
    toggleStem,
    setStemVolume,
    // Multi-track playback
    loadMultiTrack,
    isMultiTrackLoaded,
    playMultiTracks,
    setMultiTrackVolume,
    stopMultiTracks,
    clearMultiTracks,
    resume,
    updateFromStats,
    setOnTrackEnded,
    destroyEngine,
    getMasterGain,
    // Native bridge audio
    enableBridgeAudio,
    disableBridgeAudio,
    pushBridgeAudio,
    isBridgeAudioEnabled,
    // Sample rate control
    changeSampleRate,
    getAudioContextSampleRate,
    // Multi-track audio processors
    getOrCreateTrackProcessor,
    getTrackProcessor,
    removeTrackProcessor,
    updateTrackState,
    updateTrackEffects,
    getTrackLevels,
    getTrackMetrics,
    setTrackMediaStreamInput,
    setTrackBridgeInput,
    pushTrackBridgeAudio,
    enableMultiTrackBridgeAudio,
    disableMultiTrackBridgeAudio,
    updateBroadcastConnections,
  };
}
