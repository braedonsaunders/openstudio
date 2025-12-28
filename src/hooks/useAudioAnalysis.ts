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
  masterAnalyser?: AnalyserNode | null;
  isPlaying?: boolean;
  roomId?: string;
  userId?: string;
  isMaster?: boolean;
}

export function useAudioAnalysis(options: UseAudioAnalysisOptions = {}) {
  const { audioContext, localStream, backingTrackAnalyser, masterAnalyser, isPlaying, roomId, userId, isMaster } = options;

  const analyzerRef = useRef(getEssentiaAnalyzer());
  const isInitializedRef = useRef(false);
  const visualizationFrameRef = useRef<number | null>(null);
  const didStartAnalysisRef = useRef(false);

  // Subscribe to store values we need to read reactively
  // For store functions, we use getState() inside callbacks/effects to avoid dependency issues
  // Subscribe only to values, not setter functions (to avoid infinite loops)
  const {
    localAnalysis,
    syncedAnalysis,
    analysisSource,
    isAnalyzing,
    isWorkerReady,
    spectrumData,
    waveformData,
    tunerEnabled,
  } = useAnalysisStore();

  // Initialize the analyzer in background - doesn't block audio
  useEffect(() => {
    if (isInitializedRef.current) return;

    // Start background loading (non-blocking)
    analyzerRef.current.startBackgroundLoading();

    // Poll for readiness without blocking
    const checkInterval = setInterval(() => {
      const ready = analyzerRef.current.isReady();
      if (ready) {
        // Use getState() to avoid dependency on store functions
        useAnalysisStore.getState().setWorkerReady(true);
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
        // Use getState() to avoid dependency on store functions
        useAnalysisStore.getState().setWorkerReady(false);
      }
    }, 30000);

    return () => {
      clearInterval(checkInterval);
      clearTimeout(timeout);
      if (visualizationFrameRef.current) {
        cancelAnimationFrame(visualizationFrameRef.current);
      }
    };
  }, []);

  // Connect to audio context when available
  useEffect(() => {
    console.log('Connect to audio context effect:', { audioContext: !!audioContext, isWorkerReady });
    if (audioContext && isWorkerReady) {
      console.log('Connecting analyzer to audio context...');
      analyzerRef.current.connectToAudioContext(audioContext);
    }
  }, [audioContext, isWorkerReady]);

  // Update backing track availability (for UI - e.g. enable/disable Track source button)
  useEffect(() => {
    // Use getState() to avoid dependency on store functions
    useAnalysisStore.getState().setBackingTrackAvailable(!!backingTrackAnalyser);
  }, [backingTrackAnalyser]);

  // Handle analysis data updates
  // Use getState() to avoid recreating callback when room state changes
  const handleAnalysisData = useCallback(
    (data: AnalysisData) => {
      const { setLocalAnalysis, setSyncedAnalysis } = useAnalysisStore.getState();
      const { addMessage } = useRoomStore.getState();

      setLocalAnalysis(data);

      // If master and key/BPM changed significantly, broadcast to room
      // Get fresh values from options ref to avoid stale closures
      const currentIsMaster = isMaster;
      const currentUserId = userId;
      const currentRoomId = roomId;

      if (currentIsMaster && currentUserId) {
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
            updatedBy: currentUserId,
            updatedAt: Date.now(),
          };

          setSyncedAnalysis(syncData);

          // Broadcast via room message
          if (currentRoomId) {
            addMessage({
              type: 'sync',
              userId: currentUserId,
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
    // Only depend on the actual option values, not store functions
    [isMaster, userId, roomId]
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
  //
  // IMPORTANT: We avoid having store setters and volatile props like isMaster in
  // the dependency array to prevent infinite loops during room initialization.
  // Use getState() for store functions and refs for values we need to read.
  useEffect(() => {
    console.log('Analysis effect running:', {
      isWorkerReady,
      audioContext: !!audioContext,
      analysisSource,
      backingTrackAnalyser: !!backingTrackAnalyser,
      masterAnalyser: !!masterAnalyser,
      isPlaying,
      isMaster,
    });

    if (!isWorkerReady || !audioContext) {
      console.log('Analysis effect early return - not ready');
      return; // Don't set up cleanup if we didn't start anything
    }

    // Reset the ref at the start of each effect run
    didStartAnalysisRef.current = false;

    const startAnalysis = async () => {
      // Get store functions via getState() to avoid dependency array issues
      const { setIsAnalyzing, setAnalysisError } = useAnalysisStore.getState();

      try {
        if (analysisSource === 'local' && localStream) {
          // Local microphone analysis - always available
          await analyzerRef.current.analyzeStream(localStream);
          setIsAnalyzing(true);
          didStartAnalysisRef.current = true;
        } else if (analysisSource === 'backing' && backingTrackAnalyser) {
          // Backing track analysis from audio engine
          // Only analyze when playing and user is master
          console.log('Backing source - checking conditions:', { isPlaying, isMaster });
          if (isPlaying && isMaster) {
            console.log('Calling analyzeFromAnalyserNode...');
            analyzerRef.current.analyzeFromAnalyserNode(backingTrackAnalyser);
            setIsAnalyzing(true);
            didStartAnalysisRef.current = true;
            console.log('Started backing track analysis (master)');
          } else if (!isPlaying) {
            // Stop analysis when not playing
            analyzerRef.current.stopAnalysis();
            setIsAnalyzing(false);
          }
        } else if (analysisSource === 'mixed' && masterAnalyser) {
          // Mixed mode: analyze all audio (backing + all users' instruments)
          // Only analyze when master to avoid duplicate processing
          if (isMaster) {
            analyzerRef.current.analyzeFromAnalyserNode(masterAnalyser);
            setIsAnalyzing(true);
            didStartAnalysisRef.current = true;
            console.log('Started mixed audio analysis (master) - analyzing all audio');
          }
        }
      } catch (error) {
        console.error('Failed to start analysis:', error);
        setAnalysisError('Failed to start audio analysis');
      }
    };

    startAnalysis();

    // Cleanup when dependencies change - only if we actually started analysis
    return () => {
      if (didStartAnalysisRef.current) {
        console.log('Analysis effect cleanup running');
        const { setIsAnalyzing } = useAnalysisStore.getState();
        if (analysisSource === 'backing' || analysisSource === 'mixed') {
          analyzerRef.current.stopAnalysis();
          setIsAnalyzing(false);
        }
        didStartAnalysisRef.current = false;
      }
    };
  }, [
    analysisSource,
    localStream,
    backingTrackAnalyser,
    masterAnalyser,
    isPlaying,
    isMaster,
    audioContext,
    isWorkerReady,
    // Removed setIsAnalyzing and setAnalysisError - use getState() instead
  ]);

  // Update visualization data
  // Use getState() for store functions to avoid dependency issues
  useEffect(() => {
    if (!isAnalyzing) return;

    const updateVisualization = () => {
      const spectrum = analyzerRef.current.getSpectrumData();
      const waveform = analyzerRef.current.getWaveformData();
      const { setSpectrumData, setWaveformData } = useAnalysisStore.getState();

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
  }, [isAnalyzing]);

  // Listen for synced analysis from other users
  // Use getState() for store functions to avoid dependency issues
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
          const { setSyncedAnalysis } = useAnalysisStore.getState();

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
  }, [userId]);

  // Stop analysis - use getState() to avoid dependency issues
  const stopAnalysis = useCallback(() => {
    analyzerRef.current.stopAnalysis();
    useAnalysisStore.getState().setIsAnalyzing(false);
  }, []);

  // Reset analysis - clears all buffers and stored key/BPM data
  // Call this when switching backing tracks
  const resetAnalysis = useCallback(() => {
    analyzerRef.current.stopAnalysis();
    analyzerRef.current.resetAnalysis();
    const { clearAnalysisData, setIsAnalyzing } = useAnalysisStore.getState();
    clearAnalysisData();
    setIsAnalyzing(false);
    console.log('Analysis reset - ready for new track');
  }, []);

  // Toggle tuner mode
  const toggleTuner = useCallback(() => {
    const { tunerEnabled, setTunerEnabled } = useAnalysisStore.getState();
    setTunerEnabled(!tunerEnabled);
  }, []);

  // Switch analysis source
  const switchSource = useCallback(
    (source: 'backing' | 'local' | 'mixed') => {
      analyzerRef.current.stopAnalysis();
      useAnalysisStore.getState().setAnalysisSource(source);
    },
    []
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
    resetAnalysis,
    toggleTuner,
    switchSource,
  };
}
