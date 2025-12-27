'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioEngine } from '@/lib/audio/audio-engine';
import { useAudioStore } from '@/stores/audio-store';
import { useRoomStore } from '@/stores/room-store';
import type { BackingTrack } from '@/types';

// Singleton audio engine instance - shared across all components
// This prevents issues when multiple components call useAudioEngine()
// and ensures the engine persists across component remounts
let globalEngine: AudioEngine | null = null;
let globalEngineInitPromise: Promise<AudioEngine> | null = null;

export function useAudioEngine() {
  const animationFrameRef = useRef<number | null>(null);

  // State for analyser nodes (triggers re-render when engine initializes)
  const [backingTrackAnalyser, setBackingTrackAnalyser] = useState<AnalyserNode | null>(null);
  const [masterAnalyser, setMasterAnalyser] = useState<AnalyserNode | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

  const {
    settings,
    isInitialized,
    isPlaying,
    setInitialized,
    setCapturing,
    setMuted,
    setLocalLevel,
    setJitterStats,
    setConnectionQuality,
    setCurrentBufferSize,
    setPlaying,
    setCurrentTime,
    setDuration,
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
  }, [settings, setInitialized, setAudioLevels, setLocalLevel, setInputDevices, setOutputDevices]);

  // Capture local audio
  const startCapture = useCallback(async () => {
    if (!globalEngine) {
      await initialize();
    }

    const stream = await globalEngine!.captureLocalAudio();
    setCapturing(true);
    return stream;
  }, [initialize, setCapturing]);

  // Stop capture
  const stopCapture = useCallback(() => {
    setCapturing(false);
    setMuted(true);
  }, [setCapturing, setMuted]);

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

  // Destroy the global engine (call when leaving room)
  const destroyEngine = useCallback(() => {
    if (globalEngine) {
      globalEngine.dispose();
      globalEngine = null;
      globalEngineInitPromise = null;
      setInitialized(false);
      // Clear analyser state
      setAudioContext(null);
      setBackingTrackAnalyser(null);
      setMasterAnalyser(null);
    }
  }, [setInitialized]);

  return {
    isInitialized,
    isPlaying,
    initialize,
    startCapture,
    stopCapture,
    toggleMute,
    addRemoteStream,
    removeRemoteStream,
    setRemoteVolume,
    setMasterVolume,
    setBackingTrackVolume,
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
    destroyEngine,
  };
}
