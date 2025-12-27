'use client';

import { useCallback, useEffect, useRef } from 'react';
import { AudioEngine } from '@/lib/audio/audio-engine';
import { useAudioStore } from '@/stores/audio-store';
import { useRoomStore } from '@/stores/room-store';
import type { BackingTrack } from '@/types';

export function useAudioEngine() {
  const engineRef = useRef<AudioEngine | null>(null);
  const animationFrameRef = useRef<number | null>(null);

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

  // Initialize audio engine
  const initialize = useCallback(async () => {
    if (engineRef.current) return;

    const engine = new AudioEngine({
      sampleRate: settings.sampleRate,
      bufferSize: settings.bufferSize,
      autoJitterBuffer: settings.autoJitterBuffer,
      enableProcessing: true,
    });

    await engine.initialize();

    // Set up level monitoring
    engine.setOnLevelUpdate((levels) => {
      setAudioLevels(levels);
      const localLevel = levels.get('local') || 0;
      setLocalLevel(localLevel);
    });

    engineRef.current = engine;
    setInitialized(true);

    // Get available devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    setInputDevices(devices.filter((d) => d.kind === 'audioinput'));
    setOutputDevices(devices.filter((d) => d.kind === 'audiooutput'));

    return engine;
  }, [settings, setInitialized, setAudioLevels, setLocalLevel, setInputDevices, setOutputDevices]);

  // Capture local audio
  const startCapture = useCallback(async () => {
    if (!engineRef.current) {
      await initialize();
    }

    const stream = await engineRef.current!.captureLocalAudio();
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
    engineRef.current?.addRemoteStream(userId, stream);
  }, []);

  // Remove remote stream
  const removeRemoteStream = useCallback((userId: string) => {
    engineRef.current?.removeRemoteStream(userId);
  }, []);

  // Set remote user volume
  const setRemoteVolume = useCallback((userId: string, volume: number) => {
    engineRef.current?.setRemoteVolume(userId, volume);
  }, []);

  // Set master volume
  const setMasterVolume = useCallback((volume: number) => {
    engineRef.current?.setMasterVolume(volume);
    useAudioStore.getState().setMasterVolume(volume);
  }, []);

  // Set backing track volume
  const setBackingTrackVolume = useCallback((volume: number) => {
    engineRef.current?.setBackingTrackVolume(volume);
    useAudioStore.getState().setBackingTrackVolume(volume);
  }, []);

  // Get audio context for external use (e.g., analysis)
  const getAudioContext = useCallback((): AudioContext | null => {
    return engineRef.current?.getAudioContext() || null;
  }, []);

  // Load and play backing track
  // Returns true if loading was successful, false otherwise
  const loadBackingTrack = useCallback(async (track: BackingTrack): Promise<boolean> => {
    if (!engineRef.current) {
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
      await engineRef.current.loadBackingTrack(track.url);
      // Use actual buffer duration if available, otherwise use track.duration
      const actualDuration = engineRef.current.getDuration() || track.duration;
      setDuration(actualDuration);

      // Extract real waveform data from the audio buffer
      const waveform = engineRef.current.extractWaveformData(300);
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
        stemPromises.push(engineRef.current.loadStem('vocals', track.stems.vocals));
      }
      if (track.stems.drums) {
        stemPromises.push(engineRef.current.loadStem('drums', track.stems.drums));
      }
      if (track.stems.bass) {
        stemPromises.push(engineRef.current.loadStem('bass', track.stems.bass));
      }
      if (track.stems.other) {
        stemPromises.push(engineRef.current.loadStem('other', track.stems.other));
      }
      await Promise.all(stemPromises);
    }

    return true; // Loading succeeded
  }, [setDuration, setWaveformData]);

  // Play backing track with sync
  const playBackingTrack = useCallback((syncTimestamp: number, offset: number = 0) => {
    if (!engineRef.current) {
      console.error('Audio engine not ready for playback');
      return;
    }

    // Check if buffer is loaded
    if (!engineRef.current.getDuration()) {
      console.error('No audio buffer loaded');
      return;
    }

    if (stemsAvailable) {
      engineRef.current.playStemmedTrack(syncTimestamp, offset);
    } else {
      engineRef.current.playBackingTrack(syncTimestamp, offset);
    }
    setPlaying(true);

    // Start time update loop
    const updateTime = () => {
      if (engineRef.current?.isCurrentlyPlaying()) {
        setCurrentTime(engineRef.current.getCurrentTime());
        animationFrameRef.current = requestAnimationFrame(updateTime);
      }
    };
    updateTime();
  }, [stemsAvailable, setPlaying, setCurrentTime]);

  // Pause backing track
  const pauseBackingTrack = useCallback(() => {
    if (!engineRef.current) return;

    if (stemsAvailable) {
      engineRef.current.stopStemmedTrack();
    } else {
      engineRef.current.stopBackingTrack();
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
    engineRef.current?.setStemEnabled(stem, enabled);
  }, []);

  // Set stem volume
  const setStemVolume = useCallback((stem: string, volume: number) => {
    engineRef.current?.setStemVolume(stem, volume);
  }, []);

  // Resume audio context (required after user interaction)
  const resume = useCallback(async () => {
    await engineRef.current?.resume();
  }, []);

  // Update jitter buffer from stats
  const updateFromStats = useCallback((stats: { jitter: number; packetLoss: number; roundTripTime: number }) => {
    if (!engineRef.current) return;

    const jitterStats = {
      averageJitter: stats.jitter,
      maxJitter: stats.jitter * 1.5,
      packetLoss: stats.packetLoss,
      roundTripTime: stats.roundTripTime,
      recommendedBuffer: 256,
    };

    const newBufferSize = engineRef.current.updateJitterBuffer(jitterStats);
    setCurrentBufferSize(newBufferSize);
    setJitterStats(engineRef.current.getJitterStats());
    setConnectionQuality(engineRef.current.getConnectionQuality());
  }, [setCurrentBufferSize, setJitterStats, setConnectionQuality]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  // Apply stem mix state changes
  useEffect(() => {
    if (!engineRef.current || !stemsAvailable) return;

    Object.entries(stemMixState).forEach(([stem, state]) => {
      engineRef.current?.setStemEnabled(stem, state.enabled);
      engineRef.current?.setStemVolume(stem, state.volume);
    });
  }, [stemMixState, stemsAvailable]);

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
    getAudioContext,
    loadBackingTrack,
    playBackingTrack,
    pauseBackingTrack,
    seekTo,
    toggleStem,
    setStemVolume,
    resume,
    updateFromStats,
  };
}
