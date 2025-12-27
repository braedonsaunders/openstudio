'use client';

import { useEffect, useCallback, useRef } from 'react';
import { getEssentiaAnalyzer } from '@/lib/audio/essentia-analyzer';
import { useAnalysisStore } from '@/stores/analysis-store';
import { useRoomStore } from '@/stores/room-store';
import type { AnalysisData, SyncedAnalysis } from '@/stores/analysis-store';

interface UseAudioAnalysisOptions {
  audioContext?: AudioContext | null;
  localStream?: MediaStream | null;
  backingTrackAnalyser?: AnalyserNode | null;
  isPlaying?: boolean;
  roomId?: string;
  userId?: string;
  isMaster?: boolean;
}

export function useAudioAnalysis(options: UseAudioAnalysisOptions = {}) {
  const { audioContext, localStream, backingTrackAnalyser, isPlaying, roomId, userId, isMaster } = options;

  const analyzerRef = useRef(getEssentiaAnalyzer());
  const isInitializedRef = useRef(false);
  const visualizationFrameRef = useRef<number | null>(null);

  const {
    localAnalysis,
    syncedAnalysis,
    analysisSource,
    isAnalyzing,
    isWorkerReady,
    spectrumData,
    waveformData,
    tunerEnabled,
    setLocalAnalysis,
    setSyncedAnalysis,
    setAnalysisSource,
    setIsAnalyzing,
    setWorkerReady,
    setAnalysisError,
    setBackingTrackAvailable,
    setSpectrumData,
    setWaveformData,
    setTunerEnabled,
  } = useAnalysisStore();

  const { addMessage, currentUser } = useRoomStore();

  // Initialize the analyzer in background - doesn't block audio
  useEffect(() => {
    if (isInitializedRef.current) return;

    // Start background loading (non-blocking)
    analyzerRef.current.startBackgroundLoading();

    // Poll for readiness without blocking
    const checkInterval = setInterval(() => {
      const ready = analyzerRef.current.isReady();
      if (ready) {
        setWorkerReady(true);
        isInitializedRef.current = true;
        clearInterval(checkInterval);
        console.log('Audio analysis ready');
      }
    }, 500); // Check every 500ms

    // Stop polling after 30 seconds (loading timeout)
    const timeout = setTimeout(() => {
      clearInterval(checkInterval);
      if (!analyzerRef.current.isReady()) {
        console.log('Audio analysis disabled - essentia.js loading timed out');
        setWorkerReady(false);
      }
    }, 30000);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
      if (visualizationFrameRef.current) {
        cancelAnimationFrame(visualizationFrameRef.current);
      }
    };
  }, [setWorkerReady]);

  // Connect to audio context when available
  useEffect(() => {
    if (audioContext && isWorkerReady) {
      analyzerRef.current.connectToAudioContext(audioContext);
    }
  }, [audioContext, isWorkerReady]);

  // Update backing track availability (for UI - e.g. enable/disable Track source button)
  useEffect(() => {
    setBackingTrackAvailable(!!backingTrackAnalyser);
  }, [backingTrackAnalyser, setBackingTrackAvailable]);

  // Handle analysis data updates
  const handleAnalysisData = useCallback(
    (data: AnalysisData) => {
      setLocalAnalysis(data);

      // If master and key/BPM changed significantly, broadcast to room
      if (isMaster && userId) {
        const currentSynced = useAnalysisStore.getState().syncedAnalysis;
        const shouldSync =
          !currentSynced ||
          currentSynced.key !== data.key ||
          currentSynced.keyScale !== data.keyScale ||
          (data.bpm && Math.abs((currentSynced.bpm || 0) - data.bpm) > 2);

        if (shouldSync && (data.key || data.bpm)) {
          const syncData: SyncedAnalysis = {
            key: data.key,
            keyScale: data.keyScale,
            bpm: data.bpm,
            updatedBy: userId,
            updatedAt: Date.now(),
          };

          setSyncedAnalysis(syncData);

          // Broadcast via room message
          if (roomId) {
            addMessage({
              type: 'sync',
              userId,
              content: '',
              timestamp: new Date().toISOString(),
              data: {
                type: 'analysis',
                ...syncData,
              },
            });
          }
        }
      }
    },
    [isMaster, userId, roomId, setLocalAnalysis, setSyncedAnalysis, addMessage]
  );

  // Set up analysis callback
  useEffect(() => {
    analyzerRef.current.setOnAnalysis(handleAnalysisData);
  }, [handleAnalysisData]);

  // Start/stop analysis based on source and playback state
  // Analysis runs automatically when:
  // - User is master (only master analyzes, results are synced to others)
  // - Audio is playing
  // - Analyser is ready
  useEffect(() => {
    if (!isWorkerReady || !audioContext) return;

    const startAnalysis = async () => {
      try {
        if (analysisSource === 'local' && localStream) {
          // Local microphone analysis - always available
          await analyzerRef.current.analyzeStream(localStream);
          setIsAnalyzing(true);
        } else if (analysisSource === 'backing' && backingTrackAnalyser) {
          // Backing track analysis from audio engine
          // Only analyze when playing and user is master
          if (isPlaying && isMaster) {
            analyzerRef.current.analyzeFromAnalyserNode(backingTrackAnalyser);
            setIsAnalyzing(true);
            console.log('Started backing track analysis (master)');
          } else if (!isPlaying) {
            // Stop analysis when not playing
            analyzerRef.current.stopAnalysis();
            setIsAnalyzing(false);
          }
        } else if (analysisSource === 'mixed') {
          // For mixed mode, analyze local stream (could be enhanced to mix both)
          if (localStream) {
            await analyzerRef.current.analyzeStream(localStream);
            setIsAnalyzing(true);
          }
        }
      } catch (error) {
        console.error('Failed to start analysis:', error);
        setAnalysisError('Failed to start audio analysis');
      }
    };

    startAnalysis();

    // Cleanup when dependencies change
    return () => {
      if (analysisSource === 'backing') {
        analyzerRef.current.stopAnalysis();
        setIsAnalyzing(false);
      }
    };
  }, [
    analysisSource,
    localStream,
    backingTrackAnalyser,
    isPlaying,
    isMaster,
    audioContext,
    isWorkerReady,
    setIsAnalyzing,
    setAnalysisError,
  ]);

  // Update visualization data
  useEffect(() => {
    if (!isAnalyzing) return;

    const updateVisualization = () => {
      const spectrum = analyzerRef.current.getSpectrumData();
      const waveform = analyzerRef.current.getWaveformData();

      if (spectrum) setSpectrumData(spectrum);
      if (waveform) setWaveformData(waveform);

      visualizationFrameRef.current = requestAnimationFrame(updateVisualization);
    };

    updateVisualization();

    return () => {
      if (visualizationFrameRef.current) {
        cancelAnimationFrame(visualizationFrameRef.current);
      }
    };
  }, [isAnalyzing, setSpectrumData, setWaveformData]);

  // Listen for synced analysis from other users
  useEffect(() => {
    const unsubscribe = useRoomStore.subscribe(
      (state) => state.messages,
      (messages) => {
        if (!messages.length) return;

        const lastMessage = messages[messages.length - 1];
        if (
          lastMessage.type === 'sync' &&
          lastMessage.data?.type === 'analysis' &&
          lastMessage.userId !== userId
        ) {
          const data = lastMessage.data as unknown as SyncedAnalysis & { type: string };

          setSyncedAnalysis({
            key: data.key,
            keyScale: data.keyScale,
            bpm: data.bpm,
            updatedBy: data.updatedBy,
            updatedAt: data.updatedAt,
          });
        }
      }
    );

    return () => unsubscribe();
  }, [userId, setSyncedAnalysis]);

  // Stop analysis
  const stopAnalysis = useCallback(() => {
    analyzerRef.current.stopAnalysis();
    setIsAnalyzing(false);
  }, [setIsAnalyzing]);

  // Toggle tuner mode
  const toggleTuner = useCallback(() => {
    setTunerEnabled(!tunerEnabled);
  }, [tunerEnabled, setTunerEnabled]);

  // Switch analysis source
  const switchSource = useCallback(
    (source: 'backing' | 'local' | 'mixed') => {
      analyzerRef.current.stopAnalysis();
      setAnalysisSource(source);
    },
    [setAnalysisSource]
  );

  // Get the effective analysis (synced or local)
  const effectiveAnalysis = syncedAnalysis
    ? {
        ...localAnalysis,
        key: syncedAnalysis.key,
        keyScale: syncedAnalysis.keyScale,
        bpm: syncedAnalysis.bpm,
      }
    : localAnalysis;

  return {
    analysis: effectiveAnalysis,
    localAnalysis,
    syncedAnalysis,
    isAnalyzing,
    isReady: isWorkerReady,
    analysisSource,
    spectrumData,
    waveformData,
    tunerEnabled,
    stopAnalysis,
    toggleTuner,
    switchSource,
  };
}
