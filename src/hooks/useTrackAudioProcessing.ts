'use client';

import { useEffect, useRef, useCallback } from 'react';
import { TrackAudioProcessor } from '@/lib/audio/track-audio-processor';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { useAudioStore } from '@/stores/audio-store';
import type { UserTrack, TrackPerformanceMetrics, AudioPerformanceMetrics } from '@/types';

// Track audio processor manager
// This hook subscribes to track state changes and manages TrackAudioProcessor instances

interface TrackProcessorMap {
  processor: TrackAudioProcessor;
  sourceNode: MediaStreamAudioSourceNode | null;
}

export function useTrackAudioProcessing() {
  const processorsRef = useRef<Map<string, TrackProcessorMap>>(new Map());
  const metricsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastJsProcessingTimeRef = useRef<number>(0);

  // Only subscribe to audioContext value, not setter functions (to avoid infinite loops)
  const audioContext = useAudioStore((s) => s.audioContext);
  const tracks = useUserTracksStore((state) => state.tracks);

  // Create or update processor for a track
  const createOrUpdateProcessor = useCallback((
    track: UserTrack,
    ctx: AudioContext,
    masterGain: GainNode
  ) => {
    let entry = processorsRef.current.get(track.id);

    if (!entry) {
      // Create new processor
      const processor = new TrackAudioProcessor(
        ctx,
        track.id,
        track.audioSettings,
        (effects) => {
          // Callback when effects settings change from processor
          useUserTracksStore.getState().updateTrackEffects(track.id, effects);
        }
      );

      // Connect processor output to master
      processor.connect(masterGain);

      entry = { processor, sourceNode: null };
      processorsRef.current.set(track.id, entry);
    }

    // Update processor state
    entry.processor.updateState({
      isMuted: track.isMuted,
      isSolo: track.isSolo,
      volume: track.volume,
      isArmed: track.isArmed,
      inputGain: track.audioSettings.inputGain,
    });

    // Update effects if they've changed
    if (track.audioSettings.effects) {
      entry.processor.updateEffects(track.audioSettings.effects);
    }

    return entry;
  }, []);

  // Connect a media stream to a track's processor
  const connectStreamToTrack = useCallback((
    trackId: string,
    stream: MediaStream
  ) => {
    const ctx = useAudioStore.getState().audioContext;
    if (!ctx) return;

    const entry = processorsRef.current.get(trackId);
    if (!entry) return;

    // Disconnect existing source if any
    if (entry.sourceNode) {
      entry.sourceNode.disconnect();
    }

    // Create new source and connect to processor input
    const sourceNode = ctx.createMediaStreamSource(stream);
    sourceNode.connect(entry.processor.getInputNode());
    entry.sourceNode = sourceNode;
  }, []);

  // Remove processor for a track
  const removeProcessor = useCallback((trackId: string) => {
    const entry = processorsRef.current.get(trackId);
    if (entry) {
      entry.sourceNode?.disconnect();
      entry.processor.dispose();
      processorsRef.current.delete(trackId);
    }
  }, []);

  // Get processor for a track
  const getProcessor = useCallback((trackId: string): TrackAudioProcessor | undefined => {
    return processorsRef.current.get(trackId)?.processor;
  }, []);

  // Measure audio context latency
  const measureAudioContextLatency = useCallback((): number => {
    const ctx = useAudioStore.getState().audioContext;
    if (!ctx) return 0;

    // baseLatency is the inherent latency of the audio context
    // outputLatency is the additional latency from the audio device
    const baseLatency = ctx.baseLatency ?? 0;
    const outputLatency = (ctx as AudioContext & { outputLatency?: number }).outputLatency ?? 0;

    return (baseLatency + outputLatency) * 1000; // Convert to ms
  }, []);

  // Collect and update performance metrics
  // Use getState() for store functions to avoid dependency issues
  const updateMetrics = useCallback(() => {
    const start = performance.now();
    const ctx = useAudioStore.getState().audioContext;

    if (!ctx) return;

    const audioContextLatency = measureAudioContextLatency();
    let totalEffectsTime = 0;

    // Get store functions via getState() to avoid infinite loops
    const { updateTrackMetrics, setPerformanceMetrics, settings } = useAudioStore.getState();

    // Collect metrics from all processors
    for (const [trackId, entry] of processorsRef.current) {
      const metrics = entry.processor.getMetrics();
      totalEffectsTime += metrics.effectsProcessingTime;

      const trackMetrics: TrackPerformanceMetrics = {
        trackId,
        inputLevel: metrics.inputLevel,
        outputLevel: metrics.outputLevel,
        effectsTime: metrics.effectsProcessingTime,
        isMuted: !entry.processor.isOutputting(),
        isSolo: entry.processor.getState().isSolo,
        isClipping: metrics.isClipping,
      };

      updateTrackMetrics(trackId, trackMetrics);
    }

    const jsProcessingTime = performance.now() - start;
    lastJsProcessingTimeRef.current = jsProcessingTime;

    // Calculate buffer size in ms
    const bufferLatencyMs = (settings.bufferSize / settings.sampleRate) * 1000;

    const performanceUpdate: Partial<AudioPerformanceMetrics> = {
      audioContextLatency,
      jsProcessingTime,
      effectsProcessingTime: totalEffectsTime,
      totalLatency: audioContextLatency + bufferLatencyMs,
      currentBufferSize: settings.bufferSize,
    };

    setPerformanceMetrics(performanceUpdate);
  }, [measureAudioContextLatency]);

  // Start metrics collection interval
  useEffect(() => {
    if (audioContext) {
      // Update metrics every 100ms
      metricsIntervalRef.current = setInterval(updateMetrics, 100);
    }

    return () => {
      if (metricsIntervalRef.current) {
        clearInterval(metricsIntervalRef.current);
        metricsIntervalRef.current = null;
      }
    };
  }, [audioContext, updateMetrics]);

  // Subscribe to track changes
  useEffect(() => {
    // This effect runs whenever tracks change
    // We sync processor state with track state
    const ctx = useAudioStore.getState().audioContext;
    if (!ctx) return;

    // We need to get a reference to masterGain from the audio engine
    // For now, we'll use destination directly or look for existing gain node
    // This will be properly connected when useAudioEngine initializes

    return () => {
      // Cleanup: dispose all processors
      for (const entry of processorsRef.current.values()) {
        entry.sourceNode?.disconnect();
        entry.processor.dispose();
      }
      processorsRef.current.clear();
    };
  }, []);

  return {
    createOrUpdateProcessor,
    connectStreamToTrack,
    removeProcessor,
    getProcessor,
    updateMetrics,
  };
}
