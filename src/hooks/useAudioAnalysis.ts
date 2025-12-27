'use client';

import { useEffect, useCallback, useRef } from 'react';
import { getEssentiaAnalyzer } from '@/lib/audio/essentia-analyzer';
import { useAnalysisStore } from '@/stores/analysis-store';
import { useRoomStore } from '@/stores/room-store';
import type { AnalysisData, SyncedAnalysis } from '@/stores/analysis-store';

interface UseAudioAnalysisOptions {
  audioContext?: AudioContext | null;
  localStream?: MediaStream | null;
  backingTrackElement?: HTMLAudioElement | null;
  roomId?: string;
  userId?: string;
  isMaster?: boolean;
}

export function useAudioAnalysis(options: UseAudioAnalysisOptions = {}) {
  const { audioContext, localStream, backingTrackElement, roomId, userId, isMaster } = options;

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
    setSpectrumData,
    setWaveformData,
    setTunerEnabled,
  } = useAnalysisStore();

  const { addMessage, currentUser } = useRoomStore();

  // Initialize the analyzer
  useEffect(() => {
    const initAnalyzer = async () => {
      if (isInitializedRef.current) return;

      try {
        await analyzerRef.current.initialize();
        setWorkerReady(true);
        isInitializedRef.current = true;
      } catch (error) {
        setAnalysisError('Failed to initialize audio analysis');
        console.error('Failed to initialize analyzer:', error);
      }
    };

    initAnalyzer();

    return () => {
      if (visualizationFrameRef.current) {
        cancelAnimationFrame(visualizationFrameRef.current);
      }
    };
  }, [setWorkerReady, setAnalysisError]);

  // Connect to audio context when available
  useEffect(() => {
    if (audioContext && isWorkerReady) {
      analyzerRef.current.connectToAudioContext(audioContext);
    }
  }, [audioContext, isWorkerReady]);

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
              timestamp: Date.now(),
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

  // Start/stop analysis based on source
  useEffect(() => {
    if (!isWorkerReady || !audioContext) return;

    const startAnalysis = async () => {
      try {
        if (analysisSource === 'local' && localStream) {
          await analyzerRef.current.analyzeStream(localStream);
          setIsAnalyzing(true);
        } else if (analysisSource === 'backing' && backingTrackElement) {
          await analyzerRef.current.analyzeElement(backingTrackElement);
          setIsAnalyzing(true);
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
  }, [
    analysisSource,
    localStream,
    backingTrackElement,
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
