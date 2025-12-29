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

  // CRITICAL: NO store subscriptions in this hook to avoid infinite render loops
  // All store reads use getState() which doesn't trigger re-renders
  // This hook is used by DAWLayout which only needs the stable callbacks (resetAnalysis, etc.)

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
  // Use store subscription outside of React to avoid render cycles
  useEffect(() => {
    const checkAndConnect = () => {
      const { isWorkerReady } = useAnalysisStore.getState();
      console.log('Connect to audio context effect:', { audioContext: !!audioContext, isWorkerReady });
      if (audioContext && isWorkerReady) {
        console.log('Connecting analyzer to audio context...');
        analyzerRef.current.connectToAudioContext(audioContext);
        return true;
      }
      return false;
    };

    // Check immediately
    if (checkAndConnect()) return;

    // If not ready, subscribe to store changes outside of React
    const unsubscribe = useAnalysisStore.subscribe(
      (state) => state.isWorkerReady,
      (isWorkerReady) => {
        if (isWorkerReady && audioContext) {
          console.log('Connecting analyzer to audio context (via subscription)...');
          analyzerRef.current.connectToAudioContext(audioContext);
        }
      }
    );

    return () => unsubscribe();
  }, [audioContext]);

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

  // Store current props in refs so store subscriptions can access them
  const propsRef = useRef({ localStream, backingTrackAnalyser, masterAnalyser, isPlaying, isMaster, audioContext });
  propsRef.current = { localStream, backingTrackAnalyser, masterAnalyser, isPlaying, isMaster, audioContext };

  // Start/stop analysis based on source and playback state
  // Analysis runs automatically when:
  // - User is master (only master analyzes, results are synced to others)
  // - Audio is playing
  // - Analyser is ready
  //
  // CRITICAL: This effect uses getState() for ALL store reads to avoid render cycles.
  // We only depend on props passed in from the parent, not on store state.
  useEffect(() => {
    const { isWorkerReady, analysisSource } = useAnalysisStore.getState();

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
          }
          // NOTE: Removed setIsAnalyzing(false) call when not playing - this was causing render loops
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
        const { analysisSource: currentSource } = useAnalysisStore.getState();
        const { setIsAnalyzing } = useAnalysisStore.getState();
        if (currentSource === 'backing' || currentSource === 'mixed') {
          analyzerRef.current.stopAnalysis();
          setIsAnalyzing(false);
        }
        didStartAnalysisRef.current = false;
      }
    };
  }, [
    // Only depend on props, NOT on store state
    localStream,
    backingTrackAnalyser,
    masterAnalyser,
    isPlaying,
    isMaster,
    audioContext,
  ]);

  // Helper to start analysis based on current state
  const tryStartAnalysis = useCallback(() => {
    const { isWorkerReady, analysisSource, setIsAnalyzing, setAnalysisError } = useAnalysisStore.getState();
    const { localStream: stream, backingTrackAnalyser: backing, masterAnalyser: master, isPlaying: playing, isMaster: isMasterUser, audioContext: ctx } = propsRef.current;

    if (!isWorkerReady || !ctx) return false;

    try {
      if (analysisSource === 'local' && stream) {
        analyzerRef.current.analyzeStream(stream);
        setIsAnalyzing(true);
        return true;
      } else if (analysisSource === 'backing' && backing && playing && isMasterUser) {
        analyzerRef.current.analyzeFromAnalyserNode(backing);
        setIsAnalyzing(true);
        return true;
      } else if (analysisSource === 'mixed' && master && isMasterUser) {
        analyzerRef.current.analyzeFromAnalyserNode(master);
        setIsAnalyzing(true);
        return true;
      }
    } catch (error) {
      console.error('Failed to start analysis:', error);
      setAnalysisError('Failed to start audio analysis');
    }
    return false;
  }, []);

  // Subscribe to analysisSource changes to restart analysis when source is switched
  // This runs outside React's render cycle to avoid infinite loops
  useEffect(() => {
    const unsubscribe = useAnalysisStore.subscribe(
      (state) => state.analysisSource,
      (newSource) => {
        console.log('Analysis source changed to:', newSource);

        // Stop current analysis and restart with new source
        analyzerRef.current.stopAnalysis();
        useAnalysisStore.getState().setIsAnalyzing(false);
        tryStartAnalysis();
      }
    );

    return () => unsubscribe();
  }, [tryStartAnalysis]);

  // Subscribe to isWorkerReady to start analysis when worker becomes ready
  useEffect(() => {
    const unsubscribe = useAnalysisStore.subscribe(
      (state) => state.isWorkerReady,
      (isReady) => {
        if (isReady) {
          console.log('Worker ready - attempting to start analysis');
          tryStartAnalysis();
        }
      }
    );

    return () => unsubscribe();
  }, [tryStartAnalysis]);

  // Update visualization data
  // Use store subscription outside of React to avoid render cycles
  useEffect(() => {
    let animationFrameId: number | null = null;

    const updateVisualization = () => {
      const spectrum = analyzerRef.current.getSpectrumData();
      const waveform = analyzerRef.current.getWaveformData();
      const { setSpectrumData, setWaveformData, isAnalyzing: currentlyAnalyzing } = useAnalysisStore.getState();

      if (currentlyAnalyzing) {
        if (spectrum) setSpectrumData(spectrum);
        if (waveform) setWaveformData(waveform);
        animationFrameId = requestAnimationFrame(updateVisualization);
      }
    };

    // Subscribe to isAnalyzing changes to start/stop visualization loop
    const unsubscribe = useAnalysisStore.subscribe(
      (state) => state.isAnalyzing,
      (isAnalyzing) => {
        if (isAnalyzing) {
          updateVisualization();
        } else if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
      }
    );

    // Check initial state
    if (useAnalysisStore.getState().isAnalyzing) {
      updateVisualization();
    }

    return () => {
      unsubscribe();
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

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
  // Uses getState() to avoid triggering re-renders - consumers that need reactive updates
  // should subscribe to the analysis store directly
  const getEffectiveAnalysis = useCallback(() => {
    const { localAnalysis, syncedAnalysis } = useAnalysisStore.getState();
    return syncedAnalysis
      ? {
          ...localAnalysis,
          key: syncedAnalysis.key,
          keyScale: syncedAnalysis.keyScale,
          bpm: syncedAnalysis.bpm,
        }
      : localAnalysis;
  }, []);

  // Get current store values via getState() - these are snapshots, not reactive
  // For reactive updates, components should subscribe to useAnalysisStore directly
  const getStoreValues = useCallback(() => {
    const store = useAnalysisStore.getState();
    return {
      localAnalysis: store.localAnalysis,
      syncedAnalysis: store.syncedAnalysis,
      isAnalyzing: store.isAnalyzing,
      isReady: store.isWorkerReady,
      analysisSource: store.analysisSource,
      spectrumData: store.spectrumData,
      waveformData: store.waveformData,
      tunerEnabled: store.tunerEnabled,
    };
  }, []);

  return {
    // Getter functions for values (call these to get current state)
    getAnalysis: getEffectiveAnalysis,
    getStoreValues,
    // Stable action callbacks
    stopAnalysis,
    resetAnalysis,
    toggleTuner,
    switchSource,
  };
}
