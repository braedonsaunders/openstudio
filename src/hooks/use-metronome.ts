'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useMetronomeStore, selectEffectiveBpm } from '@/stores/metronome-store';
import { useAnalysisStore } from '@/stores/analysis-store';
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
  effectiveBpm: number;

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
 * Hook to manage the metronome engine with automatic BPM syncing
 * Integrates with:
 * - Metronome store for settings
 * - Analysis store for BPM detection (follow mode)
 * - Audio store for playback state sync
 */
export function useMetronome(options: UseMetronomeOptions): UseMetronomeResult {
  const { audioContext, masterGain, onBroadcastStreamReady, onBroadcastStreamEnded } = options;

  const engineRef = useRef<MetronomeEngine | null>(null);

  // Store state
  const {
    enabled,
    bpm,
    volume,
    bpmMode,
    lockedBpm,
    beatsPerBar,
    beatUnit,
    clickType,
    accentFirstBeat,
    broadcastEnabled,
    isPlaying,
    setCurrentBeat,
    setIsPlaying,
    setAnalyzerBpm,
    recordTap,
  } = useMetronomeStore();

  // Get effective BPM from store
  const effectiveBpm = useMetronomeStore(selectEffectiveBpm);

  // Analysis store for BPM following
  const { syncedAnalysis, localAnalysis } = useAnalysisStore();

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
      onBeat: (beat, isAccent) => {
        setCurrentBeat(beat);
      },
    });

    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [audioContext, masterGain, setCurrentBeat]);

  // ==========================================================================
  // Settings Sync
  // ==========================================================================

  // Update engine settings when store changes
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.updateSettings({
      bpm: effectiveBpm,
      volume,
      beatsPerBar,
      beatUnit,
      clickType,
      accentFirstBeat,
      broadcastEnabled,
    });
  }, [effectiveBpm, volume, beatsPerBar, beatUnit, clickType, accentFirstBeat, broadcastEnabled]);

  // ==========================================================================
  // BPM Follow Mode
  // ==========================================================================

  // Update analyzer BPM when analysis data changes
  useEffect(() => {
    const detectedBpm = syncedAnalysis?.bpm || localAnalysis?.bpm;
    if (detectedBpm !== null && detectedBpm !== undefined) {
      setAnalyzerBpm(detectedBpm);
    }
  }, [syncedAnalysis?.bpm, localAnalysis?.bpm, setAnalyzerBpm]);

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
  // This syncs the metronome to start when the backing track starts
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !enabled) return;

    if (audioIsPlaying && !engine.isPlaying()) {
      // Start metronome synced with playback
      engine.start(undefined, currentTime);
      setIsPlaying(true);
    } else if (!audioIsPlaying && engine.isPlaying()) {
      // Optionally stop with playback (remove this if metronome should be independent)
      // engine.stop();
      // setIsPlaying(false);
    }
  }, [audioIsPlaying, enabled, currentTime, setIsPlaying]);

  // ==========================================================================
  // Controls
  // ==========================================================================

  const start = useCallback((syncTimestamp?: number, offset?: number) => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.start(syncTimestamp, offset);
    setIsPlaying(true);
  }, [setIsPlaying]);

  const stop = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    engine.stop();
    setIsPlaying(false);
  }, [setIsPlaying]);

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
    recordTap();
  }, [recordTap]);

  const getBroadcastStream = useCallback(() => {
    return engineRef.current?.getBroadcastStream() || null;
  }, []);

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    engine: engineRef.current,
    isPlaying,
    currentBeat: useMetronomeStore((s) => s.currentBeat),
    effectiveBpm,
    start,
    stop,
    toggle,
    tap,
    getBroadcastStream,
  };
}
