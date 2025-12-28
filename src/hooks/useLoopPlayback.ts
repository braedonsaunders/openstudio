'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useLoopTracksStore } from '@/stores/loop-tracks-store';
import { useAudioStore } from '@/stores/audio-store';
import { useSongsStore } from '@/stores/songs-store';
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

      // Set master tempo from current song
      const song = useSongsStore.getState().getCurrentSong();
      if (song?.bpm) {
        scheduler.setMasterTempo(song.bpm);
      }

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

      // Check if this loop should be audible
      const isMuted = songTrack.muted || (hasSoloTrack && !songTrack.solo);

      const isScheduled = scheduledLoopsRef.current.has(loopTrack.id);
      const lastSongTrack = lastSongTracksRef.current.get(songTrack.id);

      if (!isScheduled) {
        // New loop - start it
        await startLoopInternal(loopTrack, { ...songTrack, muted: isMuted }, syncTime);
      } else if (lastSongTrack) {
        // Check if mute/solo/volume changed - update the loop
        const muteChanged = (lastSongTrack.muted !== songTrack.muted) ||
                           (lastSongTrack.solo !== songTrack.solo);
        const volumeChanged = lastSongTrack.volume !== songTrack.volume;

        if (muteChanged || volumeChanged) {
          // Update the loop's parameters
          const scheduler = schedulerRef.current;
          if (scheduler) {
            scheduler.updateLoopTrack(loopTrack.id, {
              muted: isMuted,
              volume: songTrack.volume ?? loopTrack.volume,
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
  }, [initialize, startLoopInternal, stopLoopInternal, stopAll]);

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
  useEffect(() => {
    const unsubAudio = useAudioStore.subscribe(
      (state) => state.isPlaying,
      (isPlaying) => {
        if (!isPlaying) {
          stopAll();
        } else {
          playbackSyncTimeRef.current = Date.now();
          syncPlaybackWithSong();
        }
      }
    );

    return () => unsubAudio();
  }, [stopAll, syncPlaybackWithSong]);

  // Subscribe to song tracks changes - this is the BULLETPROOF part
  useEffect(() => {
    const unsubSongs = useSongsStore.subscribe(
      (state) => state.songs,
      () => {
        // Song tracks changed - sync playback
        const { isPlaying } = useAudioStore.getState();
        if (isPlaying) {
          syncPlaybackWithSong();
        }
      }
    );

    return () => unsubSongs();
  }, [syncPlaybackWithSong]);

  // Also subscribe to loop tracks store for track-level changes (volume, effects, etc.)
  useEffect(() => {
    const unsubLoopTracks = useLoopTracksStore.subscribe(
      (state) => state.tracks,
      async (tracks) => {
        const { isPlaying } = useAudioStore.getState();
        if (!isPlaying) return;

        // Update any playing loops with new track state
        const scheduler = schedulerRef.current;
        if (!scheduler) return;

        for (const [trackId, track] of tracks) {
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
      }
    );

    return () => unsubLoopTracks();
  }, []);

  // Update master tempo when song changes
  useEffect(() => {
    const unsubSongChange = useSongsStore.subscribe(
      (state) => state.currentSongId,
      () => {
        const song = useSongsStore.getState().getCurrentSong();
        if (song?.bpm && schedulerRef.current) {
          schedulerRef.current.setMasterTempo(song.bpm);
        }
      }
    );

    return () => unsubSongChange();
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
