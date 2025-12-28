'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMetronomeStore } from '@/stores/metronome-store';
import { useSessionTempoStore, selectTempo, selectTimeSignature } from '@/stores/session-tempo-store';
import { useAudioStore } from '@/stores/audio-store';
import { MetronomeEngine } from '@/lib/audio/metronome-engine';

interface UseMetronomeOptions {
  audioContext: AudioContext | null;
  masterGain?: AudioNode | null;
  onBroadcastStreamReady?: (stream: MediaStream) => void;
  onBroadcastStreamEnded?: () => void;
}

interface UseMetronomeResult {
  // Metronome engine instance
  engine: MetronomeEngine | null;

  // Current state
  isPlaying: boolean;
  currentBeat: number;
  tempo: number;

  // Controls
  start: (syncTimestamp?: number, offset?: number) => void;
  stop: () => void;
  toggle: () => void;

  // Tap tempo
  tap: () => void;

  // Get broadcast stream
  getBroadcastStream: () => MediaStream | null;
}

/**
 * Hook to manage the metronome engine with automatic tempo syncing
 *
 * Integrates with:
 * - Metronome store for settings (volume, click type, etc.)
 * - Session Tempo store for BPM and time signature
 * - Audio store for playback state sync
 */
export function useMetronome(options: UseMetronomeOptions): UseMetronomeResult {
  const { audioContext, masterGain, onBroadcastStreamReady, onBroadcastStreamEnded } = options;

  const engineRef = useRef<MetronomeEngine | null>(null);

  // Metronome settings store - only subscribe to values, not functions
  const {
    enabled,
    volume,
    clickType,
    accentFirstBeat,
    broadcastEnabled,
    isPlaying,
  } = useMetronomeStore();

  // Session tempo store - use shallow for object selectors
  const tempo = useSessionTempoStore(selectTempo);
  const { beatsPerBar, beatUnit } = useSessionTempoStore(useShallow(selectTimeSignature));

  // Audio store for playback sync
  const audioIsPlaying = useAudioStore((s) => s.isPlaying);
  const currentTime = useAudioStore((s) => s.currentTime);

  // ==========================================================================
  // Engine Initialization
  // ==========================================================================

  useEffect(() => {
    if (!audioContext) return;

    // Create engine
    const engine = new MetronomeEngine(
      audioContext,
      masterGain || undefined
    );

    engine.setCallbacks({
      onBeat: (beat) => {
        // Use getState() to avoid dependency on store functions
        useMetronomeStore.getState().setCurrentBeat(beat);
      },
    });

    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [audioContext, masterGain]);

  // ==========================================================================
  // Settings Sync
  // ==========================================================================

  // Update engine settings when store changes
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.setBpm(tempo);
    engine.setVolume(volume);
    engine.setBeatsPerBar(beatsPerBar);
    engine.setBeatUnit(beatUnit);
    engine.setClickType(clickType);
    engine.setAccentFirstBeat(accentFirstBeat);
  }, [tempo, volume, beatsPerBar, beatUnit, clickType, accentFirstBeat]);

  // ==========================================================================
  // Broadcast Management
  // ==========================================================================

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (broadcastEnabled) {
      const stream = engine.enableBroadcast();
      onBroadcastStreamReady?.(stream);
    } else {
      engine.disableBroadcast();
      onBroadcastStreamEnded?.();
    }
  }, [broadcastEnabled, onBroadcastStreamReady, onBroadcastStreamEnded]);

  // ==========================================================================
  // Playback Sync
  // ==========================================================================

  // Auto-start/stop with backing track playback (optional behavior)
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !enabled) return;

    if (audioIsPlaying && !engine.isPlaying()) {
      // Start metronome synced with playback
      engine.start(undefined, currentTime);
      // Use getState() to avoid dependency on store functions
      useMetronomeStore.getState().setIsPlaying(true);
    }
  }, [audioIsPlaying, enabled, currentTime]);

  // ==========================================================================
  // Controls
  // ==========================================================================

  const start = useCallback((syncTimestamp?: number, offset?: number) => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.start(syncTimestamp, offset);
    // Use getState() to avoid dependency on store functions
    useMetronomeStore.getState().setIsPlaying(true);
  }, []);

  const stop = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.stop();
    // Use getState() to avoid dependency on store functions
    useMetronomeStore.getState().setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (engine.isPlaying()) {
      stop();
    } else {
      start();
    }
  }, [start, stop]);

  const tap = useCallback(() => {
    // Use getState() to avoid dependency on store functions
    useSessionTempoStore.getState().recordTap();
  }, []);

  const getBroadcastStream = useCallback(() => {
    return engineRef.current?.getBroadcastStream() || null;
  }, []);

  // ==========================================================================
  // Toggle enabled state
  // ==========================================================================

  const handleToggle = useCallback(() => {
    // Use getState() to avoid dependency on store functions
    const { enabled: currentEnabled, setEnabled } = useMetronomeStore.getState();
    setEnabled(!currentEnabled);
    if (!currentEnabled) {
      start();
    } else {
      stop();
    }
  }, [start, stop]);

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    engine: engineRef.current,
    isPlaying,
    currentBeat: useMetronomeStore((s) => s.currentBeat),
    tempo,
    start,
    stop,
    toggle: handleToggle,
    tap,
    getBroadcastStream,
  };
}
