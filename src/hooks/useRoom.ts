'use client';

import { useCallback, useEffect, useRef } from 'react';
import { RealtimeRoomManager } from '@/lib/supabase/realtime';
import type { RoomLayoutState, StateSyncPayload } from '@/lib/supabase/realtime';
import { CloudflareCalls } from '@/lib/cloudflare/calls';
import { authFetch, authFetchJson } from '@/lib/auth-fetch';
import type { AudioEngine } from '@/lib/audio/audio-engine';
import { useTempoRealtimeBroadcast } from './useTempoRealtimeBroadcast';

// Storage key for persisted guest ID
const GUEST_ID_STORAGE_KEY = 'openstudio_guest_id';

/**
 * Get or create a signed guest ID for unauthenticated users.
 * Guest IDs are fetched from the server and cached in localStorage.
 */
async function getOrCreateGuestId(): Promise<string> {
  // Check localStorage for existing guest ID
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(GUEST_ID_STORAGE_KEY);
    if (stored) {
      // Validate the stored guest ID is still valid
      try {
        const response = await fetch(`/api/auth/guest?guestId=${encodeURIComponent(stored)}`);
        if (response.ok) {
          const { valid } = await response.json();
          if (valid) {
            return stored;
          }
        }
      } catch {
        // Validation failed, will generate new ID below
      }
    }
  }

  // Fetch a new signed guest ID from the server
  const response = await fetch('/api/auth/guest', { method: 'POST' });
  if (!response.ok) {
    throw new Error('Failed to generate guest ID');
  }

  const { guestId } = await response.json();

  // Store for future sessions
  if (typeof window !== 'undefined') {
    localStorage.setItem(GUEST_ID_STORAGE_KEY, guestId);
  }

  return guestId;
}
import { useRoomStore } from '@/stores/room-store';
import { useAudioStore } from '@/stores/audio-store';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { useLoopTracksStore } from '@/stores/loop-tracks-store';
import { useAuthStore } from '@/stores/auth-store';
import { usePerformanceSyncStore } from '@/stores/performance-sync-store';
import { usePermissionsStore } from '@/stores/permissions-store';
import { useBridgeAudioStore } from '@/stores/bridge-audio-store';
import { nativeBridge } from '@/lib/audio/native-bridge';
import type { QualityPresetName, OpusEncodingSettings } from '@/types';
import { useAudioEngine } from './useAudioEngine';
import { useStatsTracker } from './useStatsTracker';
import type { User, Room, BackingTrack, TrackQueue, UserTrack, StemMixState } from '@/types';
import type { LoopTrackState } from '@/types/loops';
import type { RoomRole, RoomPermissions, RoomMember } from '@/types/permissions';
import type { Song, SongTrackReference } from '@/types/songs';
import { setSongBroadcastCallbacks, useSongsStore } from '@/stores/songs-store';
import { useSessionTempoStore } from '@/stores/session-tempo-store';

type BridgeAwareAudioEngine = Pick<
  AudioEngine,
  'createBroadcastStream' | 'setNativeBridgeCallbacks' | 'updateBroadcastConnections'
>;

function getBrowserAudioEngine(): BridgeAwareAudioEngine | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return (window as Window & typeof globalThis & {
    __openStudioAudioEngine?: BridgeAwareAudioEngine;
  }).__openStudioAudioEngine;
}

// Song playback event payloads
export interface SongPlayPayload {
  songId: string;
  currentTime: number;
  syncTime: number;
  trackStates: Array<{ trackRefId: string; muted: boolean; solo: boolean; volume: number }>;
  userId: string;
}

export interface SongPausePayload {
  songId: string;
  currentTime: number;
  userId: string;
}

export interface SongSeekPayload {
  songId: string;
  seekTime: number;
  syncTime: number;
  userId: string;
}

export interface SongSelectPayload {
  songId: string;
  userId: string;
}

/**
 * WS2: Build and broadcast full room state to all clients.
 * Called by the master when:
 * 1. A new user joins (proactive sync)
 * 2. A state:request is received from a joining/reconnecting user
 * 3. A new master is elected after failover
 */
function broadcastFullStateSync(realtime: RealtimeRoomManager, requestId?: string): void {
  const roomState = useRoomStore.getState();
  const audioState = useAudioStore.getState();
  const userTracksStore = useUserTracksStore.getState();
  const loopTracksStore = useLoopTracksStore.getState();
  const permissionsStore = usePermissionsStore.getState();

  const tempoState = useSessionTempoStore.getState();
  const songsState = useSongsStore.getState();

  const allTracks = userTracksStore.getAllTracks().filter((t: UserTrack) => t.isActive);
  const allLoopTracks = Array.from(loopTracksStore.tracks.values()) as LoopTrackState[];
  const roomSongs = songsState.getSongsByRoom(roomState.room?.id || '');

  // Build song track states from current song
  const songTrackStates: Record<string, { muted: boolean; solo: boolean; volume: number }> = {};
  if (songsState.currentSongId) {
    const currentSong = songsState.songs.get(songsState.currentSongId);
    if (currentSong) {
      for (const trackRef of currentSong.tracks) {
        songTrackStates[trackRef.id] = {
          muted: trackRef.muted ?? false,
          solo: trackRef.solo ?? false,
          volume: trackRef.volume ?? 1,
        };
      }
    }
  }

  const payload: StateSyncPayload = {
    requestId: requestId || `master-${Date.now()}`,
    queue: roomState.queue.tracks,
    currentTrack: roomState.currentTrack,
    currentTrackPosition: audioState.currentTime || 0,
    isPlaying: audioState.isPlaying || roomState.queue.isPlaying,
    tempo: tempoState.tempo,
    tempoSource: tempoState.source,
    timeSignature: { beatsPerBar: tempoState.beatsPerBar, beatUnit: tempoState.beatUnit },
    key: tempoState.key,
    keyScale: tempoState.keyScale,
    keySource: tempoState.keySource,
    userTracks: allTracks,
    loopTracks: allLoopTracks,
    songs: roomSongs,
    currentSongId: songsState.currentSongId,
    stemMixState: roomState.stemMixState as unknown as Record<string, { enabled: boolean; volume: number }>,
    permissions: {
      members: permissionsStore.members,
      defaultRole: permissionsStore.defaultRole,
    },
    songTrackStates,
    layoutState: roomState.layoutState,
    currentSongIsPlaying: audioState.isPlaying && !!songsState.currentSongId,
    currentSongPosition: audioState.currentTime || 0,
    timestamp: Date.now(),
  };

  realtime.broadcastStateSync(payload).catch((err) => {
    console.error('[useRoom] Failed to broadcast full state sync:', err);
  });

  console.log(`[useRoom] Full state sync broadcast: ${allTracks.length} tracks, ${allLoopTracks.length} loops, ${roomSongs.length} songs, playing=${payload.isPlaying}`);
}

interface UseRoomOptions {
  onUserJoined?: (user: User) => void;
  onUserLeft?: (userId: string) => void;
  onTrackChanged?: (track: BackingTrack | null) => void;
  onError?: (error: Error) => void;
  // Song playback sync callbacks
  onSongPlay?: (payload: SongPlayPayload) => void;
  onSongPause?: (payload: SongPausePayload) => void;
  onSongSeek?: (payload: SongSeekPayload) => void;
  onSongSelect?: (payload: SongSelectPayload) => void;
}

export function useRoom(roomId: string, options: UseRoomOptions = {}) {
  const realtimeRef = useRef<RealtimeRoomManager | null>(null);
  const cloudflareRef = useRef<CloudflareCalls | null>(null);
  // WS2: State sync retry tracking for new joiners
  const stateSyncReceivedRef = useRef<boolean>(false);

  // Use authenticated user ID if available, otherwise will be populated with signed guest ID
  // This is initialized once, but updated in join() if auth state changes
  const initialAuthUser = useAuthStore.getState().user;
  const userIdRef = useRef<string>(initialAuthUser?.id || '');

  // Only destructure state values, not functions - prevents infinite loops
  // All store functions are accessed via getState() inside callbacks
  const {
    room,
    users,
    currentUser,
    isMaster,
    isConnected,
    isJoining,
    error,
  } = useRoomStore();

  const {
    initialize,
    addRemoteStream,
    removeRemoteStream,
    setRemoteVolume: audioSetRemoteVolume,
    setRemoteMuted: audioSetRemoteMuted,
    setRemoteCompensationDelay,
    loadBackingTrack,
    playBackingTrack,
    seekTo,
    updateFromStats,
    destroyEngine,
    toggleStem: audioToggleStem,
    setStemVolume: audioSetStemVolume,
    // For connecting MediaStream to TrackAudioProcessor for monitoring
    getOrCreateTrackProcessor,
    updateTrackState,
    // WS5: Listener mode (receive-only, no microphone)
    initializeListenerAudio,
    // Multi-track volume control for song track state sync
    setMultiTrackVolume,
    // Backing track volume control
    setBackingTrackVolume,
  } = useAudioEngine();

  // Stats tracking for gamification
  const {
    startSession: statsStartSession,
    endSession: statsEndSession,
    trackCollaborator,
    trackMessage,
  } = useStatsTracker();

  // Join room - returns true on success, false on failure
  // listenerMode: if true, joins as receive-only (no audio capture/publishing)
  const join = useCallback(async (userName: string, instrument?: string, listenerMode: boolean = false): Promise<boolean> => {
    // Get fresh state to check if already joining/connected
    const { isJoining: joining, isConnected: connected } = useRoomStore.getState();
    if (joining || connected) return false;

    // Get all store functions via getState() to avoid dependency issues
    const {
      setJoining,
      setError,
      setCurrentUser,
      setConnected,
      addUser,
      setIsMaster,
      updateUser,
      removeUser,
      setQueue,
      setCurrentTrack,
      addMessage,
      setRoom,
    } = useRoomStore.getState();

    setJoining(true);
    setError(null);

    // Clean up any stale connections from previous failed attempts
    // This is critical for iPad where retries often fail with CLOSED status
    if (realtimeRef.current) {
      console.log('[useRoom] Cleaning up stale realtime connection before join');
      try {
        await realtimeRef.current.disconnect();
      } catch (err) {
        console.log('[useRoom] Error cleaning up stale realtime:', err);
      }
      realtimeRef.current = null;
    }
    if (cloudflareRef.current) {
      console.log('[useRoom] Cleaning up stale cloudflare connection before join');
      try {
        await cloudflareRef.current.leaveRoom();
      } catch (err) {
        console.log('[useRoom] Error cleaning up stale cloudflare:', err);
      }
      cloudflareRef.current = null;
    }
    // Also clean up any orphaned Supabase channels for this room
    await RealtimeRoomManager.cleanupExistingChannel(roomId);

    // Global join timeout - prevents hanging forever on iOS Safari
    const JOIN_TIMEOUT = 45000; // 45 seconds max for entire join operation

    try {
      // Wrap the entire join operation in a timeout
      const joinPromise = (async () => {
      // Get fresh auth state in case user logged in after hook initialized
      const authUser = useAuthStore.getState().user;

      // Update userIdRef to use authenticated user ID if available
      if (authUser?.id) {
        userIdRef.current = authUser.id;
      } else if (!userIdRef.current || !userIdRef.current.startsWith('guest-')) {
        // For unauthenticated users, fetch a signed guest ID from the server
        // This is required for security - the server validates guest ID signatures
        console.log('[useRoom] Fetching signed guest ID for unauthenticated user');
        userIdRef.current = await getOrCreateGuestId();
      }

      // Create user
      const user: User = {
        id: userIdRef.current,
        name: userName,
        instrument,
        isMaster: false,
        isMuted: false,
        volume: 1,
        latency: 0,
        jitterBuffer: 256,
        connectionQuality: 'good',
      };

      setCurrentUser(user);

      // Ensure room exists in database (create if needed)
      try {
        const roomResponse = await authFetch(`/api/rooms?id=${roomId}`);
        if (!roomResponse.ok) {
          // Room doesn't exist, create it
          await authFetchJson('/api/rooms', 'POST', {
            id: roomId,
            name: `Room ${roomId}`,
            createdBy: user.id,
          });
        }
      } catch (err) {
        console.error('Failed to ensure room exists:', err);
        // Continue anyway - room_tracks may still work
      }

      // Initialize audio engine (WS5: listener mode uses optimized receive-only path)
      if (listenerMode) {
        await initializeListenerAudio();
        console.log('[useRoom] Audio engine initialized in listener mode (receive-only, stable jitter buffer)');
      } else {
        await initialize();
      }

      // Load persisted user tracks from the database
      const userTracksState = useUserTracksStore.getState();
      let userTracks: UserTrack[] = [];

      try {
        const tracksResponse = await authFetch(`/api/rooms/${roomId}/user-tracks`);
        if (tracksResponse.ok) {
          const persistedTracks: UserTrack[] = await tracksResponse.json();

          // Load all tracks into the store
          userTracksState.loadPersistedTracks(persistedTracks);

          // Check if this user had any tracks previously
          // First try matching by owner ID (for authenticated users with persistent IDs)
          let ownedTracks = persistedTracks.filter(t => t.ownerUserId === user.id);

          // If no match by ID and user is not authenticated, try matching by username
          // This handles anonymous users who rejoin with the same name
          if (ownedTracks.length === 0 && !authUser && userName) {
            ownedTracks = persistedTracks.filter(t =>
              t.ownerUserName === userName && t.isActive === false
            );
          }

          if (ownedTracks.length > 0) {
            // User is rejoining - reassign their tracks back to them
            console.log(`Restoring ${ownedTracks.length} tracks for rejoining user ${user.name}`);
            for (const track of ownedTracks) {
              userTracksState.assignTrackToUser(track.id, user.id, user.name);
              // Persist the reactivation and update owner ID
              authFetchJson(`/api/rooms/${roomId}/user-tracks`, 'PATCH', {
                trackId: track.id,
                userId: user.id,
                ownerUserId: user.id,
                isActive: true,
              }).catch(err => console.error('Failed to update track status:', err));
            }
            userTracks = userTracksState.getTracksByUser(user.id);
          }
        }
      } catch (err) {
        console.error('Failed to load persisted user tracks:', err);
      }

      // Load persisted loop tracks
      try {
        const loopTracksResponse = await authFetch(`/api/rooms/${roomId}/loop-tracks`);
        if (loopTracksResponse.ok) {
          const persistedLoopTracks: LoopTrackState[] = await loopTracksResponse.json();
          const loopTracksState = useLoopTracksStore.getState();
          loopTracksState.loadTracks(persistedLoopTracks);
          console.log(`Loaded ${persistedLoopTracks.length} loop tracks from database`);
        }
      } catch (err) {
        console.error('Failed to load loop tracks:', err);
      }

      // Load room permissions
      try {
        // SECURITY: No longer pass userId in query - server derives it from JWT
        const permissionsResponse = await authFetch(
          `/api/rooms/${roomId}/permissions`
        );
        if (permissionsResponse.ok) {
          const permissionsData = await permissionsResponse.json();
          const permissionsStore = usePermissionsStore.getState();

          // Set room members
          permissionsStore.setMembers(permissionsData.members || []);
          permissionsStore.setDefaultRole(permissionsData.defaultRole || 'member');
          permissionsStore.setRequireApproval(permissionsData.requireApproval || false);

          // Set current user's permissions
          if (permissionsData.myMember) {
            permissionsStore.setMyPermissions(
              permissionsData.myMember.role,
              permissionsData.myMember.customPermissions
            );
          } else {
            // New user - use default role (will be upgraded to owner if first user)
            permissionsStore.setMyPermissions(permissionsData.defaultRole || 'member');
          }

          console.log(`Loaded permissions: ${permissionsData.members?.length || 0} members`);
        }

        // Register as listener if in listener mode
        // This sets the correct role in the database and permissions store
        if (listenerMode) {
          try {
            const registerResponse = await authFetchJson(`/api/rooms/${roomId}/permissions`, 'POST', {
              userId: user.id,
              userName: userName,
              listenerMode: true,
            });
            if (registerResponse.ok) {
              const permissionsStore = usePermissionsStore.getState();
              permissionsStore.setMyPermissions('listener');
              console.log('[useRoom] Registered as listener');
            }
          } catch (err) {
            console.error('Failed to register as listener:', err);
          }
        }
      } catch (err) {
        console.error('Failed to load permissions:', err);
        // Set basic permissions as fallback
        usePermissionsStore.getState().setMyPermissions(listenerMode ? 'listener' : 'member');
      }

      // Create a default track if user has none (skip for listeners - they don't need tracks)
      if (!listenerMode && userTracks.length === 0) {
        userTracks = userTracksState.getTracksByUser(user.id);
        if (userTracks.length === 0) {
          const newTrack = userTracksState.addTrack(user.id, 'Track 1', undefined, user.name);
          userTracks = [newTrack];

          // Persist the new track
          authFetchJson(`/api/rooms/${roomId}/user-tracks`, 'POST', newTrack)
            .catch(err => console.error('Failed to persist new track:', err));
          // Note: Track will be broadcast via presence:join handler when other users join
        }
      }

      // Start audio capture with track settings (device, channel config, etc.)
      // Skip audio capture in listener mode - listeners only receive, not send
      let stream: MediaStream | undefined;
      let broadcastStream: MediaStream | undefined;
      const bridgeState = useBridgeAudioStore.getState();
      const nativePerformerMode = !listenerMode && bridgeState.isConnected && bridgeState.preferNativeBridge;
      const shouldReceiveRemoteWebRtc = listenerMode || !nativePerformerMode;

      if (!listenerMode) {
        if (nativePerformerMode) {
          // NATIVE BRIDGE MODE: Audio flows through bridge -> TrackAudioProcessor -> WebRTC
          // Create track processors for each user track (bridge input will be connected by useNativeBridge)
          for (const track of userTracks) {
            getOrCreateTrackProcessor(track.id, track.audioSettings);

            const monitoringEnabled = track.audioSettings.directMonitoring ?? true;
            updateTrackState(track.id, {
              isArmed: track.isArmed,
              isMuted: track.isMuted,
              isSolo: track.isSolo,
              volume: track.volume,
              inputGain: track.audioSettings.inputGain || 0,
              monitoringEnabled: monitoringEnabled,
            });

            console.log(`[useRoom] Created track processor for bridge audio: ${track.id}, armed: ${track.isArmed}`);
          }

          // CRITICAL: Create broadcast stream from AudioEngine's track processors
          // This mixes all armed tracks into a single MediaStream for WebRTC
          const audioEngine = getBrowserAudioEngine();
          if (audioEngine) {
            broadcastStream = audioEngine.createBroadcastStream() || undefined;
            console.log('[useRoom] Created broadcast stream for native bridge WebRTC:', broadcastStream ? 'success' : 'failed');
          }
        } else {
          // Web-only users must be listeners - native bridge required to perform
          console.warn('[useRoom] No native bridge connected for performer - audio capture requires native bridge');
          // Don't create a broadcast stream - this user won't be heard
        }
      } else {
        console.log('[useRoom] Listener mode - skipping audio capture');
      }

      // Initialize Cloudflare Calls
      const cloudflare = new CloudflareCalls(roomId, user.id);
      await cloudflare.initialize();

      if (shouldReceiveRemoteWebRtc) {
        cloudflare.setOnRemoteStream(async (userId, remoteStream) => {
          // Await to ensure AudioContext is resumed on iOS Safari before proceeding
          await addRemoteStream(userId, remoteStream);
          // Use fresh store state instead of closure to avoid stale user data
          const freshUser = useRoomStore.getState().users.get(userId);
          options.onUserJoined?.(freshUser || { id: userId, name: 'Unknown', volume: 1, latency: 0, jitterBuffer: 256, connectionQuality: 'good' });
        });

        cloudflare.setOnRemoteStreamRemoved((userId) => {
          removeRemoteStream(userId);
          options.onUserLeft?.(userId);
        });
      }

      cloudflare.setOnStatsUpdate((stats) => {
        useAudioStore.getState().setWebRTCStats(stats);
        updateFromStats({
          jitter: stats.jitter,
          packetLoss: stats.packetsLost,
          roundTripTime: stats.roundTripTime,
        });
      });

      // Wire up performance sync callbacks for world-class latency system
      cloudflare.setOnClockSync((offset, rtt) => {
        const perfStore = usePerformanceSyncStore.getState();
        perfStore.setClockSync(
          offset,
          rtt < 30 ? 'excellent' : rtt < 60 ? 'good' : rtt < 100 ? 'fair' : 'poor'
        );
      });

      // Note: BroadcastPerformanceInfo is handled internally by CloudflareCalls
      // for latency compensation. Full UserPerformanceInfo updates come through
      // the latency sync engine when available.

      cloudflare.setOnJamCompatibilityChange((compatibility) => {
        const perfStore = usePerformanceSyncStore.getState();
        perfStore.setJamCompatibility(compatibility);
      });

      cloudflare.setOnMasterChange((masterId, isSelf) => {
        const perfStore = usePerformanceSyncStore.getState();
        perfStore.setIsMaster(isSelf);
        perfStore.setMasterId(masterId);
      });

      // Wire up latency compensation for incoming remote streams
      // This ensures each remote user's audio is delayed appropriately
      // for proper bidirectional synchronization
      cloudflare.setOnRemoteStreamCompensation((userId, delayMs) => {
        setRemoteCompensationDelay(userId, delayMs);
      });

      // Native performers publish a listener feed only. They do not subscribe to
      // other performers' WebRTC audio; performer audio stays on the native bridge.
      await cloudflare.joinRoom(broadcastStream || stream, 'mic', undefined, shouldReceiveRemoteWebRtc);
      cloudflareRef.current = cloudflare;

      // === NATIVE BRIDGE P2P NETWORKING ===
      // When native bridge is connected, join the room through the Rust P2P/Relay network.
      // This enables direct native-to-native audio routing (Rust → P2P → Rust) for performers
      // who both have the native bridge, bypassing WebRTC and Web Audio entirely.
      // WebRTC remains listener-only in this mode.
      if (nativePerformerMode) {
        // Join room through native bridge P2P network
        nativeBridge.joinRoom(roomId, roomId, user.name || 'Unknown');
        console.log('[useRoom] Native bridge joining P2P room:', roomId);

        const audioEngine = getBrowserAudioEngine();
        if (audioEngine) {
          audioEngine.setNativeBridgeCallbacks(null, null, null);
        }

        // Listen for peers connecting via native bridge P2P
        // (these are performers with native bridges on the other end)
        nativeBridge.on('peerConnected', (data) => {
          console.log('[useRoom] Native bridge peer connected:', data.userName, 'native:', data.hasNativeBridge);
        });

        nativeBridge.on('peerDisconnected', (data) => {
          console.log('[useRoom] Native bridge peer disconnected:', data.userId, data.reason);
        });
      }

      // Initialize realtime connection
      const realtime = new RealtimeRoomManager(roomId, user.id);

      realtime.on('connected', async () => {
        setConnected(true);
        setJoining(false);

        // Start stats tracking session
        statsStartSession(roomId, instrument);

        // First user to connect becomes master by default
        // This ensures playback controls work immediately
        // Will be corrected by presence:sync if needed
        setIsMaster(true);
        updateUser(user.id, { isMaster: true });
        cloudflare.setAsMaster(true);
        usePerformanceSyncStore.getState().setIsMaster(true);
        usePerformanceSyncStore.getState().setMasterId(user.id);

        // First user becomes owner in permissions
        usePermissionsStore.getState().setMyPermissions('owner');

        // Load existing tracks from database (includes both file uploads and YouTube tracks)
        // Always set queue to this room's tracks (even if empty) to clear any previous room data
        try {
          const response = await authFetch(`/api/rooms/${roomId}/tracks`);
          if (response.ok) {
            const tracks: BackingTrack[] = await response.json();
            console.log('Loaded tracks from database:', tracks.length, 'tracks');
            tracks.forEach((t: BackingTrack) => {
              console.log(`  - ${t.name} (${t.youtubeId ? 'YouTube: ' + t.youtubeId : 'file upload'})`);
            });
            setQueue({
              tracks,
              currentIndex: tracks.length > 0 ? 0 : -1,
              isPlaying: false,
              currentTime: 0,
              syncTimestamp: 0,
            });
            setCurrentTrack(tracks.length > 0 ? tracks[0] : null);
          }
        } catch (err) {
          console.error('Failed to load tracks:', err);
        }

        // Broadcast this user's active tracks to other clients
        // This ensures other users see our tracks when we join/rejoin
        const userTracksToSync = useUserTracksStore.getState().getTracksByUser(user.id);
        if (userTracksToSync.length > 0) {
          console.log(`[useRoom] Broadcasting ${userTracksToSync.length} active tracks on connect`);
          for (const track of userTracksToSync) {
            if (track.isActive) {
              await realtime.broadcastUserTrackAdd(track);
            }
          }
        }
      });

      realtime.on('presence:sync', (data) => {
        const state = data as Record<string, User[]>;
        Object.values(state).flat().forEach((u) => {
          if (u.id !== user.id) {
            addUser(u);
            // Track existing users as collaborators
            trackCollaborator(u.id);
          }
        });

        // First user becomes master
        const allUsers = Object.values(state).flat();
        if (allUsers.length === 1 && allUsers[0].id === user.id) {
          setIsMaster(true);
          updateUser(user.id, { isMaster: true });
          cloudflareRef.current?.setAsMaster(true);
          usePerformanceSyncStore.getState().setIsMaster(true);
          usePerformanceSyncStore.getState().setMasterId(user.id);
          // Also set permissions to owner
          usePermissionsStore.getState().setMyPermissions('owner');
        }
      });

      realtime.on('presence:join', async (data) => {
        const { users: newUsers } = data as { users: User[] };
        let hasNewUsers = false;

        newUsers.forEach((u) => {
          if (u.id !== user.id) {
            addUser(u);
            options.onUserJoined?.(u);
            hasNewUsers = true;
            // Track collaborator for stats
            trackCollaborator(u.id);
          }
        });

        // CRITICAL: When new users join, we need to pull their WebRTC audio tracks
        // pullRemoteTracks only runs once during our initial join, so we need to
        // refresh to discover newly joined users' audio streams
        if (hasNewUsers && shouldReceiveRemoteWebRtc && cloudflareRef.current) {
          console.log('[useRoom] New user joined, refreshing remote tracks...');
          const refreshDelays = [0, 300, 1000];
          refreshDelays.forEach((delay) => {
            setTimeout(async () => {
              if (!cloudflareRef.current) {
                return;
              }
              try {
                await cloudflareRef.current.refreshRemoteTracks();
              } catch (err) {
                console.error('[useRoom] Failed to refresh remote tracks:', err);
              }
            }, delay);
          });
        }

        // CRITICAL: Sync room state to new joiners via state:request/state:sync protocol (WS2)
        // The new user will send a state:request; the master responds via the state:request handler below.
        // As a fallback for the initial join race condition, also proactively broadcast after a short delay.
        if (hasNewUsers && useRoomStore.getState().isMaster) {
          // Short delay to allow new user's subscription to become active
          setTimeout(() => {
            // Only proactively broadcast if no state:request has been received yet
            // (The state:request handler is the preferred path; this is a safety net)
            const roomStore = useRoomStore.getState();
            if (roomStore.isMaster) {
              console.log('[useRoom] Master proactively broadcasting state sync to new users');
              broadcastFullStateSync(realtime);
            }
          }, 300);
        }
      });

      realtime.on('presence:leave', (data) => {
        const { users: leftUsers } = data as { users: User[] };
        const userTracksStore = useUserTracksStore.getState();
        const roomStore = useRoomStore.getState();

        leftUsers.forEach((u) => {
          removeUser(u.id);
          removeRemoteStream(u.id);
          // Remove from latency compensator to update jam compatibility
          cloudflare.removeParticipant(u.id);
          // Remove from performance sync store
          usePerformanceSyncStore.getState().removeParticipant(u.id);
          // Mark their tracks as inactive (greyed out)
          userTracksStore.setUserTracksActive(u.id, false);
          options.onUserLeft?.(u.id);
        });

        // Master failover: if a leaving user was master, elect new master
        const leftUserIds = new Set(leftUsers.map(u => u.id));
        const wasMasterAmongLeft = leftUsers.some(u => u.isMaster);

        if (wasMasterAmongLeft) {
          // Get remaining users (excluding those who just left)
          const remainingUsers = Array.from(roomStore.users.values())
            .filter(u => !leftUserIds.has(u.id));

          if (remainingUsers.length > 0) {
            // Elect new master: first by join order (lowest index), or alphabetically by ID as tiebreaker
            const newMaster = remainingUsers.sort((a, b) => a.id.localeCompare(b.id))[0];

            console.log(`[useRoom] Master failover: electing ${newMaster.id} as new master`);

            // Update the new master's isMaster flag
            updateUser(newMaster.id, { isMaster: true });

            // If we are the new master, update our state and CloudflareCalls
            if (newMaster.id === user.id) {
              setIsMaster(true);
              cloudflareRef.current?.setAsMaster(true);
              usePermissionsStore.getState().setMyPermissions('owner');
              console.log('[useRoom] We are now the room master');

              // WS2: Re-broadcast full room state as new master so all users have authoritative state
              setTimeout(() => {
                if (realtimeRef.current && useRoomStore.getState().isMaster) {
                  console.log('[useRoom] New master re-broadcasting full room state');
                  broadcastFullStateSync(realtimeRef.current);
                }
              }, 200);
            }
          }
        }
      });

      realtime.on('layout:update', (data) => {
        const payload = data as RoomLayoutState;
        useRoomStore.getState().setLayoutState(payload);
      });

      realtime.on('track:queue', (data) => {
        const payload = data as { queue: TrackQueue };
        setQueue(payload.queue);
        // Also set the current track based on the queue's currentIndex
        const currentTrackFromQueue = payload.queue.tracks[payload.queue.currentIndex];
        if (currentTrackFromQueue) {
          setCurrentTrack(currentTrackFromQueue);
        }
      });

      realtime.on('user:mute', (data) => {
        const payload = data as { targetUserId: string; isMuted: boolean };
        updateUser(payload.targetUserId, { isMuted: payload.isMuted });
        // Apply mute to audio engine - this affects actual audio output
        audioSetRemoteMuted(payload.targetUserId, payload.isMuted);
      });

      realtime.on('user:volume', (data) => {
        const payload = data as { targetUserId: string; volume: number };
        updateUser(payload.targetUserId, { volume: payload.volume });
        // Apply volume to audio engine - this affects actual audio output
        audioSetRemoteVolume(payload.targetUserId, payload.volume);
      });

      realtime.on('chat:message', (data) => {
        const payload = data as { message: string; userId: string; timestamp: number };
        // Skip messages from self (we already add them locally in sendMessage)
        if (payload.userId === user.id) return;
        // Filter out blank messages
        const trimmedMessage = payload.message?.trim();
        if (!trimmedMessage) return;

        addMessage({
          type: 'chat',
          userId: payload.userId,
          content: trimmedMessage,
          timestamp: new Date(payload.timestamp).toISOString(),
        });
      });

      // User track broadcast handlers
      realtime.on('usertrack:add', (data) => {
        const payload = data as { track: UserTrack; userId: string };
        if (payload.userId === user.id) return; // Skip our own broadcasts
        const userTracksStore = useUserTracksStore.getState();
        userTracksStore.loadPersistedTracks([payload.track]);
      });

      realtime.on('usertrack:remove', (data) => {
        const payload = data as { trackId: string; userId: string };
        if (payload.userId === user.id) return;
        const userTracksStore = useUserTracksStore.getState();
        userTracksStore.removeTrack(payload.trackId);
      });

      realtime.on('usertrack:update', (data) => {
        const payload = data as { trackId: string; updates: Partial<UserTrack>; userId: string };
        if (payload.userId === user.id) return;
        const userTracksStore = useUserTracksStore.getState();
        userTracksStore.updateTrack(payload.trackId, payload.updates);
      });

      // Loop track broadcast handlers
      realtime.on('looptrack:add', (data) => {
        const payload = data as { track: LoopTrackState; userId: string };
        if (payload.userId === user.id) return;
        const loopTracksStore = useLoopTracksStore.getState();
        loopTracksStore.loadTracks([payload.track]);
      });

      realtime.on('looptrack:remove', (data) => {
        const payload = data as { trackId: string; userId: string };
        if (payload.userId === user.id) return;
        const loopTracksStore = useLoopTracksStore.getState();
        loopTracksStore.removeTrack(payload.trackId);
      });

      realtime.on('looptrack:update', (data) => {
        const payload = data as { trackId: string; updates: Partial<LoopTrackState>; userId: string };
        if (payload.userId === user.id) return;
        const loopTracksStore = useLoopTracksStore.getState();
        loopTracksStore.updateTrack(payload.trackId, payload.updates);
      });

      realtime.on('looptrack:play', (data) => {
        const payload = data as { trackId: string; syncTimestamp: number; loopStartBeat: number; userId: string };
        if (payload.userId === user.id) return;
        const loopTracksStore = useLoopTracksStore.getState();
        loopTracksStore.setTrackPlaying(payload.trackId, true, payload.syncTimestamp);
      });

      realtime.on('looptrack:stop', (data) => {
        const payload = data as { trackId: string; userId: string };
        if (payload.userId === user.id) return;
        const loopTracksStore = useLoopTracksStore.getState();
        loopTracksStore.setTrackPlaying(payload.trackId, false);
      });

      // Stem toggle sync handler - sync stem mute/unmute across all clients
      realtime.on('stem:toggle', (data) => {
        const payload = data as { trackId: string; stem: string; enabled: boolean; userId: string };
        if (payload.userId === user.id) return;

        // Update the room store's stem mix state
        const roomStore = useRoomStore.getState();
        const stemKey = payload.stem as keyof StemMixState;
        if (roomStore.stemMixState[stemKey]) {
          roomStore.setStemMixState({
            ...roomStore.stemMixState,
            [stemKey]: {
              ...roomStore.stemMixState[stemKey],
              enabled: payload.enabled,
            },
          });
        }

        // Apply to audio engine
        audioToggleStem(payload.stem, payload.enabled);
      });

      // Stem volume sync handler - sync stem volume changes across all clients
      realtime.on('stem:volume', (data) => {
        const payload = data as { trackId: string; stem: string; volume: number; userId: string };
        if (payload.userId === user.id) return;

        // Update the room store's stem mix state
        const roomStore = useRoomStore.getState();
        const stemKey = payload.stem as keyof StemMixState;
        if (roomStore.stemMixState[stemKey]) {
          roomStore.setStemVolume(stemKey, payload.volume);
        }

        // Apply to audio engine
        audioSetStemVolume(payload.stem, payload.volume);
      });

      realtime.on('backingtrack:volume', (data) => {
        const payload = data as { volume: number; userId: string };
        if (payload.userId === user.id) return;
        // Apply to audio engine
        setBackingTrackVolume(payload.volume);
      });

      // Tempo broadcast handlers - sync BPM/time signature across all clients
      realtime.on('tempo:update', (data) => {
        const payload = data as { tempo: number; source: string; userId: string };
        if (payload.userId === user.id) return;
        const tempoStore = useSessionTempoStore.getState();
        // Only update if the remote user is setting manual tempo
        if (payload.source === 'manual' || payload.source === 'tap') {
          tempoStore.setManualTempo(payload.tempo);
        }
      });

      realtime.on('tempo:source', (data) => {
        const payload = data as { source: string; userId: string };
        if (payload.userId === user.id) return;
        const tempoStore = useSessionTempoStore.getState();
        tempoStore.setSource(payload.source as 'manual' | 'track' | 'analyzer' | 'tap');
      });

      realtime.on('tempo:timesig', (data) => {
        const payload = data as { beatsPerBar: number; beatUnit: number; userId: string };
        if (payload.userId === user.id) return;
        const tempoStore = useSessionTempoStore.getState();
        tempoStore.setTimeSignature(payload.beatsPerBar, payload.beatUnit);
      });

      realtime.on('key:update', (data) => {
        const payload = data as { key: string | null; keyScale: 'major' | 'minor' | null; keySource: string; userId: string };
        if (payload.userId === user.id) return;
        const tempoStore = useSessionTempoStore.getState();
        // Apply key value based on source type so all clients stay in sync
        if (payload.keySource === 'manual') {
          tempoStore.setManualKey(payload.key, payload.keyScale);
        } else if (payload.keySource === 'analyzer') {
          tempoStore.setAnalyzerData({ key: payload.key, keyScale: payload.keyScale });
        } else if (payload.keySource === 'track') {
          tempoStore.setTrackMetadata({ key: payload.key ?? undefined, keyScale: payload.keyScale ?? undefined });
        }
        tempoStore.setKeySource(payload.keySource as 'manual' | 'track' | 'analyzer');
      });

      // Permission event handlers
      realtime.on('permissions:role_update', (data) => {
        const payload = data as { targetUserId: string; role: RoomRole; userId: string };
        if (payload.userId === user.id) return;
        const permissionsStore = usePermissionsStore.getState();

        // Update member's role in the store
        permissionsStore.updateMemberRole(payload.targetUserId, payload.role);

        // If this is our own role being updated, update our permissions
        if (payload.targetUserId === user.id) {
          permissionsStore.setMyPermissions(payload.role);
        }
      });

      realtime.on('permissions:custom_update', (data) => {
        const payload = data as {
          targetUserId: string;
          customPermissions: Partial<RoomPermissions> | null;
          userId: string;
        };
        if (payload.userId === user.id) return;
        const permissionsStore = usePermissionsStore.getState();

        if (payload.customPermissions === null) {
          permissionsStore.clearMemberCustomPermissions(payload.targetUserId);
        } else {
          permissionsStore.updateMemberPermissions(payload.targetUserId, payload.customPermissions);
        }

        // If this is our own permissions being updated
        if (payload.targetUserId === user.id) {
          const member = permissionsStore.members.find(m => m.oduserId === user.id);
          if (member) {
            permissionsStore.setMyPermissions(member.role, payload.customPermissions || undefined);
          }
        }
      });

      realtime.on('permissions:member_kick', (data) => {
        const payload = data as { targetUserId: string; userId: string };
        if (payload.userId === user.id) return;

        // If we're being kicked, leave the room
        if (payload.targetUserId === user.id) {
          console.log('You have been kicked from the room');
          // Trigger leave (will be handled by the component)
          setError('You have been kicked from this room');
          return;
        }

        // Remove member from permissions store
        usePermissionsStore.getState().removeMember(payload.targetUserId);
      });

      realtime.on('permissions:member_ban', (data) => {
        const payload = data as { targetUserId: string; reason?: string; userId: string };
        if (payload.userId === user.id) return;

        // If we're being banned, leave the room
        if (payload.targetUserId === user.id) {
          console.log('You have been banned from the room:', payload.reason);
          setError(`You have been banned from this room${payload.reason ? `: ${payload.reason}` : ''}`);
          return;
        }

        // Remove member from permissions store
        usePermissionsStore.getState().removeMember(payload.targetUserId);
      });

      // WS2: State request/response protocol
      // When a new user joins (or reconnects), they send state:request
      // The master responds with the full room state via state:sync
      realtime.on('state:request', (data) => {
        const payload = data as { userId: string; requestId: string };
        if (payload.userId === user.id) return;

        // Only master responds to state requests
        if (!useRoomStore.getState().isMaster) return;

        console.log(`[useRoom] Received state:request from ${payload.userId}, broadcasting full state sync`);
        broadcastFullStateSync(realtime, payload.requestId);
      });

      realtime.on('state:sync', (data) => {
        const payload = data as StateSyncPayload & { userId: string };
        if (payload.userId === user.id) return;

        stateSyncReceivedRef.current = true;
        console.log('[useRoom] Received state:sync from master, applying full state');

        // Apply queue
        if (payload.queue.length > 0) {
          const queue: TrackQueue = {
            tracks: payload.queue,
            currentIndex: payload.currentTrack
              ? payload.queue.findIndex(t => t.id === payload.currentTrack?.id)
              : 0,
            isPlaying: payload.isPlaying,
            currentTime: payload.currentTrackPosition,
            syncTimestamp: payload.timestamp,
          };
          useRoomStore.getState().setQueue(queue);
          if (payload.currentTrack) {
            useRoomStore.getState().setCurrentTrack(payload.currentTrack);
          }
        }

        // Apply tempo
        const tempoStore = useSessionTempoStore.getState();
        if (payload.tempoSource === 'manual' || payload.tempoSource === 'tap') {
          tempoStore.setManualTempo(payload.tempo);
        }
        tempoStore.setSource(payload.tempoSource as 'manual' | 'track' | 'analyzer' | 'tap');
        tempoStore.setTimeSignature(payload.timeSignature.beatsPerBar, payload.timeSignature.beatUnit);
        if (payload.key) {
          tempoStore.setManualKey(payload.key, payload.keyScale as 'major' | 'minor' | null);
        }

        // Apply user tracks
        if (payload.userTracks.length > 0) {
          useUserTracksStore.getState().loadPersistedTracks(payload.userTracks);
        }

        // Apply loop tracks
        if (payload.loopTracks.length > 0) {
          useLoopTracksStore.getState().loadTracks(payload.loopTracks);
        }

        // Apply songs
        if (payload.songs.length > 0) {
          useSongsStore.getState().setSongs(payload.songs);
          if (payload.currentSongId) {
            useSongsStore.getState().selectSong(payload.currentSongId);
          }
        }

        // Apply stem mix state
        if (payload.stemMixState && Object.keys(payload.stemMixState).length > 0) {
          useRoomStore.getState().setStemMixState(payload.stemMixState as unknown as StemMixState);
        }

        // Apply permissions
        if (payload.permissions) {
          const permData = payload.permissions as { members?: RoomMember[]; defaultRole?: RoomRole };
          if (permData.members) {
            usePermissionsStore.getState().setMembers(permData.members);
          }
          if (permData.defaultRole) {
            usePermissionsStore.getState().setDefaultRole(permData.defaultRole);
          }
        }

        if (payload.layoutState) {
          useRoomStore.getState().setLayoutState(payload.layoutState);
        }

        // Sync Song playback state - trigger song:play for joining user
        if (payload.currentSongIsPlaying && payload.currentSongId) {
          // Build track states array from the songTrackStates record
          const trackStatesArray = Object.entries(payload.songTrackStates || {}).map(([trackRefId, state]) => ({
            trackRefId,
            muted: state.muted,
            solo: state.solo,
            volume: state.volume,
          }));

          const syncTime = Date.now() + 200;
          options.onSongPlay?.({
            songId: payload.currentSongId,
            currentTime: payload.currentSongPosition || payload.currentTrackPosition || 0,
            syncTime,
            trackStates: trackStatesArray,
            userId: 'master',
          });
          console.log(`[useRoom] State sync: starting Song playback at position ${payload.currentSongPosition || 0}`);
        } else if (payload.isPlaying && payload.currentTrack) {
          // Legacy single-track playback fallback
          const syncTime = Date.now() + 200;
          loadBackingTrack(payload.currentTrack).then((success) => {
            if (success) {
              playBackingTrack(syncTime, payload.currentTrackPosition);
              useRoomStore.getState().setQueuePlaying(true);
              console.log(`[useRoom] State sync: started playback at position ${payload.currentTrackPosition}`);
            }
          });
        }
      });

      // WS2: Reconnection handler — auto-request state sync when connection is restored
      realtime.on('reconnected', () => {
        console.log('[useRoom] Reconnected to room, requesting state sync...');
        stateSyncReceivedRef.current = false;
        // State request is already sent automatically by RealtimeRoomManager on reconnect
        // Set a timeout to warn if sync is not received
        setTimeout(() => {
          if (!stateSyncReceivedRef.current) {
            console.warn('[useRoom] State sync not received after reconnection within 3s, requesting again...');
            realtimeRef.current?.broadcastStateRequest().catch(() => {
              console.warn('[useRoom] Failed to re-request state sync after reconnection');
            });
          }
        }, 3000);
      });

      realtime.on('disconnected', () => {
        console.log('[useRoom] Disconnected from room, waiting for reconnection...');
      });

      realtime.on('song:position', (data) => {
        const payload = data as { songId: string; currentTime: number; syncTimestamp: number; isPlaying: boolean; userId: string };
        if (payload.userId === user.id) return;
        if (useRoomStore.getState().isMaster) return;

        const localTime = useAudioStore.getState().currentTime || 0;
        const drift = Math.abs(localTime - payload.currentTime);

        if (drift > 0.2 && payload.isPlaying) {
          console.log(`[useRoom] Song position drift: ${(drift * 1000).toFixed(0)}ms, correcting`);
          seekTo(payload.currentTime, Date.now() + 50);
        }
      });

      // Song playback event handlers (multi-track timeline sync)
      // These sync the Song system playback across all room members
      realtime.on('song:play', (data) => {
        const payload = data as SongPlayPayload;
        if (payload.userId === user.id) return;
        options.onSongPlay?.(payload);
      });

      realtime.on('song:pause', (data) => {
        const payload = data as SongPausePayload;
        if (payload.userId === user.id) return;
        options.onSongPause?.(payload);
      });

      realtime.on('song:seek', (data) => {
        const payload = data as SongSeekPayload;
        if (payload.userId === user.id) return;
        options.onSongSeek?.(payload);
      });

      realtime.on('song:select', (data) => {
        const payload = data as SongSelectPayload;
        if (payload.userId === user.id) return;
        options.onSongSelect?.(payload);
      });

      // Song track state changes during playback (mute/solo/volume)
      realtime.on('song:trackStates', (data) => {
        const payload = data as {
          songId: string;
          trackStates: Array<{ trackRefId: string; muted: boolean; solo: boolean; volume: number }>;
          userId: string;
        };
        if (payload.userId === user.id) return;

        const songsStore = useSongsStore.getState();
        const song = songsStore.songs.get(payload.songId);
        if (song) {
          // Apply track states to the song without triggering broadcast (to avoid loops)
          const updatedTracks = song.tracks.map((trackRef: SongTrackReference) => {
            const state = payload.trackStates.find(s => s.trackRefId === trackRef.id);
            if (state) {
              return {
                ...trackRef,
                muted: state.muted,
                solo: state.solo,
                volume: state.volume,
              };
            }
            return trackRef;
          });
          const newSongs = new Map(songsStore.songs);
          newSongs.set(payload.songId, { ...song, tracks: updatedTracks });
          useSongsStore.setState({ songs: newSongs });

          // Apply track state changes to audio engine for immediate audio effect
          const audioStore = useAudioStore.getState();
          if (audioStore.isPlaying) {
            const hasSoloTrack = payload.trackStates.some(ts => ts.solo);
            const queueState = useRoomStore.getState().queue;
            for (const trackState of payload.trackStates) {
              // Find the matching audio track to get the audio engine track ID
              const matchingTrackRef = song.tracks.find((tr: SongTrackReference) => tr.id === trackState.trackRefId);
              if (matchingTrackRef && matchingTrackRef.type === 'audio') {
                const audioTrack = queueState.tracks.find((t: BackingTrack) => t.id === matchingTrackRef.trackId);
                if (audioTrack) {
                  const isEffectivelyMuted = trackState.muted || (hasSoloTrack && !trackState.solo);
                  setMultiTrackVolume(audioTrack.id, trackState.volume, isEffectivelyMuted);
                }
              }
            }
          }
        }
      });

      // Songs CRUD sync handlers
      realtime.on('songs:create', (data) => {
        const payload = data as { song: unknown; userId: string };
        if (payload.userId === user.id) return;
        const songsStore = useSongsStore.getState();
        // Add the song directly without persisting (it's already on server)
        const songs = new Map(songsStore.songs);
        const song = payload.song as Song;
        songs.set(song.id, song);
        useSongsStore.setState({ songs });
      });

      realtime.on('songs:update', (data) => {
        const payload = data as { songId: string; changes: Record<string, unknown>; userId: string };
        if (payload.userId === user.id) return;
        const songsStore = useSongsStore.getState();
        const song = songsStore.songs.get(payload.songId);
        if (song) {
          const songs = new Map(songsStore.songs);
          songs.set(payload.songId, { ...song, ...payload.changes });
          useSongsStore.setState({ songs });
        }
      });

      realtime.on('songs:delete', (data) => {
        const payload = data as { songId: string; userId: string };
        if (payload.userId === user.id) return;
        const songsStore = useSongsStore.getState();
        const songs = new Map(songsStore.songs);
        songs.delete(payload.songId);
        useSongsStore.setState({ songs });
      });

      await realtime.connect(user);
      realtimeRef.current = realtime;

      // WS2: Request state sync from master after connecting
      // Small delay to ensure subscription is fully active before requesting state
      stateSyncReceivedRef.current = false;
      setTimeout(() => {
        if (realtimeRef.current && !stateSyncReceivedRef.current) {
          console.log('[useRoom] Requesting state sync from master...');
          realtimeRef.current.broadcastStateRequest().catch((err) => {
            console.warn('[useRoom] Failed to request initial state sync:', err);
          });
        }
      }, 200);

      // Register song broadcast callbacks so CRUD operations auto-broadcast
      setSongBroadcastCallbacks({
        onSongCreate: (song) => {
          realtime.broadcastSongCreate(song as unknown as { id: string; name: string; [key: string]: unknown });
        },
        onSongUpdate: (songId, changes) => {
          realtime.broadcastSongUpdate(songId, changes);
        },
        onSongDelete: (songId) => {
          realtime.broadcastSongDelete(songId);
        },
      });

      // Create room object
      const roomData: Room = {
        id: roomId,
        name: `Room ${roomId.slice(0, 8)}`,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        popLocation: 'auto',
        maxUsers: 10,
        users: [user],
        isPublic: true,
        settings: {
          sampleRate: 48000,
          bitDepth: 24,
          bufferSize: 256,
          autoJitterBuffer: true,
          backingTrackVolume: 0.7,
          masterVolume: 1,
        },
      };

      setRoom(roomData);
      return true;
      })();

      // Race the join operation against a timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Join operation timed out after ${JOIN_TIMEOUT / 1000} seconds. Please check your network connection and try again.`));
        }, JOIN_TIMEOUT);
      });

      return await Promise.race([joinPromise, timeoutPromise]);
    } catch (err) {
      const error = err as Error;
      console.error('[useRoom] Join failed:', error.message);
      setError(error.message);
      options.onError?.(error);
      return false;
    } finally {
      // CRITICAL: Always clear joining state, even on failure
      // This prevents the user from being stuck in "Joining..." forever
      setJoining(false);
    }
  }, [roomId, initialize, addRemoteStream, removeRemoteStream, updateFromStats, loadBackingTrack, playBackingTrack, seekTo, options, getOrCreateTrackProcessor, updateTrackState, initializeListenerAudio, audioToggleStem, audioSetStemVolume, audioSetRemoteVolume, audioSetRemoteMuted, setRemoteCompensationDelay, setMultiTrackVolume, setBackingTrackVolume, statsStartSession, trackCollaborator]);

  // Leave room
  const leave = useCallback(async () => {
    // End stats tracking session before cleanup
    await statsEndSession();

    // Get current user before disconnecting
    const currentUserId = userIdRef.current;

    // Mark this user's tracks as inactive (not deleted) so they persist
    const userTracksState = useUserTracksStore.getState();
    const userTracks = userTracksState.getTracksByUser(currentUserId);

    // Broadcast that this user's tracks are now inactive
    if (realtimeRef.current && userTracks.length > 0) {
      for (const track of userTracks) {
        realtimeRef.current.broadcastUserTrackUpdate(track.id, { isActive: false });
      }
    }

    // Mark tracks as inactive in local state
    userTracksState.setUserTracksActive(currentUserId, false);

    // Persist the inactive state to database
    for (const track of userTracks) {
      authFetchJson(`/api/rooms/${roomId}/user-tracks`, 'PATCH', {
        trackId: track.id,
        isActive: false,
      }).catch(err => console.error('Failed to mark track as inactive:', err));
    }

    await realtimeRef.current?.disconnect();
    await cloudflareRef.current?.leaveRoom();

    // Leave native bridge P2P room and clean up callbacks
    const bridgeState = useBridgeAudioStore.getState();
    if (bridgeState.isConnected) {
      nativeBridge.leaveRoom();
      nativeBridge.removeAllListeners('peerConnected');
      nativeBridge.removeAllListeners('peerDisconnected');

      // Clear native bridge audio callbacks
      const audioEngine = getBrowserAudioEngine();
      if (audioEngine) {
        audioEngine.setNativeBridgeCallbacks(null, null, null);
      }
      console.log('[useRoom] Native bridge left room and cleaned up');
    }

    // Clear song broadcast callbacks since we're leaving
    setSongBroadcastCallbacks(null);

    // NOTE: Room cleanup is handled server-side, not by clients.
    // Client-side deletion was removed due to race conditions causing
    // rooms to be incorrectly deleted while other users were still present.

    realtimeRef.current = null;
    cloudflareRef.current = null;

    // Clean up the audio engine
    destroyEngine();

    // Use getState() to access reset
    useRoomStore.getState().reset();
    usePermissionsStore.getState().reset();
  }, [roomId, destroyEngine, statsEndSession]);

  // Queue management (track library - not playback)
  const addTrack = useCallback(async (track: BackingTrack) => {
    console.log('addTrack called with:', { id: track.id, name: track.name, url: track.url, youtubeId: track.youtubeId });

    // Get fresh state and functions
    const { queue: freshQueue, addToQueue, setCurrentTrack, setQueue } = useRoomStore.getState();

    addToQueue(track);

    const updatedQueue = {
      ...freshQueue,
      tracks: [...freshQueue.tracks, track],
    };

    realtimeRef.current?.broadcastQueueUpdate(updatedQueue);

    // Persist track to database (both file uploads and YouTube tracks)
    try {
      const response = await authFetchJson(`/api/rooms/${roomId}/tracks`, 'POST', track);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to persist track:', response.status, errorData);
      } else {
        const savedTrack = await response.json();
        console.log('Track persisted to database:', savedTrack);
      }
    } catch (err) {
      console.error('Failed to persist track:', err);
    }

    // If this is the first track, set it as current
    if (freshQueue.tracks.length === 0) {
      console.log('Setting as current track (first in queue)');
      setCurrentTrack(track);
      setQueue({ ...updatedQueue, currentIndex: 0 });
    }
  }, [roomId]);

  const removeTrack = useCallback(async (trackId: string) => {
    // Get fresh state and functions
    const { queue: freshQueue, removeFromQueue } = useRoomStore.getState();

    removeFromQueue(trackId);

    const updatedQueue = {
      ...freshQueue,
      tracks: freshQueue.tracks.filter((t) => t.id !== trackId),
    };

    realtimeRef.current?.broadcastQueueUpdate(updatedQueue);

    // Remove track from database
    try {
      await authFetch(`/api/rooms/${roomId}/tracks?trackId=${trackId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Failed to delete track:', err);
    }
  }, [roomId]);

  // Chat
  const sendMessage = useCallback((message: string) => {
    // Prevent blank messages from being sent
    const trimmedMessage = message?.trim();
    if (!trimmedMessage) return;

    realtimeRef.current?.broadcastChat(trimmedMessage);
    useRoomStore.getState().addMessage({
      type: 'chat',
      userId: userIdRef.current,
      content: trimmedMessage,
      timestamp: new Date().toISOString(),
    });

    // Track message for stats
    trackMessage();
  }, [trackMessage]);

  // Mute user
  const muteUser = useCallback((userId: string, muted: boolean) => {
    useRoomStore.getState().updateUser(userId, { isMuted: muted });
    // Apply mute to audio engine locally (for immediate feedback)
    audioSetRemoteMuted(userId, muted);
    // Broadcast to sync all other users
    realtimeRef.current?.broadcastMute(userId, muted);
  }, [audioSetRemoteMuted]);

  // Set user volume
  const setUserVolume = useCallback((userId: string, volume: number) => {
    useRoomStore.getState().updateUser(userId, { volume });
    // Apply volume to audio engine locally (for immediate feedback)
    audioSetRemoteVolume(userId, volume);
    // Broadcast to sync all other users
    realtimeRef.current?.broadcastVolume(userId, volume);
  }, [audioSetRemoteVolume]);

  // Loop track management
  const addLoopTrack = useCallback(async (track: LoopTrackState) => {
    const loopTracksStore = useLoopTracksStore.getState();
    loopTracksStore.loadTracks([track]);

    // Persist to database
    try {
      await authFetchJson(`/api/rooms/${roomId}/loop-tracks`, 'POST', track);
    } catch (err) {
      console.error('Failed to persist loop track:', err);
    }

    // Broadcast to other users
    realtimeRef.current?.broadcastLoopTrackAdd(track);
  }, [roomId]);

  const removeLoopTrack = useCallback(async (trackId: string) => {
    const loopTracksStore = useLoopTracksStore.getState();
    loopTracksStore.removeTrack(trackId);

    // Delete from database (no longer need requesterId - server uses JWT)
    try {
      await authFetch(`/api/rooms/${roomId}/loop-tracks?trackId=${trackId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.error('Failed to delete loop track:', err);
    }

    // Broadcast to other users
    realtimeRef.current?.broadcastLoopTrackRemove(trackId);
  }, [roomId]);

  const updateLoopTrack = useCallback(async (trackId: string, updates: Partial<LoopTrackState>) => {
    const loopTracksStore = useLoopTracksStore.getState();
    loopTracksStore.updateTrack(trackId, updates);

    // Persist to database (no longer need requesterId - server uses JWT)
    try {
      await authFetchJson(`/api/rooms/${roomId}/loop-tracks`, 'PATCH', { trackId, ...updates });
    } catch (err) {
      console.error('Failed to update loop track:', err);
    }

    // Broadcast to other users
    realtimeRef.current?.broadcastLoopTrackUpdate(trackId, updates);
  }, [roomId]);

  const playLoopTrack = useCallback((trackId: string, syncTimestamp?: number, loopStartBeat?: number) => {
    const loopTracksStore = useLoopTracksStore.getState();
    const timestamp = syncTimestamp || Date.now();
    loopTracksStore.setTrackPlaying(trackId, true, timestamp);

    // Broadcast to other users
    realtimeRef.current?.broadcastLoopTrackPlay(trackId, timestamp, loopStartBeat || 0);
  }, []);

  const stopLoopTrack = useCallback((trackId: string) => {
    const loopTracksStore = useLoopTracksStore.getState();
    loopTracksStore.setTrackPlaying(trackId, false);

    // Broadcast to other users
    realtimeRef.current?.broadcastLoopTrackStop(trackId);
  }, []);

  // Quality/Latency settings
  const setQualityPreset = useCallback((preset: QualityPresetName) => {
    cloudflareRef.current?.setQualityPreset(preset);
    usePerformanceSyncStore.getState().setActivePreset(preset);
  }, []);

  const setCustomEncodingSettings = useCallback((settings: Partial<OpusEncodingSettings>) => {
    cloudflareRef.current?.setCustomEncodingSettings(settings);
    usePerformanceSyncStore.getState().setCustomEncodingSettings(settings);
    usePerformanceSyncStore.getState().setActivePreset('custom');
  }, []);

  const getCloudflareRef = useCallback(() => cloudflareRef.current, []);
  const getRealtimeManager = useCallback(() => realtimeRef.current, []);
  const broadcastLayoutState = useCallback((layoutState: Omit<RoomLayoutState, 'updatedBy' | 'timestamp'>) => {
    realtimeRef.current?.broadcastLayoutState(layoutState);
  }, []);

  // Permission management
  const updateUserRole = useCallback(async (targetUserId: string, role: RoomRole) => {
    // Update permissions store
    usePermissionsStore.getState().updateMemberRole(targetUserId, role);

    // Persist to database (performedBy is now derived from JWT on server)
    try {
      await authFetchJson(`/api/rooms/${roomId}/permissions`, 'PATCH', {
        userId: targetUserId,
        role,
      });
    } catch (err) {
      console.error('Failed to update role:', err);
    }

    // Broadcast to other users
    realtimeRef.current?.broadcastRoleUpdate(targetUserId, role);
  }, [roomId]);

  const updateUserPermissions = useCallback(async (
    targetUserId: string,
    customPermissions: Partial<RoomPermissions> | null
  ) => {
    const permissionsStore = usePermissionsStore.getState();

    if (customPermissions === null) {
      permissionsStore.clearMemberCustomPermissions(targetUserId);
    } else {
      permissionsStore.updateMemberPermissions(targetUserId, customPermissions);
    }

    // Persist to database (performedBy is now derived from JWT on server)
    try {
      await authFetchJson(`/api/rooms/${roomId}/permissions`, 'PATCH', {
        userId: targetUserId,
        customPermissions,
        clearCustom: customPermissions === null,
      });
    } catch (err) {
      console.error('Failed to update permissions:', err);
    }

    // Broadcast to other users
    realtimeRef.current?.broadcastCustomPermissionsUpdate(targetUserId, customPermissions);
  }, [roomId]);

  const kickUser = useCallback(async (targetUserId: string) => {
    // Remove from permissions store
    usePermissionsStore.getState().removeMember(targetUserId);

    // Persist to database (performedBy is now derived from JWT on server)
    try {
      await authFetch(
        `/api/rooms/${roomId}/permissions?userId=${targetUserId}`,
        { method: 'DELETE' }
      );
    } catch (err) {
      console.error('Failed to kick user:', err);
    }

    // Broadcast to other users
    realtimeRef.current?.broadcastMemberKick(targetUserId);
  }, [roomId]);

  const banUser = useCallback(async (targetUserId: string, reason?: string) => {
    // Remove from permissions store
    usePermissionsStore.getState().removeMember(targetUserId);

    // Persist to database (performedBy is now derived from JWT on server)
    try {
      const params = new URLSearchParams({
        userId: targetUserId,
        ban: 'true',
      });
      if (reason) params.set('reason', reason);

      await authFetch(`/api/rooms/${roomId}/permissions?${params}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to ban user:', err);
    }

    // Broadcast to other users
    realtimeRef.current?.broadcastMemberBan(targetUserId, reason);
  }, [roomId]);

  // Broadcast user track updates (for real-time sync of armed/muted/volume state)
  const broadcastUserTrackUpdate = useCallback((trackId: string, updates: Partial<UserTrack>) => {
    realtimeRef.current?.broadcastUserTrackUpdate(trackId, updates);
  }, []);

  // Broadcast new user track creation
  const broadcastUserTrackAdd = useCallback((track: UserTrack) => {
    realtimeRef.current?.broadcastUserTrackAdd(track);
    // Update broadcast connections so the new track's audio is included in WebRTC stream
    const audioEngine = getBrowserAudioEngine();
    if (audioEngine?.updateBroadcastConnections) {
      audioEngine.updateBroadcastConnections();
      console.log('[useRoom] Updated broadcast connections after new track added');
    }
  }, []);

  // Broadcast tempo updates (for real-time sync of BPM/time signature)
  const broadcastTempoUpdate = useCallback((tempo: number, source: string) => {
    realtimeRef.current?.broadcastTempoUpdate(tempo, source);
  }, []);

  const broadcastTempoSource = useCallback((source: string) => {
    realtimeRef.current?.broadcastTempoSource(source);
  }, []);

  const broadcastTimeSignature = useCallback((beatsPerBar: number, beatUnit: number) => {
    realtimeRef.current?.broadcastTimeSignature(beatsPerBar, beatUnit);
  }, []);

  const broadcastKeyUpdate = useCallback((key: string | null, keyScale: 'major' | 'minor' | null, keySource: string) => {
    realtimeRef.current?.broadcastKeyUpdate(key, keyScale, keySource);
  }, []);

  // Song playback broadcasts (for multi-track timeline sync)
  const broadcastSongPlay = useCallback((
    songId: string,
    currentTime: number,
    syncTime: number,
    trackStates: Array<{ trackRefId: string; muted: boolean; solo: boolean; volume: number }>
  ) => {
    realtimeRef.current?.broadcastSongPlay(songId, currentTime, syncTime, trackStates);
  }, []);

  const broadcastSongPause = useCallback((songId: string, currentTime: number) => {
    realtimeRef.current?.broadcastSongPause(songId, currentTime);
  }, []);

  const broadcastSongSeek = useCallback((songId: string, seekTime: number, syncTime: number) => {
    realtimeRef.current?.broadcastSongSeek(songId, seekTime, syncTime);
  }, []);

  const broadcastSongSelect = useCallback((songId: string) => {
    realtimeRef.current?.broadcastSongSelect(songId);
  }, []);

  const broadcastSongTrackStates = useCallback((
    songId: string,
    trackStates: Array<{ trackRefId: string; muted: boolean; solo: boolean; volume: number }>
  ) => {
    realtimeRef.current?.broadcastSongTrackStates(songId, trackStates);
  }, []);

  const broadcastSongPosition = useCallback((
    songId: string,
    currentTime: number,
    syncTimestamp: number,
    isPlaying: boolean
  ) => {
    realtimeRef.current?.broadcastSongPosition(songId, currentTime, syncTimestamp, isPlaying);
  }, []);

  // Broadcast stem toggle - syncs stem mute/unmute to all room members
  const broadcastStemToggle = useCallback((trackId: string, stem: string, enabled: boolean) => {
    // Apply to local audio engine
    audioToggleStem(stem, enabled);
    // Broadcast to other users
    realtimeRef.current?.broadcastStemToggle(trackId, stem, enabled);
  }, [audioToggleStem]);

  // Broadcast stem volume - syncs stem volume changes to all room members
  const broadcastStemVolume = useCallback((trackId: string, stem: string, volume: number) => {
    // Apply to local audio engine
    audioSetStemVolume(stem, volume);
    // Broadcast to other users
    realtimeRef.current?.broadcastStemVolume(trackId, stem, volume);
  }, [audioSetStemVolume]);

  const broadcastBackingTrackVolume = useCallback((volume: number) => {
    realtimeRef.current?.broadcastBackingTrackVolume(volume);
  }, []);

  // WS3: Auto-broadcast tempo/time-signature changes when we're the master
  // This integrates the useTempoRealtimeBroadcast hook that was previously unused,
  // ensuring BPM/key/timesig changes auto-broadcast whenever the local user modifies them.
  const tempoBroadcastTempoUpdate = useCallback((tempo: number, source: string) => {
    if (useRoomStore.getState().isMaster) {
      realtimeRef.current?.broadcastTempoUpdate(tempo, source);
    }
  }, []);

  const tempoBroadcastSource = useCallback((source: string) => {
    if (useRoomStore.getState().isMaster) {
      realtimeRef.current?.broadcastTempoSource(source);
    }
  }, []);

  const tempoBroadcastTimeSig = useCallback((beatsPerBar: number, beatUnit: number) => {
    if (useRoomStore.getState().isMaster) {
      realtimeRef.current?.broadcastTimeSignature(beatsPerBar, beatUnit);
    }
  }, []);

  useTempoRealtimeBroadcast(tempoBroadcastTempoUpdate, tempoBroadcastSource, tempoBroadcastTimeSig);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leave();
    };
  }, [leave]);

  return {
    room,
    users: Array.from(users.values()),
    currentUser,
    isMaster,
    isConnected,
    isJoining,
    error,
    join,
    leave,
    addTrack,
    removeTrack,
    sendMessage,
    muteUser,
    setUserVolume,
    // Loop track controls
    addLoopTrack,
    removeLoopTrack,
    updateLoopTrack,
    playLoopTrack,
    stopLoopTrack,
    // Quality/Latency settings
    setQualityPreset,
    setCustomEncodingSettings,
    getCloudflareRef,
    getRealtimeManager,
    // Permission management
    updateUserRole,
    updateUserPermissions,
    kickUser,
    banUser,
    // Real-time broadcast functions
    broadcastUserTrackAdd,
    broadcastUserTrackUpdate,
    broadcastLayoutState,
    broadcastTempoUpdate,
    broadcastTempoSource,
    broadcastTimeSignature,
    broadcastKeyUpdate,
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
    // Backing track volume
    broadcastBackingTrackVolume,
  };
}
