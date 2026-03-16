'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useRoom, type SongPlayPayload, type SongPausePayload, type SongSeekPayload, type SongSelectPayload } from '@/hooks/useRoom';
import { useAudioEngine } from '@/hooks/useAudioEngine';
import { useAudioAnalysis } from '@/hooks/useAudioAnalysis';
import { useTrackPersistence } from '@/hooks/useTrackPersistence';
import { useTrackAudioSync } from '@/hooks/useTrackAudioSync';
import { useSessionTempoSync } from '@/hooks/use-session-tempo-sync';
import { useTempoRealtimeBroadcast } from '@/hooks/useTempoRealtimeBroadcast';
import { useStatsTracker } from '@/hooks/useStatsTracker';
import { useLoopPlayback } from '@/hooks/useLoopPlayback';
import { useRoomStore } from '@/stores/room-store';
import { useAudioStore } from '@/stores/audio-store';
import { useSongsStore } from '@/stores/songs-store';
import { useLoopTracksStore } from '@/stores/loop-tracks-store';
import { useLyriaStore } from '@/stores/lyria-store';
import { getLoopById } from '@/lib/audio/loop-library';
import { getCachedLoopById } from '@/hooks/use-loop-library';
import { useCustomLoopsStore } from '@/stores/custom-loops-store';
import { MenuBar } from './menu-bar';
import { TransportBar } from './transport-bar';
import { LeftPanel } from './left-panel';
import type { TracksPanelRef } from './tracks-panel';
import { CenterSplitView } from './center-split-view';
import { PanelDock } from './panel-dock';
import { ResizeHandle } from './resize-handle';
import { BottomDock } from './bottom-dock';
import { KeyboardShortcuts } from './keyboard-shortcuts';
import { UploadModal } from '../tracks/upload-modal';
import { YouTubeSearchModal } from '../tracks/youtube-search-modal';
import { OutputSettingsModal } from '../settings/output-settings-modal';
import { InviteMemberModal } from '@/components/room/invite-member-modal';
import type { MainViewType } from './main-view-switcher';
import { MixerView } from './mixer-view';
import { AvatarWorldView } from './avatar-world-view';
import { SharedCanvasView } from './shared-canvas-view';
import { NotationView } from './notation-view';
import { TeleprompterView } from './teleprompter-view';
import { useTheme } from '@/components/theme/ThemeProvider';
import { toast } from 'sonner';
import { authFetch, authFetchJson } from '@/lib/auth-fetch';
import type { BackingTrack, StemType, QualityPresetName, OpusEncodingSettings } from '@/types';
import type { SongTrackReference } from '@/types/songs';
import type { LoopTrackState } from '@/types/loops';
import { usePerformanceSyncStore } from '@/stores/performance-sync-store';
import { useAuthStore } from '@/stores/auth-store';
import type { RoomLayoutState } from '@/lib/supabase/realtime';

interface DAWLayoutProps {
  roomId: string;
  onLeaveRoom?: () => void;
  /** If true, user is in listen-only mode (no native bridge) */
  listenerMode?: boolean;
}

export type PanelType = 'users' | 'setlist' | 'mixer' | 'queue' | 'analysis' | 'chat' | 'ai' | 'permissions'; // Note: 'queue' kept for backwards compat

const VALID_PANELS: PanelType[] = ['users', 'setlist', 'mixer', 'queue', 'analysis', 'chat', 'ai', 'permissions'];
const VALID_MAIN_VIEWS: MainViewType[] = ['timeline', 'mixer', 'avatar-world', 'canvas', 'notation', 'teleprompter'];

export function DAWLayout({ roomId, onLeaveRoom, listenerMode = false }: DAWLayoutProps) {
  // Theme
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Auth state for user ID
  const { user } = useAuthStore();
  const userId = user?.id || 'anonymous';

  // Listener mode uses Cloudflare Calls in receive-only mode (handled by useRoom)
  // No special hook needed - listeners just don't publish audio tracks

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

  const normalizeLayoutState = useCallback((layoutState: Partial<RoomLayoutState>): RoomLayoutState => {
    const activePanelValue = VALID_PANELS.includes(layoutState.activePanel as PanelType)
      ? layoutState.activePanel as PanelType
      : activePanel;
    const mainViewValue = VALID_MAIN_VIEWS.includes(layoutState.mainView as MainViewType)
      ? layoutState.mainView as MainViewType
      : mainView;

    return {
      activePanel: activePanelValue,
      isPanelDockVisible: layoutState.isPanelDockVisible ?? isPanelDockVisible,
      isBottomDockVisible: layoutState.isBottomDockVisible ?? isBottomDockVisible,
      mainView: mainViewValue,
      leftPanelWidth: Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, layoutState.leftPanelWidth ?? leftPanelWidth)),
      rightPanelWidth: Math.min(MAX_RIGHT_WIDTH, Math.max(MIN_RIGHT_WIDTH, layoutState.rightPanelWidth ?? rightPanelWidth)),
      sharedSplitPosition: Math.min(80, Math.max(20, layoutState.sharedSplitPosition ?? sharedSplitPosition)),
      updatedBy: layoutState.updatedBy ?? userId,
      timestamp: layoutState.timestamp ?? Date.now(),
    };
  }, [
    activePanel,
    isBottomDockVisible,
    isPanelDockVisible,
    leftPanelWidth,
    mainView,
    rightPanelWidth,
    sharedSplitPosition,
    userId,
  ]);

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
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Saved room state
  const [isRoomSaved, setIsRoomSaved] = useState(false);
  const [canSaveRoom, setCanSaveRoom] = useState(false);

  // Check if room is saved on mount
  useEffect(() => {
    const checkSavedStatus = async () => {
      try {
        const response = await authFetch(`/api/user/saved-rooms/check?roomId=${roomId}`);
        if (response.ok) {
          const data = await response.json();
          setIsRoomSaved(data.isSaved);
          setCanSaveRoom(data.canSave && data.isOwner);
        }
      } catch (error) {
        console.error('Error checking saved room status:', error);
      }
    };
    checkSavedStatus();
  }, [roomId]);

  // Handle saving room
  const handleSaveRoom = useCallback(async () => {
    if (isRoomSaved || !canSaveRoom) return;

    try {
      const response = await authFetch('/api/user/saved-rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId }),
      });

      if (response.ok) {
        setIsRoomSaved(true);
        toast.success('Room saved! Find it in Settings > Saved Rooms');
      } else {
        const data = await response.json();
        if (data.error === 'limit_reached') {
          toast.error(`You've reached your limit of ${data.limit} saved rooms`);
        } else {
          toast.error(data.message || 'Failed to save room');
        }
      }
    } catch (error) {
      console.error('Error saving room:', error);
      toast.error('Failed to save room');
    }
  }, [roomId, isRoomSaved, canSaveRoom]);

  // Separation state
  const [, setIsSeparating] = useState(false);
  const [, setSeparationProgress] = useState(0);
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [sessionStartTime] = useState(() => Date.now());

  // Song sync handler refs - these are updated after audio engine is available
  const handleSongPlayRef = useRef<(payload: SongPlayPayload) => void>(() => {});
  const handleSongPauseRef = useRef<(payload: SongPausePayload) => void>(() => {});
  const handleSongSeekRef = useRef<(payload: SongSeekPayload) => void>(() => {});
  const handleSongSelectRef = useRef<(payload: SongSelectPayload) => void>(() => {});

  // Room hooks
  const {
    users,
    currentUser,
    isMaster,
    isConnected,
    addTrack,
    removeTrack,
    sendMessage,
    muteUser,
    setUserVolume,
    leave,
    // Loop track controls
    playLoopTrack,
    stopLoopTrack,
    // Quality/Latency settings
    setQualityPreset,
    setCustomEncodingSettings,
    // WebRTC
    getCloudflareRef,
    getRealtimeManager,
    // Real-time broadcast
    broadcastLayoutState,
    broadcastUserTrackUpdate,
    broadcastTempoUpdate,
    broadcastTempoSource,
    broadcastTimeSignature,
    // Song playback broadcasts
    broadcastSongPlay,
    broadcastSongPause,
    broadcastSongSeek,
    broadcastSongSelect,
    broadcastSongTrackStates,
    broadcastSongPosition,
    // Stem control
    broadcastStemToggle,
    broadcastStemVolume,
  } = useRoom(roomId, {
    // Song sync callbacks - use refs so we can update them after audio engine is available
    onSongPlay: (payload) => handleSongPlayRef.current(payload),
    onSongPause: (payload) => handleSongPauseRef.current(payload),
    onSongSeek: (payload) => handleSongSeekRef.current(payload),
    onSongSelect: (payload) => handleSongSelectRef.current(payload),
  });

  const { toggleStem, setStemVolume, audioContext, backingTrackAnalyser, masterAnalyser, setOnTrackEnded, playBackingTrack, initialize, addExternalAudioSource, removeExternalAudioSource, loadMultiTrack, playMultiTracks, stopMultiTracks, setMultiTrackVolume } = useAudioEngine();
  const { audioLevels, toggleStem: storeToggleStem, setStemVolume: storeStemVolume, queue, currentTrack } = useRoomStore();
  const { isMuted, setMuted, isPlaying, setPlaying, setCurrentTime, setDuration, currentTime } = useAudioStore();
  const syncedLayoutState = useRoomStore((state) => state.layoutState);
  const setSyncedLayoutState = useRoomStore((state) => state.setLayoutState);
  const remoteLayoutAppliedRef = useRef(false);
  const layoutBroadcastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!syncedLayoutState || syncedLayoutState.updatedBy === userId) {
      return;
    }

    const normalized = normalizeLayoutState(syncedLayoutState);
    remoteLayoutAppliedRef.current = true;
    setActivePanel(normalized.activePanel as PanelType);
    setIsPanelDockVisible(normalized.isPanelDockVisible);
    setIsBottomDockVisible(normalized.isBottomDockVisible);
    setMainView(normalized.mainView as MainViewType);
    setLeftPanelWidth(normalized.leftPanelWidth);
    setRightPanelWidth(normalized.rightPanelWidth);
    setSharedSplitPosition(normalized.sharedSplitPosition);
  }, [normalizeLayoutState, syncedLayoutState, userId]);

  useEffect(() => {
    const normalized = normalizeLayoutState({
      activePanel,
      isPanelDockVisible,
      isBottomDockVisible,
      mainView,
      leftPanelWidth,
      rightPanelWidth,
      sharedSplitPosition,
      updatedBy: userId,
      timestamp: Date.now(),
    });

    setSyncedLayoutState(normalized);

    if (!isConnected) {
      return undefined;
    }

    if (remoteLayoutAppliedRef.current) {
      remoteLayoutAppliedRef.current = false;
      return undefined;
    }

    if (layoutBroadcastTimeoutRef.current) {
      clearTimeout(layoutBroadcastTimeoutRef.current);
    }

    layoutBroadcastTimeoutRef.current = setTimeout(() => {
      broadcastLayoutState({
        activePanel: normalized.activePanel,
        isPanelDockVisible: normalized.isPanelDockVisible,
        isBottomDockVisible: normalized.isBottomDockVisible,
        mainView: normalized.mainView,
        leftPanelWidth: normalized.leftPanelWidth,
        rightPanelWidth: normalized.rightPanelWidth,
        sharedSplitPosition: normalized.sharedSplitPosition,
      });
    }, 80);

    return () => {
      if (layoutBroadcastTimeoutRef.current) {
        clearTimeout(layoutBroadcastTimeoutRef.current);
        layoutBroadcastTimeoutRef.current = null;
      }
    };
  }, [
    activePanel,
    broadcastLayoutState,
    isBottomDockVisible,
    isConnected,
    isPanelDockVisible,
    leftPanelWidth,
    mainView,
    normalizeLayoutState,
    rightPanelWidth,
    setSyncedLayoutState,
    sharedSplitPosition,
    userId,
  ]);

  // Stats tracking
  const { trackStemSeparation } = useStatsTracker();

  // Song system - the primary track/playback system
  const { getCurrentSong } = useSongsStore();
  const { getTracksByRoom } = useLoopTracksStore();
  const { getLoop: getCustomLoop } = useCustomLoopsStore();
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
        // Check: 1) cached library (database-fetched), 2) custom loops store, 3) hardcoded library
        let loopDef = loopTrack ? getCachedLoopById(loopTrack.loopId) : undefined;
        if (!loopDef && loopTrack) {
          loopDef = getCustomLoop(loopTrack.loopId);
        }
        const loopDuration = getLoopDuration(loopDef);

        return {
          ref: trackRef,
          type: 'loop' as const,
          name: loopTrack?.name || loopDef?.name || 'Loop',
          duration: loopDuration,
          loopTrack,
          loopDef,
        };
      } else if (trackRef.type === 'lyria') {
        // Lyria AI music track - infinite duration (plays continuously)
        return {
          ref: trackRef,
          type: 'lyria' as const,
          name: trackRef.lyriaConfig?.customPrompt || `AI Music (${trackRef.lyriaConfig?.styleId || 'jazz'})`,
          duration: Infinity, // Lyria is continuous, doesn't have a fixed duration
          lyriaConfig: trackRef.lyriaConfig,
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
  }, [currentSong, loopTracks, queue.tracks, getLoopDuration, getCustomLoop]);

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
  const hasLyriaTracks = useMemo(() => songTracks.some((t) => t.type === 'lyria'), [songTracks]);

  // Check if Song has any tracks to play
  const hasSongTracks = songTracks.length > 0;

  // Update duration when Song tracks change
  useEffect(() => {
    if (hasSongTracks && songDuration > 0) {
      setDuration(songDuration);
    }
  }, [hasSongTracks, songDuration, setDuration]);

  // Track persistence - automatically saves track settings changes to database
  // and broadcasts changes to other clients for real-time sync
  useTrackPersistence(roomId, currentUser?.id, broadcastUserTrackUpdate);

  // Sync track audio state (mute/solo/volume/effects) with audio engine
  useTrackAudioSync(currentUser?.id);

  // Sync session tempo from track/analyzer to loop scheduler
  useSessionTempoSync();

  // Broadcast tempo changes to other clients for real-time sync
  useTempoRealtimeBroadcast(broadcastTempoUpdate, broadcastTempoSource, broadcastTimeSignature);

  // Loop playback - connects loop scheduler to sound engine
  // This is now BULLETPROOF - it automatically reacts to song changes during playback
  const { initialize: initLoopPlayback } = useLoopPlayback();

  // ============================================================================
  // Song sync handlers - handle playback events from other users in the room
  // ============================================================================

  // Update handler refs with implementations that use audio engine functions
  // This effect runs after all hooks are set up
  useEffect(() => {
    // Handle song:play from another user (non-master receives this)
    handleSongPlayRef.current = async (payload) => {
      console.log('[Song Sync] Received play event:', payload);

      // Select the song if not already selected
      const songsStore = useSongsStore.getState();
      if (songsStore.currentSongId !== payload.songId) {
        songsStore.selectSong(payload.songId);
      }

      // Get the song data
      const song = songsStore.songs.get(payload.songId);
      if (!song) {
        console.warn('[Song Sync] Song not found:', payload.songId);
        return;
      }

      // Set duration
      const queueState = useRoomStore.getState().queue;
      const loopTracksState = useLoopTracksStore.getState().getTracksByRoom(roomId);
      const customLoopsStore = useCustomLoopsStore.getState();

      // Calculate song duration
      let maxDuration = 0;
      for (const trackRef of song.tracks) {
        let trackDuration = 0;
        if (trackRef.type === 'audio') {
          const audioTrack = queueState.tracks.find(t => t.id === trackRef.trackId);
          trackDuration = audioTrack?.duration || 0;
        } else if (trackRef.type === 'loop') {
          const loopTrack = loopTracksState.find(t => t.id === trackRef.trackId);
          if (loopTrack) {
            const loopDef = getCachedLoopById(loopTrack.loopId) || customLoopsStore.getLoop(loopTrack.loopId);
            if (loopDef) {
              const beatsPerBar = loopDef.timeSignature[0];
              const totalBeats = loopDef.bars * beatsPerBar;
              trackDuration = (totalBeats / loopDef.bpm) * 60;
            }
          }
        }
        const endTime = trackRef.startOffset + trackDuration;
        maxDuration = Math.max(maxDuration, endTime);
      }

      if (maxDuration > 0) {
        setDuration(maxDuration);
      }

      // Initialize audio
      try {
        await initialize();
        await initLoopPlayback();
      } catch (err) {
        console.error('[Song Sync] Failed to initialize audio:', err);
        return;
      }

      // Apply track states from payload
      const hasSoloTrack = payload.trackStates.some(ts => ts.solo);

      // Load and play audio tracks
      const audioTrackConfigs: Array<{ trackId: string; offset: number; volume: number; muted: boolean }> = [];

      for (const trackRef of song.tracks) {
        const trackState = payload.trackStates.find(ts => ts.trackRefId === trackRef.id);
        const isEffectivelyMuted = trackState?.muted || (hasSoloTrack && !trackState?.solo);
        const volume = trackState?.volume ?? 1;

        if (trackRef.type === 'audio') {
          const audioTrack = queueState.tracks.find(t => t.id === trackRef.trackId);
          if (audioTrack) {
            const trackOffset = Math.max(0, payload.currentTime - trackRef.startOffset);
            const loadSuccess = await loadMultiTrack(audioTrack.id, audioTrack.url);
            if (loadSuccess) {
              audioTrackConfigs.push({
                trackId: audioTrack.id,
                offset: trackOffset,
                volume,
                muted: isEffectivelyMuted,
              });
            }
          }
        } else if (trackRef.type === 'loop') {
          const loopTrack = loopTracksState.find(t => t.id === trackRef.trackId);
          if (loopTrack) {
            playLoopTrack(loopTrack.id, payload.syncTime, 0);
          }
        } else if (trackRef.type === 'lyria' && trackRef.lyriaConfig) {
          // Handle Lyria AI music tracks - connect and play via Lyria store
          console.log('[Song Sync] Playing Lyria track:', trackRef.lyriaConfig?.customPrompt || 'AI Music');

          useLyriaStore.getState().setActiveConfig(trackRef.lyriaConfig, payload.songId, trackRef.id);

          const initialState = useLyriaStore.getState().sessionState;
          if (initialState === 'disconnected' || initialState === 'error') {
            try {
              await useLyriaStore.getState().connect();
            } catch (err) {
              console.error('[Song Sync] Failed to connect Lyria:', err);
              // Continue without Lyria - don't block other tracks
            }
          }

          const currentState = useLyriaStore.getState().sessionState;
          if (currentState === 'connected' || currentState === 'paused') {
            await useLyriaStore.getState().play(trackRef.lyriaConfig);
          }
          // Only one Lyria track per song - no break needed since we continue iterating
        }
      }

      // Play all audio tracks
      if (audioTrackConfigs.length > 0) {
        playMultiTracks(payload.syncTime, audioTrackConfigs);
      }

      // Set current time and playing state
      setCurrentTime(payload.currentTime);
      setPlaying(true);
    };

    // Handle song:pause from another user
    handleSongPauseRef.current = (payload) => {
      console.log('[Song Sync] Received pause event:', payload);

      // Stop all audio tracks
      stopMultiTracks();

      // Stop all loop tracks
      const loopTracksState = useLoopTracksStore.getState().getTracksByRoom(roomId);
      for (const loopTrack of loopTracksState) {
        stopLoopTrack(loopTrack.id);
      }

      // Update state
      setCurrentTime(payload.currentTime);
      setPlaying(false);
    };

    // Handle song:seek from another user
    handleSongSeekRef.current = async (payload) => {
      console.log('[Song Sync] Received seek event:', payload);

      const wasPlaying = useAudioStore.getState().isPlaying;

      // Stop current playback
      stopMultiTracks();
      const loopTracksState = useLoopTracksStore.getState().getTracksByRoom(roomId);
      for (const loopTrack of loopTracksState) {
        stopLoopTrack(loopTrack.id);
      }

      // Set the new time
      setCurrentTime(payload.seekTime);

      // If was playing, restart at new position
      if (wasPlaying) {
        // Get the current song
        const songsStore = useSongsStore.getState();
        const song = songsStore.songs.get(payload.songId);
        if (!song) return;

        // Initialize audio
        try {
          await initialize();
          await initLoopPlayback();
        } catch (err) {
          console.error('[Song Sync] Failed to initialize audio:', err);
          return;
        }

        const queueState = useRoomStore.getState().queue;
        const audioTrackConfigs: Array<{ trackId: string; offset: number; volume: number; muted: boolean }> = [];

        for (const trackRef of song.tracks) {
          if (trackRef.type === 'audio') {
            const audioTrack = queueState.tracks.find(t => t.id === trackRef.trackId);
            if (audioTrack) {
              const trackOffset = Math.max(0, payload.seekTime - trackRef.startOffset);
              const loadSuccess = await loadMultiTrack(audioTrack.id, audioTrack.url);
              if (loadSuccess) {
                audioTrackConfigs.push({
                  trackId: audioTrack.id,
                  offset: trackOffset,
                  volume: trackRef.volume ?? 1,
                  muted: trackRef.muted ?? false,
                });
              }
            }
          } else if (trackRef.type === 'loop') {
            const loopTrack = loopTracksState.find(t => t.id === trackRef.trackId);
            if (loopTrack) {
              playLoopTrack(loopTrack.id, payload.syncTime, 0);
            }
          }
        }

        if (audioTrackConfigs.length > 0) {
          playMultiTracks(payload.syncTime, audioTrackConfigs);
        }
      }
    };

    // Handle song:select from another user
    handleSongSelectRef.current = (payload) => {
      console.log('[Song Sync] Received select event:', payload);
      useSongsStore.getState().selectSong(payload.songId);
    };
  }, [roomId, initialize, initLoopPlayback, loadMultiTrack, playMultiTracks, stopMultiTracks, playLoopTrack, stopLoopTrack, setCurrentTime, setDuration, setPlaying]);

  // Song position sync interval ref (WS6: periodic position broadcast)
  const songPositionSyncRef = useRef<NodeJS.Timeout | null>(null);

  // Pending auto-play ref for song skip (triggers play after React state settles)
  const pendingAutoPlayRef = useRef(false);

  // Left panel ref (for focusing song input)
  const leftPanelRef = useRef<TracksPanelRef>(null);

  // Handler for creating a new song from timeline
  const handleCreateSong = useCallback(() => {
    leftPanelRef.current?.focusNewSongInput();
  }, []);

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

  // Handle track end for looping
  useEffect(() => {
    setOnTrackEnded(() => {
      if (loopEnabled && currentTrack) {
        // Restart playback from the beginning
        setCurrentTime(0);
        playBackingTrack(Date.now(), 0);
      }
    });
  }, [loopEnabled, currentTrack, setOnTrackEnded, setCurrentTime, playBackingTrack]);

  // ==========================================================================
  // Lyria Integration - AI Live Music
  // ==========================================================================

  // Initialize Lyria store and set up audio routing callbacks
  useEffect(() => {
    const lyriaStore = useLyriaStore.getState();

    // Initialize the Lyria session (creates session but doesn't connect)
    lyriaStore.initialize();

    // Set up audio callbacks to route Lyria to master mixer
    lyriaStore.setAudioCallbacks(
      // onConnected - route Lyria audio to master mixer
      async (stream: MediaStream) => {
        console.log('[DAWLayout] Lyria connected, routing to master mixer');
        await addExternalAudioSource('lyria', stream, lyriaStore.volume);

        // Also share via WebRTC if available
        const cloudflare = getCloudflareRef?.();
        if (cloudflare) {
          cloudflare.addTrack(stream, 'lyria', 'AI Live Music', true)
            .then((trackId) => {
              console.log('[DAWLayout] Lyria audio shared via WebRTC:', trackId);
            })
            .catch((err) => {
              console.warn('[DAWLayout] Failed to share Lyria via WebRTC:', err);
            });
        }
      },
      // onDisconnected - remove Lyria from master mixer
      () => {
        console.log('[DAWLayout] Lyria disconnected, removing from master mixer');
        removeExternalAudioSource('lyria');
      }
    );

    return () => {
      // Cleanup on unmount
      useLyriaStore.getState().dispose();
    };
  }, [addExternalAudioSource, removeExternalAudioSource, getCloudflareRef]);

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

    // Check if ANY track has solo enabled (across all track types)
    const hasSoloTrack = songTracks.some(t => t.ref.solo);

    // Load and prepare all audio tracks for multi-track playback
    const audioTrackConfigs: Array<{ trackId: string; offset: number; volume: number; muted: boolean }> = [];

    for (const track of songTracks) {
      if (track.type === 'audio' && track.audioTrack) {
        // Skip if track hasn't started yet or already ended
        const trackEndTime = track.ref.startOffset + track.duration;
        if (playbackOffset >= trackEndTime) {
          continue;
        }

        // Check if track should be audible (mute + solo logic)
        const isEffectivelyMuted = track.ref.muted || (hasSoloTrack && !track.ref.solo);

        // Calculate offset within this track
        const trackOffset = Math.max(0, playbackOffset - track.ref.startOffset);

        console.log('Loading audio track:', track.name, 'at offset:', trackOffset, 'muted:', isEffectivelyMuted);
        const loadSuccess = await loadMultiTrack(track.audioTrack.id, track.audioTrack.url);
        if (loadSuccess) {
          audioTrackConfigs.push({
            trackId: track.audioTrack.id,
            offset: trackOffset,
            volume: track.ref.volume ?? 1,
            muted: isEffectivelyMuted,
          });
        }
      }
    }

    // Play all audio tracks simultaneously
    if (audioTrackConfigs.length > 0) {
      console.log(`Playing ${audioTrackConfigs.length} audio tracks simultaneously`);
      playMultiTracks(syncTime, audioTrackConfigs);
    }

    // Play all loop tracks in the Song - this sets state which triggers useLoopPlayback
    // Note: useLoopPlayback handles its own mute/solo logic using hasSoloTrack from all song.tracks
    for (const track of songTracks) {
      if (track.type === 'loop' && track.loopTrack) {
        // Check if this loop should be playing at current time
        const trackEndTime = track.ref.startOffset + track.duration;
        if (playbackOffset < trackEndTime) {
          console.log('Playing loop track:', track.name);
          // This sets isPlaying=true in the store, which useLoopPlayback listens to
          playLoopTrack(track.loopTrack.id, syncTime, 0);
        }
      }
    }

    // Handle Lyria tracks - connect and play via Lyria store
    for (const track of songTracks) {
      if (track.type === 'lyria' && track.ref.lyriaConfig) {
        console.log('[DAWLayout] Playing Lyria track:', track.name);

        // Set the active config from the track
        useLyriaStore.getState().setActiveConfig(track.ref.lyriaConfig, currentSong.id, track.ref.id);

        // Only connect if not already connected
        const initialState = useLyriaStore.getState().sessionState;
        if (initialState === 'disconnected' || initialState === 'error') {
          try {
            await useLyriaStore.getState().connect();
          } catch (err) {
            console.error('[DAWLayout] Failed to connect Lyria:', err);
            break;
          }
        }

        // Get fresh state after connect - Zustand snapshots are stale after async operations
        const currentState = useLyriaStore.getState().sessionState;

        // Play (or resume) if connected - must await to ensure AudioContext is resumed
        if (currentState === 'connected' || currentState === 'paused') {
          await useLyriaStore.getState().play(track.ref.lyriaConfig);
        }
        break; // Only one Lyria track per song
      }
    }

    setPlaying(true);

    // Broadcast to other users in the room
    const trackStates = songTracks.map(t => ({
      trackRefId: t.ref.id,
      muted: t.ref.muted ?? false,
      solo: t.ref.solo ?? false,
      volume: t.ref.volume ?? 1,
    }));
    broadcastSongPlay(currentSong.id, playbackOffset, syncTime, trackStates);

    // WS6: Start periodic Song position sync (every 5 seconds)
    if (songPositionSyncRef.current) clearInterval(songPositionSyncRef.current);
    songPositionSyncRef.current = setInterval(() => {
      const audioState = useAudioStore.getState();
      const songsStore = useSongsStore.getState();
      const roomState = useRoomStore.getState();
      if (roomState.isMaster && audioState.isPlaying && songsStore.currentSongId) {
        broadcastSongPosition(songsStore.currentSongId, audioState.currentTime || 0, Date.now(), true);
      }
    }, 5000);
  }, [isMaster, currentSong, songTracks, songDuration, currentTime, initialize, initLoopPlayback, loadMultiTrack, playMultiTracks, playLoopTrack, setDuration, setPlaying, broadcastSongPlay, broadcastSongPosition]);

  const handleSongPause = useCallback(() => {
    console.log('Pausing Song playback');

    // WS6: Stop periodic Song position sync
    if (songPositionSyncRef.current) {
      clearInterval(songPositionSyncRef.current);
      songPositionSyncRef.current = null;
    }

    // Stop all audio tracks
    stopMultiTracks();

    // Stop all loop tracks
    for (const track of songTracks) {
      if (track.type === 'loop' && track.loopTrack) {
        stopLoopTrack(track.loopTrack.id);
      }
    }

    // Pause Lyria if playing
    const lyriaStore = useLyriaStore.getState();
    if (lyriaStore.sessionState === 'playing') {
      lyriaStore.pause();
    }

    setPlaying(false);

    // Broadcast to other users in the room
    const song = useSongsStore.getState().getCurrentSong();
    if (song) {
      const pauseTime = useAudioStore.getState().currentTime;
      broadcastSongPause(song.id, pauseTime);
    }
  }, [songTracks, stopMultiTracks, stopLoopTrack, setPlaying, broadcastSongPause]);

  const handleSongSeek = useCallback(async (time: number) => {
    if (!isMaster) return;

    const wasPlaying = isPlaying;
    const seekTime = Math.max(0, time);

    console.log('Seeking Song to:', seekTime, 'wasPlaying:', wasPlaying);

    // Always stop first if playing
    if (wasPlaying) {
      // Stop all audio tracks
      stopMultiTracks();

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

    // Calculate sync time for broadcast
    const syncTime = Date.now() + 50;

    // Broadcast seek to other users
    const song = useSongsStore.getState().getCurrentSong();
    if (song) {
      broadcastSongSeek(song.id, seekTime, syncTime);
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

      // Check if ANY track has solo enabled (across all track types)
      const hasSoloTrack = songTracks.some(t => t.ref.solo);

      // Load and play all audio tracks at new position
      const audioTrackConfigs: Array<{ trackId: string; offset: number; volume: number; muted: boolean }> = [];

      for (const track of songTracks) {
        if (track.type === 'audio' && track.audioTrack) {
          const trackEndTime = track.ref.startOffset + track.duration;
          if (seekTime >= trackEndTime) continue;

          // Check if track should be audible (mute + solo logic)
          const isEffectivelyMuted = track.ref.muted || (hasSoloTrack && !track.ref.solo);

          const trackOffset = Math.max(0, seekTime - track.ref.startOffset);
          console.log('Resuming audio track at:', trackOffset, 'muted:', isEffectivelyMuted);

          const loadSuccess = await loadMultiTrack(track.audioTrack.id, track.audioTrack.url);
          if (loadSuccess) {
            audioTrackConfigs.push({
              trackId: track.audioTrack.id,
              offset: trackOffset,
              volume: track.ref.volume ?? 1,
              muted: isEffectivelyMuted,
            });
          }
        }
      }

      // Play all audio tracks simultaneously
      if (audioTrackConfigs.length > 0) {
        playMultiTracks(syncTime, audioTrackConfigs);
      }

      // Play all loop tracks at new position
      // Note: useLoopPlayback handles its own mute/solo logic using hasSoloTrack from all song.tracks
      for (const track of songTracks) {
        if (track.type === 'loop' && track.loopTrack) {
          const trackEndTime = track.ref.startOffset + track.duration;
          if (seekTime < trackEndTime) {
            console.log('Resuming loop track:', track.name);
            playLoopTrack(track.loopTrack.id, syncTime, 0);
          }
        }
      }
    }
  }, [isMaster, isPlaying, songTracks, hasLoopTracks, hasAudioTracks, stopMultiTracks, stopLoopTrack, setCurrentTime, initialize, initLoopPlayback, loadMultiTrack, playMultiTracks, playLoopTrack, setPlaying, broadcastSongSeek]);

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

  // Song-based skip functions - navigate between songs in the songs list
  const handleSkipToNextSong = useCallback(() => {
    const songsStore = useSongsStore.getState();
    const songs = Array.from(songsStore.songs.values());
    if (songs.length <= 1) return;

    const currentIndex = songs.findIndex(s => s.id === songsStore.currentSongId);
    const nextIndex = currentIndex < songs.length - 1 ? currentIndex + 1 : 0;
    const nextSong = songs[nextIndex];
    if (!nextSong) return;

    const wasPlaying = isPlaying;

    if (wasPlaying) {
      handleSongPause();
    }

    // Select the new song and broadcast
    songsStore.selectSong(nextSong.id);
    broadcastSongSelect(nextSong.id);

    // Reset position to start of new song
    setCurrentTime(0);

    // If was playing, schedule auto-play after React processes the song change
    if (wasPlaying) {
      pendingAutoPlayRef.current = true;
    }
  }, [isPlaying, handleSongPause, broadcastSongSelect, setCurrentTime]);

  const handleSkipToPreviousSong = useCallback(() => {
    const songsStore = useSongsStore.getState();
    const songs = Array.from(songsStore.songs.values());
    if (songs.length <= 1) return;

    const currentIndex = songs.findIndex(s => s.id === songsStore.currentSongId);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : songs.length - 1;
    const prevSong = songs[prevIndex];
    if (!prevSong) return;

    const wasPlaying = isPlaying;

    if (wasPlaying) {
      handleSongPause();
    }

    // Select the new song and broadcast
    songsStore.selectSong(prevSong.id);
    broadcastSongSelect(prevSong.id);

    // Reset position to start of new song
    setCurrentTime(0);

    // If was playing, schedule auto-play after React processes the song change
    if (wasPlaying) {
      pendingAutoPlayRef.current = true;
    }
  }, [isPlaying, handleSongPause, broadcastSongSelect, setCurrentTime]);

  // Auto-play effect: when song changes and pendingAutoPlay is set, trigger play
  useEffect(() => {
    if (pendingAutoPlayRef.current && currentSong) {
      pendingAutoPlayRef.current = false;
      handleSongPlay();
    }
  }, [currentSong, handleSongPlay]);

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
            if (isPlaying) {
              handlePause();
            } else {
              handlePlay();
            }
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
          if (isMaster) handleSkipToPreviousSong();
          break;
        case ']':
          if (isMaster) handleSkipToNextSong();
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
        case '4':
          if (!e.ctrlKey && !e.metaKey) {
            setMainView('canvas');
          }
          break;
        case '5':
          if (!e.ctrlKey && !e.metaKey) {
            setMainView('notation');
          }
          break;
        case '6':
          if (!e.ctrlKey && !e.metaKey) {
            setMainView('teleprompter');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaster, isPlaying, isMuted, activePanel, handlePlay, handlePause, handleSeek, setMuted, handleSkipToNextSong, handleSkipToPreviousSong, hasSongTracks, setMainView]);

  // Real-time sync of audio track mute/solo state with multi-track volume
  // This allows mute/solo buttons to work during playback
  // Also broadcasts changes to other room members when master adjusts mix
  const lastBroadcastTrackStatesRef = useRef<string>('');
  useEffect(() => {
    if (!isPlaying || !hasAudioTracks) return;

    // Check if ANY track has solo enabled (across all track types)
    const hasSoloTrack = songTracks.some(t => t.ref.solo);

    // Update volume for each audio track
    for (const track of songTracks) {
      if (track.type === 'audio' && track.audioTrack) {
        const isEffectivelyMuted = track.ref.muted || (hasSoloTrack && !track.ref.solo);
        setMultiTrackVolume(track.audioTrack.id, track.ref.volume ?? 1, isEffectivelyMuted);
      }
    }

    // Broadcast track state changes to other room members
    if (isMaster && currentSong) {
      const trackStates = songTracks.map(t => ({
        trackRefId: t.ref.id,
        muted: t.ref.muted ?? false,
        solo: t.ref.solo ?? false,
        volume: t.ref.volume ?? 1,
      }));
      const stateKey = JSON.stringify(trackStates);
      if (stateKey !== lastBroadcastTrackStatesRef.current) {
        lastBroadcastTrackStatesRef.current = stateKey;
        broadcastSongTrackStates(currentSong.id, trackStates);
      }
    }
  }, [isPlaying, hasAudioTracks, songTracks, setMultiTrackVolume, isMaster, currentSong, broadcastSongTrackStates]);

  // Time update for loop-only playback (when no audio tracks are driving the time)
  const playStartTimeRef = useRef<number | null>(null);
  const playStartPositionRef = useRef<number>(0);
  const loopTimeAnimationRef = useRef<number | null>(null);
  const [seekVersion, setSeekVersion] = useState(0);

  useEffect(() => {
    // Run for loop-only or lyria-only playback (no audio tracks to drive time)
    const needsTimeTracking = (hasLoopTracks || hasLyriaTracks) && !hasAudioTracks;
    if (!isPlaying || !needsTimeTracking) {
      playStartTimeRef.current = null;
      if (loopTimeAnimationRef.current) {
        cancelAnimationFrame(loopTimeAnimationRef.current);
        loopTimeAnimationRef.current = null;
      }
      return;
    }

    // Start time tracking
    const startPosition = useAudioStore.getState().currentTime;
    playStartTimeRef.current = performance.now();
    playStartPositionRef.current = startPosition;

    const updateTime = () => {
      if (playStartTimeRef.current === null) return;

      const elapsed = (performance.now() - playStartTimeRef.current) / 1000;
      const newTime = playStartPositionRef.current + elapsed;

      // For Lyria tracks, never reset - they're infinite
      if (hasLyriaTracks) {
        useAudioStore.getState().setCurrentTime(newTime);
        loopTimeAnimationRef.current = requestAnimationFrame(updateTime);
      } else if (newTime < songDuration) {
        useAudioStore.getState().setCurrentTime(newTime);
        loopTimeAnimationRef.current = requestAnimationFrame(updateTime);
      } else {
        // Song ended - loop back to start (only for non-Lyria)
        useAudioStore.getState().setCurrentTime(0);
        playStartTimeRef.current = performance.now();
        playStartPositionRef.current = 0;
        loopTimeAnimationRef.current = requestAnimationFrame(updateTime);
      }
    };

    loopTimeAnimationRef.current = requestAnimationFrame(updateTime);

    return () => {
      if (loopTimeAnimationRef.current) {
        cancelAnimationFrame(loopTimeAnimationRef.current);
        loopTimeAnimationRef.current = null;
      }
      playStartTimeRef.current = null;
    };
  }, [isPlaying, hasAudioTracks, hasLoopTracks, hasLyriaTracks, songDuration, seekVersion]);

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
      const response = await authFetchJson('/api/youtube/extract', 'POST', {
        videoId: video.id,
        title: video.title,
        artist: video.channelTitle,
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

  // Navigate to AI panel for AI generation
  const handleOpenAIPanel = useCallback(() => {
    setActivePanel('ai');
  }, []);

  const handleSeparateTrack = useCallback(async () => {
    if (!currentTrack) return;

    setIsSeparating(true);
    setSeparationProgress(0);

    try {
      const response = await fetch('/api/stems/separate', {
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

        const statusRes = await fetch(`/api/stems/status/${jobId}`);
        const status = await statusRes.json();

        setSeparationProgress(status.progress);

        if (status.status === 'completed') {
          complete = true;
          useRoomStore.getState().setCurrentTrack({
            ...currentTrack,
            stems: status.stems,
          });
          useRoomStore.getState().setStemsAvailable(true);
          // Track stem separation for stats
          trackStemSeparation();
        } else if (status.status === 'failed') {
          throw new Error(status.error);
        }
      }
    } catch (error) {
      console.error('Separation failed:', error);
    } finally {
      setIsSeparating(false);
    }
  }, [currentTrack, trackStemSeparation]);

  const handleToggleStem = useCallback((stem: StemType, enabled: boolean) => {
    toggleStem(stem, enabled);
    storeToggleStem(stem as 'vocals' | 'drums' | 'bass' | 'other');
    // Broadcast stem toggle to other room members
    if (currentTrack?.id) {
      broadcastStemToggle(currentTrack.id, stem, enabled);
    }
  }, [toggleStem, storeToggleStem, broadcastStemToggle, currentTrack]);

  const handleStemVolume = useCallback((stem: StemType, volume: number) => {
    setStemVolume(stem, volume);
    storeStemVolume(stem as 'vocals' | 'drums' | 'bass' | 'other', volume);
    // Broadcast stem volume to other room members
    if (currentTrack?.id) {
      broadcastStemVolume(currentTrack.id, stem, volume);
    }
  }, [setStemVolume, storeStemVolume, broadcastStemVolume, currentTrack]);

  // Quality/Latency settings handlers
  const handlePresetChange = useCallback((preset: QualityPresetName) => {
    setQualityPreset(preset);
  }, [setQualityPreset]);

  const handleCustomSettingsChange = useCallback((settings: Partial<OpusEncodingSettings>) => {
    setCustomEncodingSettings(settings);
  }, [setCustomEncodingSettings]);

  const handleJitterModeChange = useCallback((mode: 'live-jamming' | 'balanced' | 'stable') => {
    const perfStore = usePerformanceSyncStore.getState();
    if (perfStore.localPerformance) {
      perfStore.setLocalPerformance({
        ...perfStore.localPerformance,
        jitterBufferMode: mode,
      });
    }
  }, []);

  const handleLowLatencyModeChange = useCallback((enabled: boolean) => {
    // Switch to ultra-low-latency or balanced preset
    setQualityPreset(enabled ? 'ultra-low-latency' : 'balanced');
  }, [setQualityPreset]);

  const handleAcceptOptimization = useCallback((type: string) => {
    const perfStore = usePerformanceSyncStore.getState();
    const pending = perfStore.optimizationState.pendingOptimizations.find(o => o.type === type);
    if (pending) {
      perfStore.applyOptimization(pending);
    }
  }, []);

  const handleDismissOptimization = useCallback((type: string) => {
    usePerformanceSyncStore.getState().removePendingOptimization(type as 'reduce_buffer' | 'increase_buffer' | 'enable_fec' | 'disable_fec' | 'reduce_bitrate' | 'increase_bitrate' | 'bypass_effects' | 'enable_effects' | 'switch_preset');
  }, []);

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
        onInviteUsers={() => setIsInviteModalOpen(true)}
        onRoomSettings={() => setIsSettingsModalOpen(true)}
        onLeaveRoom={onLeaveRoom || leave}
        onSaveRoom={handleSaveRoom}
        isRoomSaved={isRoomSaved}
        canSaveRoom={canSaveRoom}
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
        onPrevious={handleSkipToPreviousSong}
        onNext={handleSkipToNextSong}
        onMuteToggle={() => setMuted(!isMuted)}
        onSettingsClick={() => setIsSettingsModalOpen(true)}
        onLeave={onLeaveRoom || leave}
        loopEnabled={loopEnabled}
        onLoopToggle={() => setLoopEnabled(!loopEnabled)}
        audioContext={audioContext}
        activeView={mainView}
        onViewChange={setMainView}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel - Tracks (upper 1/3) + Live Channels (lower 2/3) */}
        <LeftPanel
          ref={leftPanelRef}
          listenerMode={listenerMode}
          // Tracks (Queue) props
          onTrackSelect={() => {}}
          onTrackRemove={removeTrack}
          onUpload={() => setIsUploadModalOpen(true)}
          onYouTubeSearch={() => setIsYouTubeModalOpen(true)}
          onAIGenerate={handleOpenAIPanel}
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
                // Song creation callback
                onCreateSong={handleCreateSong}
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
                realtimeManager={getRealtimeManager() || undefined}
              />
            )}

            {mainView === 'canvas' && (
              <SharedCanvasView
                isMaster={isMaster}
                roomId={roomId}
                realtimeManager={getRealtimeManager() || undefined}
              />
            )}

            {mainView === 'notation' && (
              <NotationView
                isMaster={isMaster}
                roomId={roomId}
                onCreateSong={handleCreateSong}
              />
            )}

            {mainView === 'teleprompter' && (
              <TeleprompterView
                isMaster={isMaster}
                roomId={roomId}
                onCreateSong={handleCreateSong}
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
            // Mixer props
            onToggleStem={handleToggleStem}
            onStemVolumeChange={handleStemVolume}
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
            // Quality/Latency settings
            onPresetChange={handlePresetChange}
            onCustomSettingsChange={handleCustomSettingsChange}
            onJitterModeChange={handleJitterModeChange}
            onLowLatencyModeChange={handleLowLatencyModeChange}
            onAcceptOptimization={handleAcceptOptimization}
            onDismissOptimization={handleDismissOptimization}
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

      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        roomId={roomId}
      />

    </div>
  );
}
