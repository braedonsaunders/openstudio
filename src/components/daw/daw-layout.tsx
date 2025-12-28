'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useRoom } from '@/hooks/useRoom';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis';
import { useTrackPersistence } from '@/hooks/useTrackPersistence';
import { useTrackAudioSync } from '@/hooks/useTrackAudioSync';
import { useSessionTempoSync } from '@/hooks/use-session-tempo-sync';
import { useLoopPlayback } from '@/hooks/useLoopPlayback';
import { useRoomStore } from '@/stores/room-store';
import { useAudioStore } from '@/stores/audio-store';
import { useSongsStore } from '@/stores/songs-store';
import { useLoopTracksStore } from '@/stores/loop-tracks-store';
import { getLoopById } from '@/lib/audio/loop-library';
import { MenuBar } from './menu-bar';
import { TransportBar } from './transport-bar';
import { LeftPanel } from './left-panel';
import { CenterSplitView } from './center-split-view';
import { PanelDock } from './panel-dock';
import { ResizeHandle } from './resize-handle';
import { BottomDock } from './bottom-dock';
import { KeyboardShortcuts } from './keyboard-shortcuts';
import { UploadModal } from '../tracks/upload-modal';
import { YouTubeSearchModal } from '../tracks/youtube-search-modal';
import { YouTubePlayer, type YouTubePlayerRef } from '../youtube/youtube-player';
import { OutputSettingsModal } from '../settings/output-settings-modal';
import { MainViewSwitcher, type MainViewType } from './main-view-switcher';
import { MixerView } from './mixer-view';
import { AvatarWorldView } from './avatar-world-view';
import { useTheme } from '@/components/theme/ThemeProvider';
import { Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';
import type { BackingTrack, StemType } from '@/types';
import type { SongTrackReference } from '@/types/songs';
import type { LoopTrackState } from '@/types/loops';

interface DAWLayoutProps {
  roomId: string;
}

export type PanelType = 'users' | 'setlist' | 'mixer' | 'queue' | 'analysis' | 'chat' | 'ai'; // Note: 'queue' kept for backwards compat

export function DAWLayout({ roomId }: DAWLayoutProps) {
  // Theme
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // iOS Safari viewport fix - prevent scroll bounce and ensure full height
  useEffect(() => {
    document.documentElement.classList.add('daw-active');
    return () => {
      document.documentElement.classList.remove('daw-active');
    };
  }, []);

  // Panel state
  const [activePanel, setActivePanel] = useState<PanelType>('setlist');
  const [isPanelDockVisible, setIsPanelDockVisible] = useState(true);
  const [isBottomDockVisible, setIsBottomDockVisible] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Main view state (Timeline, Mixer, Avatar World)
  const [mainView, setMainView] = useState<MainViewType>('timeline');

  // Resizable panel state
  const [leftPanelWidth, setLeftPanelWidth] = useState(340); // Default width for track headers
  const [rightPanelWidth, setRightPanelWidth] = useState(320); // Default w-80 = 320px

  // Shared horizontal split position for left panel and timeline (1/3 - 2/3 split)
  const [sharedSplitPosition, setSharedSplitPosition] = useState(33);

  // Panel resize constraints
  const MIN_LEFT_WIDTH = 180;
  const MAX_LEFT_WIDTH = 400;
  const MIN_RIGHT_WIDTH = 280;
  const MAX_RIGHT_WIDTH = 500;

  // Resize handlers
  const handleLeftResize = useCallback((delta: number) => {
    setLeftPanelWidth((prev) => Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, prev + delta)));
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightPanelWidth((prev) => Math.min(MAX_RIGHT_WIDTH, Math.max(MIN_RIGHT_WIDTH, prev + delta)));
  }, []);

  // Modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isYouTubeModalOpen, setIsYouTubeModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Separation state
  const [isSeparating, setIsSeparating] = useState(false);
  const [separationProgress, setSeparationProgress] = useState(0);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [sessionStartTime] = useState(() => Date.now());

  // Room hooks
  const {
    users,
    currentUser,
    isMaster,
    currentTrack,
    play,
    pause,
    seek,
    addTrack,
    removeTrack,
    skipToNext,
    skipToPrevious,
    skipToTrack,
    sendMessage,
    muteUser,
    setUserVolume,
    leave,
    // Loop track controls
    playLoopTrack,
    stopLoopTrack,
  } = useRoom(roomId);

  const { toggleStem, setStemVolume, audioContext, backingTrackAnalyser, masterAnalyser, setOnTrackEnded, playBackingTrack, loadBackingTrack, pauseBackingTrack, initialize } = useAudioEngine();
  const { audioLevels, toggleStem: storeToggleStem, setStemVolume: storeStemVolume, queue } = useRoomStore();
  const { isMuted, setMuted, isPlaying, setPlaying, setCurrentTime, setDuration, backingTrackVolume, currentTime } = useAudioStore();

  // Song system - the primary track/playback system
  const { getCurrentSong } = useSongsStore();
  const { getTracksByRoom } = useLoopTracksStore();
  const currentSong = getCurrentSong();
  const loopTracks = getTracksByRoom(roomId);

  // Calculate loop duration from definition
  const getLoopDuration = useCallback((loopDef: ReturnType<typeof getLoopById>): number => {
    if (!loopDef) return 0;
    const beatsPerBar = loopDef.timeSignature[0];
    const totalBeats = loopDef.bars * beatsPerBar;
    return (totalBeats / loopDef.bpm) * 60;
  }, []);

  // Build unified track list for the current Song
  const songTracks = useMemo(() => {
    if (!currentSong) return [];

    return currentSong.tracks.map((trackRef: SongTrackReference) => {
      if (trackRef.type === 'loop') {
        const loopTrack = loopTracks.find((t: LoopTrackState) => t.id === trackRef.trackId);
        const loopDef = loopTrack ? getLoopById(loopTrack.loopId) : undefined;
        const loopDuration = getLoopDuration(loopDef);

        return {
          ref: trackRef,
          type: 'loop' as const,
          name: loopTrack?.name || loopDef?.name || 'Loop',
          duration: loopDuration,
          loopTrack,
          loopDef,
        };
      } else {
        const audioTrack = queue.tracks.find((t: BackingTrack) => t.id === trackRef.trackId);
        return {
          ref: trackRef,
          type: 'audio' as const,
          name: audioTrack?.name || 'Unknown Track',
          duration: audioTrack?.duration || 0,
          audioTrack,
        };
      }
    });
  }, [currentSong, loopTracks, queue.tracks, getLoopDuration]);

  // Calculate Song duration (max end time of all tracks)
  const songDuration = useMemo(() => {
    if (songTracks.length === 0) return 0;

    let maxDuration = 0;
    songTracks.forEach((track: { ref: SongTrackReference; duration: number }) => {
      const endTime = track.ref.startOffset + track.duration;
      maxDuration = Math.max(maxDuration, endTime);
    });

    return maxDuration;
  }, [songTracks]);

  // Memoize track type checks to avoid recalculating on every render
  const hasAudioTracks = useMemo(() => songTracks.some((t) => t.type === 'audio'), [songTracks]);
  const hasLoopTracks = useMemo(() => songTracks.some((t) => t.type === 'loop'), [songTracks]);

  // Check if Song has any tracks to play
  const hasSongTracks = songTracks.length > 0;

  // Update duration when Song tracks change
  useEffect(() => {
    if (hasSongTracks && songDuration > 0) {
      setDuration(songDuration);
    }
  }, [hasSongTracks, songDuration, setDuration]);

  // Track persistence - automatically saves track settings changes to database
  useTrackPersistence(roomId);

  // Sync track audio state (mute/solo/volume/effects) with audio engine
  useTrackAudioSync(currentUser?.id);

  // Sync session tempo from track/analyzer to loop scheduler
  useSessionTempoSync();

  // Loop playback - connects loop scheduler to sound engine
  // This is now BULLETPROOF - it automatically reacts to song changes during playback
  const { initialize: initLoopPlayback, startLoop, stopLoop: stopLoopAudio, syncPlaybackWithSong } = useLoopPlayback();

  // YouTube player ref
  const youtubePlayerRef = useRef<YouTubePlayerRef>(null);

  // Audio analysis - initialize with audio context and analysers from audio engine
  // Analysis modes:
  // - "Track": Analyzes backing track only (when master is playing)
  // - "Mic": Analyzes local microphone
  // - "Mix": Analyzes all audio (backing + all users' instruments)
  // Results are synced to all other room members
  const { resetAnalysis } = useAudioAnalysis({
    audioContext,
    backingTrackAnalyser,
    masterAnalyser,
    isPlaying,
    roomId,
    userId: currentUser?.id,
    isMaster,
  });

  // Track previous track ID to detect track changes
  const previousTrackIdRef = useRef<string | null>(null);

  // Reset analysis when track changes (clears old key/BPM data)
  useEffect(() => {
    if (currentTrack?.id !== previousTrackIdRef.current) {
      if (previousTrackIdRef.current !== null) {
        // Track changed - reset analysis buffers
        resetAnalysis();
        console.log('Track changed - analysis reset for new track');
      }
      previousTrackIdRef.current = currentTrack?.id || null;
    }
  }, [currentTrack?.id, resetAnalysis]);

  // Legacy YouTube check - no longer used, Song system handles all playback
  const isYouTubeTrack = false;

  // Handle track end for looping
  useEffect(() => {
    if (isYouTubeTrack) return; // YouTube handles its own looping

    setOnTrackEnded(() => {
      if (loopEnabled && currentTrack) {
        // Restart playback from the beginning
        setCurrentTime(0);
        playBackingTrack(Date.now(), 0);
      }
    });
  }, [loopEnabled, currentTrack, isYouTubeTrack, setOnTrackEnded, setCurrentTime, playBackingTrack]);

  // YouTube playback controls (defined before keyboard shortcuts that use them)
  const handleYouTubePlay = useCallback(() => {
    youtubePlayerRef.current?.play();
  }, []);

  const handleYouTubePause = useCallback(() => {
    youtubePlayerRef.current?.pause();
  }, []);

  const handleYouTubeSeek = useCallback((time: number) => {
    youtubePlayerRef.current?.seek(time);
  }, []);

  // Song playback controls - plays tracks from the Song system
  const handleSongPlay = useCallback(async () => {
    if (!isMaster || !currentSong || songTracks.length === 0) {
      console.log('Song play aborted:', { isMaster, hasSong: !!currentSong, trackCount: songTracks.length });
      return;
    }

    console.log('Playing Song:', currentSong.name, 'with', songTracks.length, 'tracks');

    // Set duration from Song
    if (songDuration > 0) {
      setDuration(songDuration);
    }

    // Initialize audio systems
    try {
      await initialize();
      await initLoopPlayback();
    } catch (err) {
      console.error('Failed to initialize audio for Song playback:', err);
      return;
    }

    const syncTime = Date.now() + 100; // 100ms in future for sync
    const playbackOffset = currentTime || 0;

    // Play all audio tracks in the Song
    for (const track of songTracks) {
      if (track.type === 'audio' && track.audioTrack) {
        // Skip if track hasn't started yet or already ended
        const trackEndTime = track.ref.startOffset + track.duration;
        if (playbackOffset >= trackEndTime || track.ref.muted) {
          continue;
        }

        // Calculate offset within this track
        const trackOffset = Math.max(0, playbackOffset - track.ref.startOffset);

        console.log('Loading audio track:', track.name, 'at offset:', trackOffset);
        const loadSuccess = await loadBackingTrack(track.audioTrack);
        if (loadSuccess) {
          playBackingTrack(syncTime, trackOffset);
        }
        break; // Only play one audio track at a time for now
      }
    }

    // Play all loop tracks in the Song - this sets state which triggers useLoopPlayback
    for (const track of songTracks) {
      if (track.type === 'loop' && track.loopTrack && !track.ref.muted) {
        // Check if this loop should be playing at current time
        const trackEndTime = track.ref.startOffset + track.duration;
        if (playbackOffset < trackEndTime) {
          console.log('Playing loop track:', track.name);
          // This sets isPlaying=true in the store, which useLoopPlayback listens to
          playLoopTrack(track.loopTrack.id, syncTime, 0);
        }
      }
    }

    setPlaying(true);
  }, [isMaster, currentSong, songTracks, songDuration, currentTime, initialize, initLoopPlayback, loadBackingTrack, playBackingTrack, playLoopTrack, setDuration, setPlaying]);

  const handleSongPause = useCallback(() => {
    console.log('Pausing Song playback');

    // Stop audio tracks
    pauseBackingTrack();

    // Stop all loop tracks
    for (const track of songTracks) {
      if (track.type === 'loop' && track.loopTrack) {
        stopLoopTrack(track.loopTrack.id);
      }
    }

    setPlaying(false);
  }, [songTracks, pauseBackingTrack, stopLoopTrack, setPlaying]);

  const handleSongSeek = useCallback(async (time: number) => {
    if (!isMaster) return;

    const wasPlaying = isPlaying;
    const seekTime = Math.max(0, time);

    console.log('Seeking Song to:', seekTime, 'wasPlaying:', wasPlaying);

    // Always stop first if playing
    if (wasPlaying) {
      // Stop audio tracks
      pauseBackingTrack();

      // Stop all loop tracks
      for (const track of songTracks) {
        if (track.type === 'loop' && track.loopTrack) {
          stopLoopTrack(track.loopTrack.id);
        }
      }
    }

    // Set the new time
    setCurrentTime(seekTime);

    // Trigger time tracking reset for loop-only playback
    if (wasPlaying && hasLoopTracks && !hasAudioTracks) {
      setSeekVersion((v) => v + 1);
    }

    // If was playing, restart at new position
    if (wasPlaying && songTracks.length > 0) {
      // Initialize audio systems
      try {
        await initialize();
        await initLoopPlayback();
      } catch (err) {
        console.error('Failed to initialize audio for seek:', err);
        setPlaying(false);
        return;
      }

      const syncTime = Date.now() + 50; // Small delay for sync

      // Play all audio tracks at new position
      for (const track of songTracks) {
        if (track.type === 'audio' && track.audioTrack) {
          const trackEndTime = track.ref.startOffset + track.duration;
          if (seekTime >= trackEndTime || track.ref.muted) continue;

          const trackOffset = Math.max(0, seekTime - track.ref.startOffset);
          console.log('Resuming audio track at:', trackOffset);

          const loadSuccess = await loadBackingTrack(track.audioTrack);
          if (loadSuccess) {
            playBackingTrack(syncTime, trackOffset);
          }
          break;
        }
      }

      // Play all loop tracks at new position
      for (const track of songTracks) {
        if (track.type === 'loop' && track.loopTrack && !track.ref.muted) {
          const trackEndTime = track.ref.startOffset + track.duration;
          if (seekTime < trackEndTime) {
            console.log('Resuming loop track:', track.name);
            playLoopTrack(track.loopTrack.id, syncTime, 0);
          }
        }
      }
    }
  }, [isMaster, isPlaying, songTracks, hasLoopTracks, hasAudioTracks, pauseBackingTrack, stopLoopTrack, setCurrentTime, initialize, initLoopPlayback, loadBackingTrack, playBackingTrack, playLoopTrack, setPlaying]);

  // Playback handlers - Song system only, no legacy fallback
  const handlePlay = useCallback(() => {
    handleSongPlay();
  }, [handleSongPlay]);

  const handlePause = useCallback(() => {
    handleSongPause();
  }, [handleSongPause]);

  const handleSeek = useCallback((time: number) => {
    handleSongSeek(time);
  }, [handleSongSeek]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (isMaster) {
            isPlaying ? handlePause() : handlePlay();
          }
          break;
        case 'ArrowLeft':
          if (isMaster && hasSongTracks) {
            const { currentTime } = useAudioStore.getState();
            const newTime = Math.max(0, currentTime - (e.shiftKey ? 30 : 5));
            handleSeek(newTime);
          }
          break;
        case 'ArrowRight':
          if (isMaster && hasSongTracks) {
            const { currentTime, duration } = useAudioStore.getState();
            const newTime = Math.min(duration, currentTime + (e.shiftKey ? 30 : 5));
            handleSeek(newTime);
          }
          break;
        case '[':
          if (isMaster) skipToPrevious();
          break;
        case ']':
          if (isMaster) skipToNext();
          break;
        case 'm':
        case 'M':
          if (!e.ctrlKey && !e.metaKey) {
            setMuted(!isMuted);
          }
          break;
        case 'a':
        case 'A':
          if (!e.ctrlKey && !e.metaKey) {
            setActivePanel('analysis');
          }
          break;
        case 'c':
        case 'C':
          // Don't trigger shortcut when Ctrl+C (copy) is pressed
          if (!e.ctrlKey && !e.metaKey) {
            setActivePanel('chat');
          }
          break;
        case '?':
          setShowShortcuts(true);
          break;
        case 'Escape':
          setShowShortcuts(false);
          break;
        case 'Tab':
          if (!e.shiftKey) {
            e.preventDefault();
            const panels: PanelType[] = ['users', 'analysis', 'chat', 'ai'];
            const currentIndex = panels.indexOf(activePanel);
            setActivePanel(panels[(currentIndex + 1) % panels.length]);
          }
          break;
        case '1':
          if (!e.ctrlKey && !e.metaKey) {
            setMainView('timeline');
          }
          break;
        case '2':
          if (!e.ctrlKey && !e.metaKey) {
            setMainView('mixer');
          }
          break;
        case '3':
          if (!e.ctrlKey && !e.metaKey) {
            setMainView('avatar-world');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaster, isPlaying, isMuted, activePanel, handlePlay, handlePause, handleSeek, setMuted, skipToNext, skipToPrevious, hasSongTracks, setMainView]);

  // Time update for loop-only playback (when no audio tracks are driving the time)
  const playStartTimeRef = useRef<number | null>(null);
  const playStartPositionRef = useRef<number>(0);
  const loopTimeAnimationRef = useRef<number | null>(null);
  const [seekVersion, setSeekVersion] = useState(0);

  useEffect(() => {
    // Only run for loop-only playback (no audio tracks to drive time)
    if (!isPlaying || !hasLoopTracks || hasAudioTracks) {
      playStartTimeRef.current = null;
      if (loopTimeAnimationRef.current) {
        cancelAnimationFrame(loopTimeAnimationRef.current);
        loopTimeAnimationRef.current = null;
      }
      return;
    }

    // Start time tracking for loop-only playback
    const startPosition = useAudioStore.getState().currentTime;
    playStartTimeRef.current = performance.now();
    playStartPositionRef.current = startPosition;

    const updateLoopTime = () => {
      if (playStartTimeRef.current === null) return;

      const elapsed = (performance.now() - playStartTimeRef.current) / 1000;
      const newTime = playStartPositionRef.current + elapsed;

      if (newTime < songDuration) {
        useAudioStore.getState().setCurrentTime(newTime);
        loopTimeAnimationRef.current = requestAnimationFrame(updateLoopTime);
      } else {
        // Song ended - loop back to start
        useAudioStore.getState().setCurrentTime(0);
        playStartTimeRef.current = performance.now();
        playStartPositionRef.current = 0;
        loopTimeAnimationRef.current = requestAnimationFrame(updateLoopTime);
      }
    };

    loopTimeAnimationRef.current = requestAnimationFrame(updateLoopTime);

    return () => {
      if (loopTimeAnimationRef.current) {
        cancelAnimationFrame(loopTimeAnimationRef.current);
        loopTimeAnimationRef.current = null;
      }
      playStartTimeRef.current = null;
    };
  }, [isPlaying, hasAudioTracks, hasLoopTracks, songDuration, seekVersion]);

  // Handler functions - BULLETPROOF track selection
  const handleTrackSelect = useCallback((track: BackingTrack) => {
    // Get ALL fresh state to avoid ANY stale closure issues
    const { queue, currentTrack: existingTrack, isMaster: freshIsMaster } = useRoomStore.getState();

    console.log('handleTrackSelect called:', {
      trackId: track.id,
      trackName: track.name,
      isMaster: freshIsMaster,
      currentTrackId: existingTrack?.id,
      queueLength: queue.tracks.length,
    });

    // Check master status with FRESH state
    if (!freshIsMaster) {
      console.log('handleTrackSelect: Not master, ignoring');
      return;
    }

    // Find the track by ID
    const trackIndex = queue.tracks.findIndex(t => t.id === track.id);

    if (trackIndex === -1) {
      console.warn('handleTrackSelect: Track not found in queue', track.id);
      return;
    }

    // Check if already on this track - NOTE: we still call skipToTrack even if same track
    // because the user clicked, so they probably want to do something
    // Let skipToTrack handle the "same track" case
    console.log('handleTrackSelect: Calling skipToTrack for index', trackIndex);
    skipToTrack(trackIndex);
  }, [skipToTrack]);

  const handleUpload = useCallback(async (uploadedTrack: { id: string; name: string; artist?: string; url: string; duration: number }) => {
    // UploadModal handles the actual upload to R2, we just add the track
    console.log('handleUpload received:', uploadedTrack);
    const track: BackingTrack = {
      id: uploadedTrack.id,
      name: uploadedTrack.name,
      artist: uploadedTrack.artist,
      duration: uploadedTrack.duration,
      url: uploadedTrack.url,
      uploadedBy: currentUser?.id || 'user',
      uploadedAt: new Date().toISOString(),
    };
    console.log('Adding track to queue:', track);
    await addTrack(track);
  }, [addTrack, currentUser]);

  const handleYouTubeSelect = useCallback(async (video: { id: string; title: string; channelTitle: string; duration?: string }) => {
    // Parse duration string to seconds (fallback for duration)
    const parseDuration = (d?: string): number => {
      if (!d) return 0;
      const parts = d.split(':').map(Number);
      if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
      if (parts.length === 2) return parts[0] * 60 + parts[1];
      return parts[0] || 0;
    };

    // Extract audio from YouTube using ytdl-core
    console.log('Extracting audio from YouTube:', video.id);

    try {
      const response = await fetch('/api/youtube/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.id,
          title: video.title,
          artist: video.channelTitle,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to extract audio');
      }

      const { track: extractedTrack } = await response.json();
      console.log('Audio extracted successfully:', extractedTrack);

      // Create track with the extracted audio URL (no youtubeId - it's a regular track now)
      const track: BackingTrack = {
        id: extractedTrack.id,
        name: extractedTrack.name,
        artist: extractedTrack.artist,
        duration: extractedTrack.duration || parseDuration(video.duration),
        url: extractedTrack.url,
        uploadedBy: 'youtube',
        uploadedAt: new Date().toISOString(),
        // Note: NOT setting youtubeId so it plays through audio engine
      };

      await addTrack(track);
      setIsYouTubeModalOpen(false);
    } catch (error) {
      console.error('Failed to extract YouTube audio:', error);
      // Show error to user - no iframe fallback as it can't be analyzed
      toast.error(`Failed to extract audio from YouTube: ${(error as Error).message}. Please try a different video or upload an audio file directly.`);
    }
  }, [addTrack]);

  // YouTube player event handlers
  const handleYouTubeReady = useCallback(() => {
    if (youtubePlayerRef.current) {
      const duration = youtubePlayerRef.current.getDuration();
      if (duration > 0) setDuration(duration);
    }
  }, [setDuration]);

  const handleYouTubeStateChange = useCallback((playing: boolean) => {
    setPlaying(playing);
  }, [setPlaying]);

  const handleYouTubeTimeUpdate = useCallback((time: number, dur: number) => {
    setCurrentTime(time);
    if (dur > 0) setDuration(dur);
  }, [setCurrentTime, setDuration]);

  const handleYouTubeDurationChange = useCallback((duration: number) => {
    if (duration > 0) setDuration(duration);
  }, [setDuration]);

  // Handle YouTube track end for looping
  const handleYouTubeEnded = useCallback(() => {
    if (loopEnabled && currentTrack?.youtubeId) {
      // Restart from beginning
      setCurrentTime(0);
      youtubePlayerRef.current?.seek(0);
      youtubePlayerRef.current?.play();
    }
  }, [loopEnabled, currentTrack, setCurrentTime]);

  // Navigate to AI panel for AI generation
  const handleOpenAIPanel = useCallback(() => {
    setActivePanel('ai');
  }, []);

  const handleSeparateTrack = useCallback(async () => {
    if (!currentTrack) return;

    setIsSeparating(true);
    setSeparationProgress(0);

    try {
      const response = await fetch('/api/sam/separate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId: currentTrack.id,
          trackUrl: currentTrack.url,
        }),
      });

      if (!response.ok) {
        throw new Error('Separation failed');
      }

      const { jobId } = await response.json();
      let complete = false;

      while (!complete) {
        await new Promise((r) => setTimeout(r, 1000));

        const statusRes = await fetch(`/api/sam/status/${jobId}`);
        const status = await statusRes.json();

        setSeparationProgress(status.progress);

        if (status.status === 'completed') {
          complete = true;
          useRoomStore.getState().setCurrentTrack({
            ...currentTrack,
            stems: status.stems,
          });
          useRoomStore.getState().setStemsAvailable(true);
        } else if (status.status === 'failed') {
          throw new Error(status.error);
        }
      }
    } catch (error) {
      console.error('Separation failed:', error);
    } finally {
      setIsSeparating(false);
    }
  }, [currentTrack]);

  const handleToggleStem = useCallback((stem: StemType, enabled: boolean) => {
    toggleStem(stem, enabled);
    storeToggleStem(stem as 'vocals' | 'drums' | 'bass' | 'other');
  }, [toggleStem, storeToggleStem]);

  const handleStemVolume = useCallback((stem: StemType, volume: number) => {
    setStemVolume(stem, volume);
    storeStemVolume(stem as 'vocals' | 'drums' | 'bass' | 'other', volume);
  }, [setStemVolume, storeStemVolume]);

  return (
    <div className={`h-dvh flex flex-col overflow-hidden transition-colors ${
      isDark
        ? 'daw-theme bg-[#0a0a0f] text-white'
        : 'bg-gray-50 text-gray-900'
    }`}>
      {/* Desktop Menu Bar */}
      <MenuBar
        onNewSession={() => {}}
        onExportSession={() => {}}
        onSaveToCloud={() => {}}
        onImportProject={() => {}}
        onPreferences={() => setIsSettingsModalOpen(true)}
        onTogglePanel={(panel) => setActivePanel(panel as PanelType)}
        onAddBackingTrack={() => setIsUploadModalOpen(true)}
        onUploadAudio={() => setIsUploadModalOpen(true)}
        onYouTubeImport={() => setIsYouTubeModalOpen(true)}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={() => {
          handlePause();
          handleSeek(0);
        }}
        onSeekStart={() => {
          handleSeek(0);
        }}
        onSeekEnd={() => {
          const { duration } = useAudioStore.getState();
          handleSeek(duration);
        }}
        onToggleLoop={() => setLoopEnabled(!loopEnabled)}
        onGenerateTrack={handleOpenAIPanel}
        onSeparateStems={handleSeparateTrack}
        onRoomSettings={() => setIsSettingsModalOpen(true)}
        onLeaveRoom={leave}
        onShowShortcuts={() => setShowShortcuts(true)}
        isPlaying={isPlaying}
        isMaster={isMaster}
        loopEnabled={loopEnabled}
        activePanel={activePanel}
        mainView={mainView}
        onViewChange={setMainView}
      />

      {/* Transport Bar - Fixed Top */}
      <TransportBar
        roomId={roomId}
        onPlay={handlePlay}
        onPause={handlePause}
        onSeek={handleSeek}
        onPrevious={skipToPrevious}
        onNext={skipToNext}
        onMuteToggle={() => setMuted(!isMuted)}
        onSettingsClick={() => setIsSettingsModalOpen(true)}
        onLeave={leave}
        loopEnabled={loopEnabled}
        onLoopToggle={() => setLoopEnabled(!loopEnabled)}
        activeView={mainView}
        onViewChange={setMainView}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel - Tracks (upper 1/3) + Live Channels (lower 2/3) */}
        <LeftPanel
          // Tracks (Queue) props
          onTrackSelect={handleTrackSelect}
          onTrackRemove={removeTrack}
          onUpload={() => setIsUploadModalOpen(true)}
          onYouTubeSearch={() => setIsYouTubeModalOpen(true)}
          onAIGenerate={handleOpenAIPanel}
          youtubePlayer={
            isYouTubeTrack && currentTrack?.youtubeId ? (
              <YouTubePlayer
                ref={youtubePlayerRef}
                videoId={currentTrack.youtubeId}
                onReady={handleYouTubeReady}
                onStateChange={handleYouTubeStateChange}
                onTimeUpdate={handleYouTubeTimeUpdate}
                onDurationChange={handleYouTubeDurationChange}
                onEnded={handleYouTubeEnded}
                volume={backingTrackVolume * 100}
              />
            ) : undefined
          }
          roomId={roomId}
          userId={currentUser?.id || ''}
          userName={currentUser?.name}
          // Live Channels props
          users={users}
          currentUser={currentUser}
          audioLevels={audioLevels}
          isMaster={isMaster}
          onMuteUser={muteUser}
          onVolumeChange={setUserVolume}
          onMuteSelf={() => setMuted(!isMuted)}
          isGlobalMuted={isMuted}
          width={leftPanelWidth}
          // Shared split position (synced with timeline)
          splitPosition={sharedSplitPosition}
          onSplitPositionChange={setSharedSplitPosition}
        />

        {/* Left Resize Handle */}
        <ResizeHandle position="left" onResize={handleLeftResize} />

        {/* Main View Area - Timeline/Mixer/Avatar World */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* View Content */}
          <div className="flex-1 overflow-hidden">
            {mainView === 'timeline' && (
              <CenterSplitView
                roomId={roomId}
                users={users}
                currentUser={currentUser}
                audioLevels={audioLevels}
                isMaster={isMaster}
                onSeek={handleSeek}
                onPlay={handlePlay}
                onStop={handlePause}
                sessionStartTime={sessionStartTime}
                isGlobalMuted={isMuted}
                // Shared split position (synced with left panel)
                splitPosition={sharedSplitPosition}
                onSplitPositionChange={setSharedSplitPosition}
                // View switcher props
                activeView={mainView}
                onViewChange={setMainView}
              />
            )}

            {mainView === 'mixer' && (
              <MixerView
                isMaster={isMaster}
                users={users}
                currentUser={currentUser}
                audioLevels={audioLevels}
                onUserVolumeChange={setUserVolume}
                onUserMuteChange={muteUser}
                activeView={mainView}
                onViewChange={setMainView}
              />
            )}

            {mainView === 'avatar-world' && (
              <AvatarWorldView
                users={users}
                currentUser={currentUser}
                audioLevels={audioLevels}
                activeView={mainView}
                onViewChange={setMainView}
              />
            )}
          </div>
        </div>

        {/* Right Resize Handle */}
        {isPanelDockVisible && (
          <ResizeHandle position="right" onResize={handleRightResize} />
        )}

        {/* Panel Dock - Right (Resizable) */}
        {isPanelDockVisible && (
          <PanelDock
            activePanel={activePanel}
            onPanelChange={setActivePanel}
            onClose={() => setIsPanelDockVisible(false)}
            // Mixer props (kept for AI panel)
            onToggleStem={handleToggleStem}
            onStemVolumeChange={handleStemVolume}
            onSeparateTrack={handleSeparateTrack}
            isSeparating={isSeparating}
            separationProgress={separationProgress}
            // Chat/Room props
            roomId={roomId}
            userId={currentUser?.id || ''}
            userName={currentUser?.name}
            onSendMessage={sendMessage}
            // Room users props
            users={users}
            currentUser={currentUser}
            isMaster={isMaster}
            audioLevels={audioLevels}
            onMuteUser={muteUser}
            onVolumeChange={setUserVolume}
            width={rightPanelWidth}
          />
        )}
      </div>

      {/* Bottom Dock (Collapsible) */}
      {isBottomDockVisible && (
        <BottomDock
          onClose={() => setIsBottomDockVisible(false)}
        />
      )}

      {/* Panel Toggle Button (when dock is hidden) */}
      {!isPanelDockVisible && (
        <button
          onClick={() => setIsPanelDockVisible(true)}
          className="fixed right-4 top-1/2 -translate-y-1/2 z-30 p-3 glass-panel rounded-xl hover:bg-white/10 transition-colors"
          aria-label="Show panel dock"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <KeyboardShortcuts onClose={() => setShowShortcuts(false)} />
      )}

      {/* Modals */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleUpload}
      />

      <YouTubeSearchModal
        isOpen={isYouTubeModalOpen}
        onClose={() => setIsYouTubeModalOpen(false)}
        onSelectTrack={handleYouTubeSelect}
        currentTrackId={currentTrack?.youtubeId}
      />

      <OutputSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

    </div>
  );
}
