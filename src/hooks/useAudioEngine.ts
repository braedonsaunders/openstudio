'use client';

import { useCallback, useEffect, useRef } from 'react';
import { AudioEngine, type CaptureAudioOptions } from '@/lib/audio/audio-engine';
import { useAudioStore } from '@/stores/audio-store';
import { useRoomStore } from '@/stores/room-store';
import type { BackingTrack, TrackAudioSettings } from '@/types';

// Singleton audio engine instance - shared across all components
// This prevents issues when multiple components call useAudioEngine()
// and ensures the engine persists across component remounts
let globalEngine: AudioEngine | null = null;
let globalEngineInitPromise: Promise<AudioEngine> | null = null;

export function useAudioEngine() {
  const animationFrameRef = useRef<number | null>(null);
  const performanceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get analyser nodes from the global store (shared across all hook instances)
  const {
    settings,
    isInitialized,
    isPlaying,
    audioContext,
    backingTrackAnalyser,
    masterAnalyser,
    setInitialized,
    setCapturing,
    setMuted,
    setLocalLevel,
    setJitterStats,
    setConnectionQuality,
    setCurrentBufferSize,
    setPerformanceMetrics,
    setPlaying,
    setCurrentTime,
    setDuration,
    setAudioContext,
    setBackingTrackAnalyser,
    setMasterAnalyser,
    setInputDevices,
    setOutputDevices,
  } = useAudioStore();

  const {
    currentTrack,
    stemMixState,
    stemsAvailable,
    setAudioLevels,
    setWaveformData,
  } = useRoomStore();

  // Initialize audio engine (singleton pattern)
  const initialize = useCallback(async () => {
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

      // Set up level monitoring
      engine.setOnLevelUpdate((levels) => {
        setAudioLevels(levels);
        const localLevel = levels.get('local') || 0;
        setLocalLevel(localLevel);
      });

      globalEngine = engine;
      setInitialized(true);

      // Start performance monitoring
      // Note: We get fresh state inside the interval to avoid stale closures
      if (!performanceIntervalRef.current) {
        performanceIntervalRef.current = setInterval(() => {
          if (globalEngine) {
            // Get actual config from engine (which stays in sync with store settings)
            const engineConfig = globalEngine.getConfig();

            const audioContextLatency = globalEngine.getContextLatency();
            const bufferLatency = globalEngine.getBufferLatency();

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

            setPerformanceMetrics({
              audioContextLatency,
              effectsProcessingTime,
              totalLatency: audioContextLatency + bufferLatency,
              currentBufferSize: engineConfig.bufferSize,
            });
          }
        }, 200); // Update every 200ms
      }

      // Get available devices
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setInputDevices(devices.filter((d) => d.kind === 'audioinput'));
        setOutputDevices(devices.filter((d) => d.kind === 'audiooutput'));
      } catch (err) {
        console.warn('Failed to enumerate devices:', err);
      }

      return engine;
    })();

    try {
      const engine = await globalEngineInitPromise;

      // Store analyser nodes in state so they trigger re-renders
      setAudioContext(engine.getAudioContext());
      setBackingTrackAnalyser(engine.getBackingTrackAnalyser());
      setMasterAnalyser(engine.getMasterAnalyser());

      console.log('Audio engine analysers ready:', {
        backingTrackAnalyser: !!engine.getBackingTrackAnalyser(),
        masterAnalyser: !!engine.getMasterAnalyser(),
      });

      return engine;
    } finally {
      globalEngineInitPromise = null;
    }
  }, [settings, setInitialized, setAudioLevels, setLocalLevel, setInputDevices, setOutputDevices, setAudioContext, setBackingTrackAnalyser, setMasterAnalyser]);

  // Capture local audio
  const startCapture = useCallback(async (trackSettings?: TrackAudioSettings) => {
    if (!globalEngine) {
      await initialize();
    }

    // Build capture options from track settings
    const captureOptions: CaptureAudioOptions = trackSettings ? {
      deviceId: trackSettings.inputDeviceId,
      channelConfig: trackSettings.channelConfig,
      sampleRate: trackSettings.sampleRate,
      echoCancellation: trackSettings.echoCancellation,
      noiseSuppression: trackSettings.noiseSuppression,
      autoGainControl: trackSettings.autoGainControl,
    } : {};

    const stream = await globalEngine!.captureLocalAudio(captureOptions);
    setCapturing(true);
    return stream;
  }, [initialize, setCapturing]);

  // Stop capture
  const stopCapture = useCallback(() => {
    setCapturing(false);
    setMuted(true);
  }, [setCapturing, setMuted]);

  // Recapture audio with new settings (e.g., when user changes device or channel config)
  const recaptureWithSettings = useCallback(async (trackSettings: TrackAudioSettings) => {
    if (!globalEngine) {
      console.warn('[useAudioEngine] Cannot recapture: engine not initialized');
      return null;
    }

    console.log('[useAudioEngine] Recapturing audio with new settings:', {
      deviceId: trackSettings.inputDeviceId,
      channelConfig: trackSettings.channelConfig,
    });

    const captureOptions: CaptureAudioOptions = {
      deviceId: trackSettings.inputDeviceId,
      channelConfig: trackSettings.channelConfig,
      sampleRate: trackSettings.sampleRate,
      echoCancellation: trackSettings.echoCancellation,
      noiseSuppression: trackSettings.noiseSuppression,
      autoGainControl: trackSettings.autoGainControl,
    };

    const stream = await globalEngine.captureLocalAudio(captureOptions);
    return stream;
  }, []);

  // Mute/unmute local audio
  const toggleMute = useCallback((muted: boolean) => {
    setMuted(muted);
  }, [setMuted]);

  // Add remote stream
  const addRemoteStream = useCallback((userId: string, stream: MediaStream) => {
    globalEngine?.addRemoteStream(userId, stream);
  }, []);

  // Remove remote stream
  const removeRemoteStream = useCallback((userId: string) => {
    globalEngine?.removeRemoteStream(userId);
  }, []);

  // Set remote user volume
  const setRemoteVolume = useCallback((userId: string, volume: number) => {
    globalEngine?.setRemoteVolume(userId, volume);
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

  // Set local track muted state (for mute/solo)
  const setLocalTrackMuted = useCallback((muted: boolean) => {
    globalEngine?.setLocalTrackMuted(muted);
  }, []);

  // Set local track volume
  const setLocalTrackVolume = useCallback((volume: number) => {
    globalEngine?.setLocalTrackVolume(volume);
  }, []);

  // Update local track effects
  const updateLocalTrackEffects = useCallback((effects: Partial<import('@/types').TrackEffectsChain>) => {
    globalEngine?.updateLocalTrackEffects(effects);
  }, []);

  // Check if backing track audio is available for analysis
  const hasBackingTrackAudio = useCallback((): boolean => {
    return globalEngine?.hasBackingTrackAudio() || false;
  }, []);

  // Load and play backing track
  // Returns true if loading was successful, false otherwise
  const loadBackingTrack = useCallback(async (track: BackingTrack): Promise<boolean> => {
    if (!globalEngine) {
      console.error('Audio engine not initialized');
      return false;
    }

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
  }, [setDuration, setWaveformData]);

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
    setPlaying(true);

    // Start time update loop
    const updateTime = () => {
      if (globalEngine?.isCurrentlyPlaying()) {
        setCurrentTime(globalEngine.getCurrentTime());
        animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    };
    updateTime();
  }, [stemsAvailable, setPlaying, setCurrentTime]);

  // Pause backing track
  const pauseBackingTrack = useCallback(() => {
    if (!globalEngine) return;

    if (stemsAvailable) {
      globalEngine.stopStemmedTrack();
    } else {
      globalEngine.stopBackingTrack();
    }
    setPlaying(false);

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, [stemsAvailable, setPlaying]);

  // Seek to position
  const seekTo = useCallback((time: number, syncTimestamp: number) => {
    pauseBackingTrack();
    playBackingTrack(syncTimestamp, time);
    setCurrentTime(time);
  }, [pauseBackingTrack, playBackingTrack, setCurrentTime]);

  // Toggle stem
  const toggleStem = useCallback((stem: string, enabled: boolean) => {
    globalEngine?.setStemEnabled(stem, enabled);
  }, []);

  // Set stem volume
  const setStemVolume = useCallback((stem: string, volume: number) => {
    globalEngine?.setStemVolume(stem, volume);
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
      setPlaying(false);
      callback();
    });
  }, [setPlaying]);

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
    setCurrentBufferSize(newBufferSize);
    setJitterStats(globalEngine.getJitterStats());
    setConnectionQuality(globalEngine.getConnectionQuality());
  }, [setCurrentBufferSize, setJitterStats, setConnectionQuality]);

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
      setInitialized(false);
      // Clear analyser state from the store
      setAudioContext(null);
      setBackingTrackAnalyser(null);
      setMasterAnalyser(null);
    }
  }, [setInitialized, setAudioContext, setBackingTrackAnalyser, setMasterAnalyser]);

  // Get the master gain node for external connections (like track processors)
  const getMasterGain = useCallback((): GainNode | null => {
    return globalEngine?.getMasterGain() || null;
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
    setMasterVolume,
    setBackingTrackVolume,
    setOutputDevice,
    setMonitoringEnabled,
    setMonitoringVolume,
    setLocalTrackMuted,
    setLocalTrackVolume,
    updateLocalTrackEffects,
    // Analyser nodes as state (triggers re-render when available)
    audioContext,
    backingTrackAnalyser,
    masterAnalyser,
    hasBackingTrackAudio,
    loadBackingTrack,
    playBackingTrack,
    pauseBackingTrack,
    seekTo,
    toggleStem,
    setStemVolume,
    resume,
    updateFromStats,
    setOnTrackEnded,
    destroyEngine,
    getMasterGain,
  };
}
