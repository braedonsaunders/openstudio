'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useLoopTracksStore } from '@/stores/loop-tracks-store';
import { useAudioStore } from '@/stores/audio-store';
import { useSongsStore } from '@/stores/songs-store';
import { LoopScheduler } from '@/lib/audio/loop-scheduler';
import { SoundEngine } from '@/lib/audio/sound-engine';
import { getLoopById } from '@/lib/audio/loop-library';
import type { LoopTrackState } from '@/types/loops';

/**
 * Hook that manages loop playback by connecting the LoopScheduler and SoundEngine
 * to the loop tracks store state.
 */
export function useLoopPlayback() {
  const schedulerRef = useRef<LoopScheduler | null>(null);
  const soundEngineRef = useRef<SoundEngine | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isInitializedRef = useRef(false);
  const playingTracksRef = useRef<Set<string>>(new Set());

  const { isPlaying } = useAudioStore();
  const { getCurrentSong } = useSongsStore();
  const { getTrack, getAllTracks } = useLoopTracksStore();

  // Initialize audio system
  const initialize = useCallback(async () => {
    if (isInitializedRef.current) return;

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
      const song = getCurrentSong();
      if (song?.bpm) {
        scheduler.setMasterTempo(song.bpm);
      }

      isInitializedRef.current = true;
      console.log('[useLoopPlayback] Initialized audio system');
    } catch (err) {
      console.error('[useLoopPlayback] Failed to initialize:', err);
    }
  }, [getCurrentSong]);

  // Start playing a loop track
  const startLoop = useCallback(async (track: LoopTrackState) => {
    console.log('[useLoopPlayback] startLoop called:', track.name, 'initialized:', isInitializedRef.current);

    if (!isInitializedRef.current) {
      console.log('[useLoopPlayback] Initializing audio system...');
      await initialize();
    }

    const scheduler = schedulerRef.current;
    const soundEngine = soundEngineRef.current;
    const audioContext = audioContextRef.current;

    console.log('[useLoopPlayback] After init - scheduler:', !!scheduler, 'soundEngine:', !!soundEngine, 'audioContext:', !!audioContext);

    if (!scheduler) {
      console.error('[useLoopPlayback] Scheduler not initialized');
      return;
    }

    // Get loop definition
    const loopDef = getLoopById(track.loopId);
    if (!loopDef) {
      console.error('[useLoopPlayback] Loop definition not found:', track.loopId);
      return;
    }

    // Resume audio context if suspended
    if (audioContext?.state === 'suspended') {
      console.log('[useLoopPlayback] Resuming suspended audio context');
      await audioContext.resume();
    }

    console.log('[useLoopPlayback] Audio context state:', audioContext?.state, 'currentTime:', audioContext?.currentTime);
    console.log('[useLoopPlayback] Starting loop:', track.name, 'preset:', track.soundPreset, 'midiNotes:', loopDef.midiData?.length);
    console.log('[useLoopPlayback] Track details:', { id: track.id, loopId: track.loopId, soundPreset: track.soundPreset });

    // Start the loop
    const syncTimestamp = track.startTime || Date.now();
    scheduler.startLoop(track.id, loopDef, track, syncTimestamp);
    playingTracksRef.current.add(track.id);

    console.log('[useLoopPlayback] Loop started, active loops:', scheduler.getActiveLoopIds());
  }, [initialize]);

  // Stop playing a loop track
  const stopLoop = useCallback((trackId: string) => {
    const scheduler = schedulerRef.current;
    if (!scheduler) return;

    console.log('[useLoopPlayback] Stopping loop:', trackId);
    scheduler.stopLoop(trackId);
    playingTracksRef.current.delete(trackId);
  }, []);

  // Stop all loops
  const stopAll = useCallback(() => {
    const scheduler = schedulerRef.current;
    if (!scheduler) return;

    console.log('[useLoopPlayback] Stopping all loops');
    scheduler.stopAll();
    playingTracksRef.current.clear();
  }, []);

  // Listen for changes in track playing state
  useEffect(() => {
    console.log('[useLoopPlayback] Setting up track state subscription');
    const unsubscribe = useLoopTracksStore.subscribe(
      (state) => state.tracks,
      async (tracks) => {
        console.log('[useLoopPlayback] Track state changed, checking', tracks.size, 'tracks');
        // Check each track for playing state changes
        for (const [trackId, track] of tracks) {
          const wasPlaying = playingTracksRef.current.has(trackId);

          if (track.isPlaying && !wasPlaying) {
            console.log('[useLoopPlayback] Track started playing:', track.name);
            // Track started playing - startLoop will initialize if needed
            await startLoop(track);
          } else if (!track.isPlaying && wasPlaying) {
            console.log('[useLoopPlayback] Track stopped playing:', track.name);
            // Track stopped playing
            stopLoop(trackId);
          }
        }

        // Check for removed tracks
        for (const trackId of playingTracksRef.current) {
          if (!tracks.has(trackId)) {
            console.log('[useLoopPlayback] Track removed:', trackId);
            stopLoop(trackId);
          }
        }
      }
    );

    return () => {
      console.log('[useLoopPlayback] Cleaning up track state subscription');
      unsubscribe();
    };
  }, [startLoop, stopLoop]);

  // Stop all loops when global playback stops
  useEffect(() => {
    console.log('[useLoopPlayback] isPlaying effect:', isPlaying);
    if (!isPlaying) {
      console.log('[useLoopPlayback] isPlaying is false - stopping all loops');
      stopAll();
    }
  }, [isPlaying, stopAll]);

  // Update master tempo when song changes
  useEffect(() => {
    const song = getCurrentSong();
    if (song?.bpm && schedulerRef.current) {
      schedulerRef.current.setMasterTempo(song.bpm);
    }
  }, [getCurrentSong]);

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
    isInitialized: isInitializedRef.current,
  };
}
