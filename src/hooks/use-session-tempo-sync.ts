'use client';

import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSessionTempoStore, selectTempo, selectKey } from '@/stores/session-tempo-store';
import { useLoopTracksStore } from '@/stores/loop-tracks-store';
import { useRoomStore } from '@/stores/room-store';
import { useSongsStore } from '@/stores/songs-store';
import { useAnalysisStore } from '@/stores/analysis-store';

/**
 * Hook to synchronize session tempo across all stores and track sources.
 *
 * This hook:
 * 1. Updates session tempo store when the backing track changes (if track has BPM metadata)
 * 2. Updates session tempo store when synced analysis data changes
 * 3. Updates loop tracks store master tempo from session tempo
 *
 * Should be used once at a high level in the application (e.g., in StudioPage or RoomPage).
 */
export function useSessionTempoSync(): void {
  // Subscribe to values we need reactively
  // Use shallow equality for object selectors to prevent infinite re-renders
  const tempo = useSessionTempoStore(selectTempo);
  const { key, scale: keyScale } = useSessionTempoStore(useShallow(selectKey));

  // ==========================================================================
  // Sync backing track metadata to session tempo store
  // ==========================================================================
  useEffect(() => {
    // Subscribe to room store currentTrack changes
    const unsubscribe = useRoomStore.subscribe(
      (state) => state.currentTrack,
      (currentTrack) => {
        // Use getState() to avoid dependency on store functions
        const { setTrackMetadata } = useSessionTempoStore.getState();
        if (currentTrack) {
          // Update session tempo with track metadata
          setTrackMetadata({
            bpm: currentTrack.bpm,
            key: currentTrack.key,
            keyScale: currentTrack.keyScale,
            timeSignature: currentTrack.timeSignature,
          });
        } else {
          // Clear track metadata when no track
          setTrackMetadata(null);
        }
      },
      { fireImmediately: true }
    );

    return unsubscribe;
  }, []);

  // ==========================================================================
  // Sync analyzer data to session tempo store
  // ==========================================================================
  useEffect(() => {
    // Subscribe to analysis store synced analysis changes
    const unsubscribe = useAnalysisStore.subscribe(
      (state) => state.syncedAnalysis,
      (syncedAnalysis) => {
        // Use getState() to avoid dependency on store functions
        const { setAnalyzerData } = useSessionTempoStore.getState();
        if (syncedAnalysis) {
          setAnalyzerData({
            bpm: syncedAnalysis.bpm,
            key: syncedAnalysis.key,
            keyScale: syncedAnalysis.keyScale,
            // Could add confidence here if available
            bpmConfidence: 0.8, // Default confidence for synced data
          });
        } else {
          setAnalyzerData({
            bpm: null,
            key: null,
            keyScale: null,
            bpmConfidence: 0,
          });
        }
      },
      { fireImmediately: true }
    );

    return unsubscribe;
  }, []);

  // ==========================================================================
  // Sync song BPM and Key to session tempo when song changes
  // ==========================================================================
  const previousSongIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Subscribe to current song changes (standard zustand subscribe, not subscribeWithSelector)
    let prevSongId = useSongsStore.getState().currentSongId;

    const unsubscribe = useSongsStore.subscribe((state) => {
      const currentSongId = state.currentSongId;
      // Only sync when actually changing to a different song
      if (currentSongId !== prevSongId) {
        prevSongId = currentSongId;
        if (currentSongId && currentSongId !== previousSongIdRef.current) {
          const song = state.getSongById(currentSongId);
          if (song) {
            const { setManualTempo, setManualKey } = useSessionTempoStore.getState();

            // Set the song's BPM as the manual tempo (base tempo)
            // Don't change the source mode - if user is in analyzer mode, let analyzer control
            // If in manual mode, this sets the tempo directly
            if (song.bpm) {
              setManualTempo(song.bpm);
            }

            // Set the song's key as the manual key
            // Parse key string (e.g., "Am" -> key: "A", scale: "minor")
            if (song.key) {
              const isMinor = song.key.endsWith('m');
              const keyRoot = isMinor ? song.key.slice(0, -1) : song.key;
              setManualKey(keyRoot, isMinor ? 'minor' : 'major');
            }
          }
        }
        previousSongIdRef.current = currentSongId;
      }
    });

    return unsubscribe;
  }, []);

  // ==========================================================================
  // Sync session tempo to loop tracks store
  // ==========================================================================
  useEffect(() => {
    // Use getState() to avoid dependency on store functions
    useLoopTracksStore.getState().setMasterTempo(tempo);
  }, [tempo]);

  // ==========================================================================
  // Sync session key to loop tracks store
  // ==========================================================================
  useEffect(() => {
    // Use getState() to avoid dependency on store functions
    const { setMasterKey } = useLoopTracksStore.getState();
    // Update loop tracks store whenever session key changes
    // Combine key and scale into the format loop tracks expects (e.g., "Am" or "C")
    if (key) {
      const keyString = keyScale === 'minor' ? `${key}m` : key;
      setMasterKey(keyString);
    } else {
      setMasterKey(null);
    }
  }, [key, keyScale]);
}

/**
 * Hook to get the current session tempo state for display.
 * Provides a convenient way to access tempo info without subscribing to changes.
 */
export function useSessionTempoDisplay() {
  const tempo = useSessionTempoStore(selectTempo);
  const source = useSessionTempoStore((s) => s.source);
  const trackTempo = useSessionTempoStore((s) => s.trackTempo);
  const analyzerTempo = useSessionTempoStore((s) => s.analyzerTempo);
  const analyzerConfidence = useSessionTempoStore((s) => s.analyzerConfidence);
  // Use shallow equality for object selectors to prevent infinite re-renders
  const { key, scale: keyScale } = useSessionTempoStore(useShallow(selectKey));
  // Select primitive values individually to avoid object reference issues
  const beatsPerBar = useSessionTempoStore((s) => s.beatsPerBar);
  const beatUnit = useSessionTempoStore((s) => s.beatUnit);

  return {
    tempo,
    source,
    trackTempo,
    analyzerTempo,
    analyzerConfidence,
    key,
    keyScale,
    beatsPerBar,
    beatUnit,
    hasTrackTempo: trackTempo !== null,
    hasAnalyzerTempo: analyzerTempo !== null,
  };
}
