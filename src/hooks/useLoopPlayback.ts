'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useLoopTracksStore } from '@/stores/loop-tracks-store';
import { useAudioStore } from '@/stores/audio-store';
import { useSongsStore } from '@/stores/songs-store';
import { useSessionTempoStore } from '@/stores/session-tempo-store';
import { LoopScheduler } from '@/lib/audio/loop-scheduler';
import { SoundEngine } from '@/lib/audio/sound-engine';
import { getLoopById } from '@/lib/audio/loop-library';
import type { LoopTrackState } from '@/types/loops';
import type { SongTrackReference } from '@/types/songs';

/**
 * Hook that manages loop playback by connecting the LoopScheduler and SoundEngine
 * to the song state. This is a BULLETPROOF implementation that:
 * - Automatically starts new loops when added during playback
 * - Stops loops when removed
 * - Reacts to mute/solo/volume changes in real-time
 * - Handles timeline position changes (startOffset)
 */
export function useLoopPlayback() {
  const schedulerRef = useRef<LoopScheduler | null>(null);
  const soundEngineRef = useRef<SoundEngine | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isInitializedRef = useRef(false);

  // Track which loop track IDs are currently scheduled/playing
  const scheduledLoopsRef = useRef<Set<string>>(new Set());

  // Track the last known song tracks to detect changes
  const lastSongTracksRef = useRef<Map<string, SongTrackReference>>(new Map());

  // Playback sync time reference
  const playbackSyncTimeRef = useRef<number>(0);

  // Initialize audio system
  const initialize = useCallback(async () => {
    if (isInitializedRef.current) return true;

    try {
      // Create audio context
      const context = new AudioContext({ latencyHint: 'interactive' });
      audioContextRef.current = context;

      // Create sound engine
      const soundEngine = new SoundEngine(context);
      await soundEngine.initialize();
      soundEngineRef.current = soundEngine;

      // Create loop scheduler
      const scheduler = new LoopScheduler(context, soundEngine);
      schedulerRef.current = scheduler;

      // Set master tempo from session tempo store (single source of truth)
      const tempo = useSessionTempoStore.getState().tempo;
      scheduler.setMasterTempo(tempo);

      isInitializedRef.current = true;
      return true;
    } catch (err) {
      console.error('[useLoopPlayback] Failed to initialize:', err);
      return false;
    }
  }, []);

  // Start playing a specific loop
  const startLoopInternal = useCallback(async (
    loopTrack: LoopTrackState,
    songTrackRef: SongTrackReference,
    syncTime: number
  ) => {
    const scheduler = schedulerRef.current;
    const audioContext = audioContextRef.current;

    if (!scheduler) {
      console.error('[useLoopPlayback] Scheduler not initialized');
      return false;
    }

    // Get loop definition - check custom loops first
    let loopDef = getLoopById(loopTrack.loopId);

    // If not found in main library, check custom loops store
    if (!loopDef) {
      const { useCustomLoopsStore } = await import('@/stores/custom-loops-store');
      const customLoop = useCustomLoopsStore.getState().getLoop(loopTrack.loopId);
      if (customLoop) {
        // CustomLoopDefinition extends LoopDefinition, so we can use it directly
        loopDef = customLoop;
      }
    }

    if (!loopDef) {
      console.error('[useLoopPlayback] Loop definition not found:', loopTrack.loopId);
      return false;
    }

    // Resume audio context if suspended
    if (audioContext?.state === 'suspended') {
      await audioContext.resume();
    }

    // Check if should be muted (respecting solo across all tracks)
    const shouldMute = songTrackRef.muted ?? false;

    // Create a modified track state with song-level overrides
    const trackWithOverrides: LoopTrackState = {
      ...loopTrack,
      muted: shouldMute,
      volume: songTrackRef.volume ?? loopTrack.volume,
    };

    scheduler.startLoop(loopTrack.id, loopDef, trackWithOverrides, syncTime);
    scheduledLoopsRef.current.add(loopTrack.id);

    console.log('[useLoopPlayback] Started loop:', loopTrack.name || loopDef.name);
    return true;
  }, []);

  // Stop a specific loop
  const stopLoopInternal = useCallback((trackId: string) => {
    const scheduler = schedulerRef.current;
    if (!scheduler) return;

    scheduler.stopLoop(trackId);
    scheduledLoopsRef.current.delete(trackId);

    console.log('[useLoopPlayback] Stopped loop:', trackId);
  }, []);

  // Stop all loops immediately
  const stopAll = useCallback(() => {
    const scheduler = schedulerRef.current;
    if (!scheduler) return;

    scheduler.stopAll();
    scheduledLoopsRef.current.clear();
    lastSongTracksRef.current.clear();

    console.log('[useLoopPlayback] Stopped all loops');
  }, []);

  // Helper to calculate loop duration in seconds
  const getLoopDuration = useCallback((loopId: string): number => {
    let loopDef = getLoopById(loopId);
    if (!loopDef) {
      // Check custom loops store synchronously (already imported at module level)
      const { useCustomLoopsStore } = require('@/stores/custom-loops-store');
      loopDef = useCustomLoopsStore.getState().getLoop(loopId);
    }
    if (!loopDef) return 0;

    const beatsPerBar = loopDef.timeSignature[0];
    const totalBeats = loopDef.bars * beatsPerBar;
    return (totalBeats / loopDef.bpm) * 60;
  }, []);

  // Sync playback state with song tracks
  const syncPlaybackWithSong = useCallback(async () => {
    const { isPlaying, currentTime } = useAudioStore.getState();
    const song = useSongsStore.getState().getCurrentSong();
    const loopTracksStore = useLoopTracksStore.getState();

    if (!isPlaying || !song) {
      // Not playing - stop everything
      if (scheduledLoopsRef.current.size > 0) {
        stopAll();
      }
      return;
    }

    // Ensure initialized
    if (!isInitializedRef.current) {
      const success = await initialize();
      if (!success) return;
    }

    // Get current loop tracks from song
    const currentLoopTracks = song.tracks.filter(t => t.type === 'loop');
    const currentLoopTrackIds = new Set(currentLoopTracks.map(t => t.trackId));

    // Check for any solo'd tracks
    const hasSoloTrack = currentLoopTracks.some(t => t.solo);

    // Stop loops that are no longer in the song
    for (const scheduledId of scheduledLoopsRef.current) {
      if (!currentLoopTrackIds.has(scheduledId)) {
        stopLoopInternal(scheduledId);
      }
    }

    // Calculate sync time for new loops
    const syncTime = playbackSyncTimeRef.current || Date.now();

    // Start or update loops that should be playing
    for (const songTrack of currentLoopTracks) {
      const loopTrack = loopTracksStore.getTrack(songTrack.trackId);
      if (!loopTrack) continue;

      // Calculate if the loop is within the current playback time range
      const startOffset = songTrack.startOffset ?? 0;
      const loopDuration = getLoopDuration(loopTrack.loopId);
      const endTime = startOffset + loopDuration;

      // Check if current time is within this loop's range
      const isInTimeRange = currentTime >= startOffset && currentTime < endTime;

      // Check if this loop should be audible
      const isMuted = (songTrack.muted ?? false) || (hasSoloTrack && !songTrack.solo);

      const isScheduled = scheduledLoopsRef.current.has(loopTrack.id);
      const lastSongTrack = lastSongTracksRef.current.get(songTrack.id);

      if (!isScheduled && isInTimeRange) {
        // New loop within time range - start it
        await startLoopInternal(loopTrack, { ...songTrack, muted: isMuted }, syncTime);
      } else if (isScheduled && !isInTimeRange) {
        // Loop is scheduled but outside time range - stop it
        stopLoopInternal(loopTrack.id);
      } else if (isScheduled && isInTimeRange) {
        // Already scheduled and in range - check if mute/solo/volume changed
        const lastMuted = lastSongTrack?.muted ?? false;
        const lastSolo = lastSongTrack?.solo ?? false;
        const lastVolume = lastSongTrack?.volume ?? 1;

        const currentMuted = songTrack.muted ?? false;
        const currentSolo = songTrack.solo ?? false;
        const currentVolume = songTrack.volume ?? 1;

        const muteChanged = (lastMuted !== currentMuted) || (lastSolo !== currentSolo) || (hasSoloTrack !== (lastSongTracksRef.current.size > 0 && Array.from(lastSongTracksRef.current.values()).some(t => t.solo)));
        const volumeChanged = lastVolume !== currentVolume;

        if (muteChanged || volumeChanged || !lastSongTrack) {
          // Update the loop's parameters
          const scheduler = schedulerRef.current;
          if (scheduler) {
            scheduler.updateLoopTrack(loopTrack.id, {
              muted: isMuted,
              volume: currentVolume,
            });
          }
        }
      }

      // Update last known state
      lastSongTracksRef.current.set(songTrack.id, { ...songTrack });
    }

    // Clean up removed tracks from lastSongTracks
    for (const [refId] of lastSongTracksRef.current) {
      if (!currentLoopTracks.some(t => t.id === refId)) {
        lastSongTracksRef.current.delete(refId);
      }
    }
  }, [initialize, startLoopInternal, stopLoopInternal, stopAll, getLoopDuration]);

  // External API to start a loop
  const startLoop = useCallback(async (track: LoopTrackState, syncTime?: number, startOffset?: number) => {
    if (!isInitializedRef.current) {
      await initialize();
    }

    playbackSyncTimeRef.current = syncTime || Date.now();

    // Mark the track as playing in the store
    useLoopTracksStore.getState().setTrackPlaying(track.id, true, syncTime);
  }, [initialize]);

  // External API to stop a loop
  const stopLoop = useCallback((trackId: string) => {
    // Mark the track as not playing in the store
    useLoopTracksStore.getState().setTrackPlaying(trackId, false);
    stopLoopInternal(trackId);
  }, [stopLoopInternal]);

  // Subscribe to playback state changes
  // Note: useAudioStore doesn't use subscribeWithSelector, so we use standard subscribe
  useEffect(() => {
    let prevIsPlaying = useAudioStore.getState().isPlaying;
    let syncInterval: NodeJS.Timeout | null = null;

    const unsubAudio = useAudioStore.subscribe((state) => {
      if (state.isPlaying !== prevIsPlaying) {
        prevIsPlaying = state.isPlaying;
        if (!state.isPlaying) {
          stopAll();
          if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
          }
        } else {
          playbackSyncTimeRef.current = Date.now();
          syncPlaybackWithSong();
          // Start periodic sync to handle playhead movement past loop boundaries
          syncInterval = setInterval(() => {
            syncPlaybackWithSong();
          }, 100); // Check every 100ms
        }
      }
    });

    return () => {
      unsubAudio();
      if (syncInterval) {
        clearInterval(syncInterval);
      }
    };
  }, [stopAll, syncPlaybackWithSong]);

  // Subscribe to song tracks changes - this is the BULLETPROOF part
  useEffect(() => {
    let prevSongsSize = useSongsStore.getState().songs.size;
    let prevCurrentSongTracks: string | null = null;

    const unsubSongs = useSongsStore.subscribe((state) => {
      const currentSong = state.getCurrentSong();
      const currentTracksKey = currentSong ? JSON.stringify(currentSong.tracks) : null;

      // Check if songs changed or current song tracks changed
      if (state.songs.size !== prevSongsSize || currentTracksKey !== prevCurrentSongTracks) {
        prevSongsSize = state.songs.size;
        prevCurrentSongTracks = currentTracksKey;

        // Song tracks changed - sync playback
        const { isPlaying } = useAudioStore.getState();
        if (isPlaying) {
          syncPlaybackWithSong();
        }
      }
    });

    return () => unsubSongs();
  }, [syncPlaybackWithSong]);

  // Also subscribe to loop tracks store for track-level changes (volume, effects, etc.)
  useEffect(() => {
    let prevTracksSize = useLoopTracksStore.getState().tracks.size;

    const unsubLoopTracks = useLoopTracksStore.subscribe((state) => {
      const { isPlaying } = useAudioStore.getState();
      if (!isPlaying) return;

      // Update any playing loops with new track state
      const scheduler = schedulerRef.current;
      if (!scheduler) return;

      for (const [trackId, track] of state.tracks) {
        if (scheduledLoopsRef.current.has(trackId)) {
          // Update the loop's parameters
          scheduler.updateLoopTrack(trackId, {
            volume: track.volume,
            muted: track.muted,
            soundPreset: track.soundPreset,
            tempoLocked: track.tempoLocked,
            keyLocked: track.keyLocked,
            transposeAmount: track.transposeAmount,
            humanizeEnabled: track.humanizeEnabled,
            humanizeTiming: track.humanizeTiming,
            humanizeVelocity: track.humanizeVelocity,
          });
        }
      }

      prevTracksSize = state.tracks.size;
    });

    return () => unsubLoopTracks();
  }, []);

  // Sync master tempo with session tempo store (the single source of truth)
  useEffect(() => {
    let prevTempo = useSessionTempoStore.getState().tempo;

    const unsubTempo = useSessionTempoStore.subscribe(
      (state) => state.tempo,
      (tempo) => {
        if (tempo !== prevTempo) {
          prevTempo = tempo;
          if (schedulerRef.current) {
            schedulerRef.current.setMasterTempo(tempo);
          }
        }
      },
      { fireImmediately: true }
    );

    return () => unsubTempo();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAll();
      soundEngineRef.current?.dispose();
      schedulerRef.current?.dispose();
      audioContextRef.current?.close();
      isInitializedRef.current = false;
    };
  }, [stopAll]);

  return {
    initialize,
    startLoop,
    stopLoop,
    stopAll,
    syncPlaybackWithSong,
    isInitialized: isInitializedRef.current,
  };
}
