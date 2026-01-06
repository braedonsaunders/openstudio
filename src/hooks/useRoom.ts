'use client';

import { useCallback, useEffect, useRef } from 'react';
import { RealtimeRoomManager } from '@/lib/supabase/realtime';
import { CloudflareCalls } from '@/lib/cloudflare/calls';
import { authFetch, authFetchJson } from '@/lib/auth-fetch';

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
import type { QualityPresetName, OpusEncodingSettings } from '@/types';
import { useAudioEngine } from './useAudioEngine';
import { useStatsTracker } from './useStatsTracker';
import type { User, Room, BackingTrack, TrackQueue, UserTrack } from '@/types';
import type { LoopTrackState } from '@/types/loops';
import type { RoomRole, RoomPermissions, RoomMember } from '@/types/permissions';
import type { SongTrackReference } from '@/types/songs';

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
    queue,
    currentTrack,
    isConnected,
    isJoining,
    error,
  } = useRoomStore();

  const {
    initialize,
    startCapture,
    addRemoteStream,
    removeRemoteStream,
    setRemoteVolume: audioSetRemoteVolume,
    setRemoteMuted: audioSetRemoteMuted,
    setRemoteCompensationDelay,
    loadBackingTrack,
    playBackingTrack,
    pauseBackingTrack,
    seekTo,
    updateFromStats,
    destroyEngine,
    // For connecting MediaStream to TrackAudioProcessor for monitoring
    getOrCreateTrackProcessor,
    setTrackMediaStreamInput,
    updateTrackState,
  } = useAudioEngine();

  // Stats tracking for gamification
  const {
    startSession: statsStartSession,
    endSession: statsEndSession,
    trackCollaborator,
    trackMessage,
    trackRoomCreated,
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
      setQueuePlaying,
      nextTrack,
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

      // Initialize audio engine
      await initialize();

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

      // Use the first track's audio settings for capture
      const firstTrack = userTracks[0];
      const trackSettings = firstTrack?.audioSettings;

      // Start audio capture with track settings (device, channel config, etc.)
      // Skip audio capture in listener mode - listeners only receive, not send
      let stream: MediaStream | undefined;
      let broadcastStream: MediaStream | undefined;

      if (!listenerMode) {
        const bridgeState = useBridgeAudioStore.getState();
        const useBridge = bridgeState.isConnected && bridgeState.preferNativeBridge;

        if (useBridge) {
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
          const { useAudioEngineStore } = require('@/stores/audio-engine-store');
          const audioEngine = useAudioEngineStore.getState().engine;
          if (audioEngine) {
            broadcastStream = audioEngine.createBroadcastStream() || undefined;
            console.log('[useRoom] Created broadcast stream for native bridge WebRTC:', broadcastStream ? 'success' : 'failed');
          }
        } else {
          // WEB AUDIO MODE: Audio flows through getUserMedia -> TrackAudioProcessor -> WebRTC
          stream = await startCapture(trackSettings);

          // Connect MediaStream to TrackAudioProcessor for each track (web audio monitoring)
          // This allows users to hear themselves through the effects chain when monitoring is enabled
          if (stream) {
            for (const track of userTracks) {
              // Create/get the track processor
              getOrCreateTrackProcessor(track.id, track.audioSettings);

              // Connect the MediaStream to the processor
              await setTrackMediaStreamInput(track.id, stream, {
                channelConfig: track.audioSettings.channelConfig,
              });

              // Set the track state - send raw monitoringEnabled, TrackAudioProcessor handles its own calculation
              const monitoringEnabled = track.audioSettings.directMonitoring ?? true;
              updateTrackState(track.id, {
                isArmed: track.isArmed,
                isMuted: track.isMuted,
                isSolo: track.isSolo,
                volume: track.volume,
                inputGain: track.audioSettings.inputGain || 0,
                monitoringEnabled: monitoringEnabled,
              });

              console.log(`[useRoom] Connected MediaStream to track ${track.id}, armed: ${track.isArmed}, monitoringEnabled: ${monitoringEnabled}`);
            }

            // For web audio mode, also create a broadcast stream from track processors
            const { useAudioEngineStore } = require('@/stores/audio-engine-store');
            const audioEngine = useAudioEngineStore.getState().engine;
            if (audioEngine) {
              broadcastStream = audioEngine.createBroadcastStream() || undefined;
              // If broadcast stream creation failed, fall back to raw getUserMedia stream
              if (!broadcastStream) {
                broadcastStream = stream;
                console.log('[useRoom] Falling back to raw getUserMedia stream for WebRTC');
              } else {
                console.log('[useRoom] Created broadcast stream from track processors');
              }
            } else {
              broadcastStream = stream;
            }
          }
        }
      } else {
        console.log('[useRoom] Listener mode - skipping audio capture');
      }

      // Initialize Cloudflare Calls
      const cloudflare = new CloudflareCalls(roomId, user.id);
      await cloudflare.initialize();

      cloudflare.setOnRemoteStream(async (userId, remoteStream) => {
        // Await to ensure AudioContext is resumed on iOS Safari before proceeding
        await addRemoteStream(userId, remoteStream);
        options.onUserJoined?.(users.get(userId) || { id: userId, name: 'Unknown', volume: 1, latency: 0, jitterBuffer: 256, connectionQuality: 'good' });
      });

      cloudflare.setOnRemoteStreamRemoved((userId) => {
        removeRemoteStream(userId);
        options.onUserLeft?.(userId);
      });

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

      // Use broadcast stream (from track processors) for WebRTC, or raw stream as fallback
      await cloudflare.joinRoom(broadcastStream || stream);
      cloudflareRef.current = cloudflare;

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
        if (hasNewUsers && cloudflareRef.current) {
          console.log('[useRoom] New user joined, refreshing remote tracks...');
          try {
            await cloudflareRef.current.refreshRemoteTracks();
          } catch (err) {
            console.error('[useRoom] Failed to refresh remote tracks:', err);
          }
        }

        // CRITICAL: Sync room state to new joiners
        // If we're the master, broadcast current tempo/time signature so new users get the current state
        // This fixes the issue where new users always see 120 BPM regardless of actual room state
        if (hasNewUsers && useRoomStore.getState().isMaster) {
          // Small delay to ensure new user's broadcast handlers are ready
          // The new user needs time to complete subscription before receiving broadcasts
          setTimeout(async () => {
            console.log('[useRoom] Master broadcasting room state to new users...');
            const { useSessionTempoStore } = require('@/stores/session-tempo-store');
            const tempoState = useSessionTempoStore.getState();

            // Broadcast current effective tempo (not just manualTempo)
            // This ensures new joiners get the actual tempo being used
            realtime.broadcastTempoUpdate(tempoState.tempo, tempoState.source);

            // Broadcast current time signature
            realtime.broadcastTimeSignature(tempoState.beatsPerBar, tempoState.beatUnit);

            // Broadcast current tempo source
            realtime.broadcastTempoSource(tempoState.source);

            // Broadcast current key/scale if set
            if (tempoState.key) {
              realtime.broadcastKeyUpdate(tempoState.key, tempoState.keyScale, tempoState.keySource);
            }

            // CRITICAL: Broadcast current queue state so new users (especially listeners)
            // can sync their queue and respond to play/pause/seek events
            const currentQueue = useRoomStore.getState().queue;
            if (currentQueue.tracks.length > 0) {
              console.log(`[useRoom] Broadcasting queue with ${currentQueue.tracks.length} tracks to new users`);
              realtime.broadcastQueueUpdate(currentQueue);
            }

            // Broadcast all user tracks so new joiners see everyone's tracks
            const userTracksStore = useUserTracksStore.getState();
            const allTracks = userTracksStore.getAllTracks();
            for (const track of allTracks) {
              if (track.isActive) {
                await realtime.broadcastUserTrackAdd(track);
              }
            }
            console.log(`[useRoom] Broadcast ${allTracks.filter(t => t.isActive).length} active tracks to new users`);

            // Broadcast current songs list so new joiners can sync
            const { useSongsStore } = require('@/stores/songs-store');
            const songsState = useSongsStore.getState();
            const roomSongs = songsState.getSongsByRoom(roomId);
            if (roomSongs.length > 0) {
              realtime.broadcastSongsSync(roomSongs, songsState.currentSongId);
              console.log(`[useRoom] Broadcast ${roomSongs.length} songs to new users`);
            }
          }, 500);
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
            }
          }
        }
      });

      realtime.on('track:play', async (data) => {
        const payload = data as { trackId: string; timestamp: number; syncTime: number };
        // CRITICAL: Get fresh queue state, not stale closure
        const freshQueue = useRoomStore.getState().queue;
        const track = freshQueue.tracks.find((t) => t.id === payload.trackId);
        if (track) {
          // YouTube tracks are handled by the YouTube player component, not audio engine
          if (track.youtubeId) {
            setQueuePlaying(true);
            return;
          }

          // Ensure audio engine is initialized
          try {
            await initialize();
          } catch (err) {
            console.error('Failed to initialize audio engine for sync:', err);
            return;
          }

          const loadSuccess = await loadBackingTrack(track);
          if (loadSuccess) {
            playBackingTrack(payload.syncTime, payload.timestamp);
            setQueuePlaying(true);
          } else {
            console.error('Failed to load track for playback sync');
          }
        } else {
          console.warn(`[useRoom] track:play received for unknown track ${payload.trackId}, queue has ${freshQueue.tracks.length} tracks`);
        }
      });

      realtime.on('track:pause', () => {
        pauseBackingTrack();
        setQueuePlaying(false);
      });

      realtime.on('track:seek', (data) => {
        const payload = data as { timestamp: number; syncTime: number };
        seekTo(payload.timestamp, payload.syncTime);
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

      realtime.on('track:next', () => {
        nextTrack();
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

      realtime.on('usertrack:settings', (data) => {
        const payload = data as { trackId: string; settings: Partial<UserTrack['audioSettings']>; userId: string };
        if (payload.userId === user.id) return;
        const userTracksStore = useUserTracksStore.getState();
        userTracksStore.updateTrackSettings(payload.trackId, payload.settings);
      });

      realtime.on('usertrack:effects', (data) => {
        const payload = data as { trackId: string; effects: Partial<UserTrack['audioSettings']['effects']>; userId: string };
        if (payload.userId === user.id) return;
        const userTracksStore = useUserTracksStore.getState();
        userTracksStore.updateTrackEffects(payload.trackId, payload.effects);
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

      realtime.on('looptrack:sync', (data) => {
        const payload = data as { tracks: LoopTrackState[]; userId: string };
        if (payload.userId === user.id) return;
        const loopTracksStore = useLoopTracksStore.getState();
        loopTracksStore.loadTracks(payload.tracks);
      });

      // Tempo broadcast handlers - sync BPM/time signature across all clients
      realtime.on('tempo:update', (data) => {
        const payload = data as { tempo: number; source: string; userId: string };
        if (payload.userId === user.id) return;
        const { useSessionTempoStore } = require('@/stores/session-tempo-store');
        const tempoStore = useSessionTempoStore.getState();
        // Only update if the remote user is setting manual tempo
        if (payload.source === 'manual' || payload.source === 'tap') {
          tempoStore.setManualTempo(payload.tempo);
        }
      });

      realtime.on('tempo:source', (data) => {
        const payload = data as { source: string; userId: string };
        if (payload.userId === user.id) return;
        const { useSessionTempoStore } = require('@/stores/session-tempo-store');
        const tempoStore = useSessionTempoStore.getState();
        tempoStore.setSource(payload.source as 'manual' | 'track' | 'analyzer' | 'tap');
      });

      realtime.on('tempo:timesig', (data) => {
        const payload = data as { beatsPerBar: number; beatUnit: number; userId: string };
        if (payload.userId === user.id) return;
        const { useSessionTempoStore } = require('@/stores/session-tempo-store');
        const tempoStore = useSessionTempoStore.getState();
        tempoStore.setTimeSignature(payload.beatsPerBar, payload.beatUnit);
      });

      realtime.on('key:update', (data) => {
        const payload = data as { key: string | null; keyScale: 'major' | 'minor' | null; keySource: string; userId: string };
        if (payload.userId === user.id) return;
        const { useSessionTempoStore } = require('@/stores/session-tempo-store');
        const tempoStore = useSessionTempoStore.getState();
        tempoStore.setKeySource(payload.keySource as 'manual' | 'track' | 'analyzer');
        if (payload.keySource === 'manual') {
          tempoStore.setManualKey(payload.key, payload.keyScale);
        }
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

      realtime.on('permissions:sync', (data) => {
        const payload = data as { members: RoomMember[]; defaultRole: RoomRole; userId: string };
        if (payload.userId === user.id) return;
        const permissionsStore = usePermissionsStore.getState();
        permissionsStore.setMembers(payload.members);
        permissionsStore.setDefaultRole(payload.defaultRole);

        // Update our own permissions if we're in the member list
        const myMember = payload.members.find(m => m.oduserId === user.id);
        if (myMember) {
          permissionsStore.setMyPermissions(myMember.role, myMember.customPermissions);
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

      // Songs CRUD sync handlers
      realtime.on('songs:sync', (data) => {
        const payload = data as { songs: unknown[]; currentSongId: string | null; userId: string };
        if (payload.userId === user.id) return;
        const { useSongsStore } = require('@/stores/songs-store');
        const songsStore = useSongsStore.getState();
        songsStore.setSongs(payload.songs);
        if (payload.currentSongId) {
          songsStore.selectSong(payload.currentSongId);
        }
      });

      realtime.on('songs:create', (data) => {
        const payload = data as { song: unknown; userId: string };
        if (payload.userId === user.id) return;
        const { useSongsStore } = require('@/stores/songs-store');
        const songsStore = useSongsStore.getState();
        // Add the song directly without persisting (it's already on server)
        const songs = new Map(songsStore.songs);
        const song = payload.song as { id: string; [key: string]: unknown };
        songs.set(song.id, song);
        useSongsStore.setState({ songs });
      });

      realtime.on('songs:update', (data) => {
        const payload = data as { songId: string; changes: Record<string, unknown>; userId: string };
        if (payload.userId === user.id) return;
        const { useSongsStore } = require('@/stores/songs-store');
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
        const { useSongsStore } = require('@/stores/songs-store');
        const songsStore = useSongsStore.getState();
        const songs = new Map(songsStore.songs);
        songs.delete(payload.songId);
        useSongsStore.setState({ songs });
      });

      await realtime.connect(user);
      realtimeRef.current = realtime;

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
  }, [roomId, initialize, startCapture, addRemoteStream, removeRemoteStream, updateFromStats, loadBackingTrack, playBackingTrack, pauseBackingTrack, seekTo, options, getOrCreateTrackProcessor, setTrackMediaStreamInput, updateTrackState]);

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

  // Master controls - BULLETPROOF with fresh state
  const play = useCallback(async () => {
    // Get ALL fresh state to avoid stale closure issues
    const { isMaster: freshIsMaster, currentTrack: freshCurrentTrack, queue: freshQueue, setQueuePlaying } = useRoomStore.getState();

    console.log('Play called:', {
      isMaster: freshIsMaster,
      currentTrackId: freshCurrentTrack?.id,
      currentTrackName: freshCurrentTrack?.name,
    });

    if (!freshIsMaster) {
      console.log('Play aborted: not master');
      return;
    }

    if (!freshCurrentTrack) {
      console.log('Play aborted: no current track');
      return;
    }

    // Skip audio engine for YouTube tracks - they use the YouTube player
    if (freshCurrentTrack.youtubeId) {
      console.log('YouTube track, delegating to YouTube player');
      // YouTube playback is handled by YouTubePlayer component
      // Just update state and broadcast
      realtimeRef.current?.broadcastPlay(freshCurrentTrack.id, freshQueue.currentTime, Date.now() + 100);
      setQueuePlaying(true);
      return;
    }

    console.log('Playing uploaded track:', freshCurrentTrack.name, 'URL:', freshCurrentTrack.url);

    // Ensure audio engine is initialized before attempting playback
    try {
      await initialize();
    } catch (err) {
      console.error('Failed to initialize audio engine:', err);
      return;
    }

    const syncTime = Date.now() + 100; // 100ms in future for sync
    console.log('Loading backing track...');
    const loadSuccess = await loadBackingTrack(freshCurrentTrack);

    if (!loadSuccess) {
      console.error('Failed to load backing track, cannot play');
      return;
    }

    console.log('Playing backing track at offset:', freshQueue.currentTime);
    playBackingTrack(syncTime, freshQueue.currentTime);

    realtimeRef.current?.broadcastPlay(freshCurrentTrack.id, freshQueue.currentTime, syncTime);
    setQueuePlaying(true);
  }, [initialize, loadBackingTrack, playBackingTrack]);

  const pause = useCallback(async () => {
    // Get ALL fresh state to avoid stale closure issues
    const { isMaster: freshIsMaster, currentTrack: freshCurrentTrack, setQueueTime, setQueuePlaying } = useRoomStore.getState();

    if (!freshIsMaster || !freshCurrentTrack) {
      console.log('Pause aborted: not master or no current track');
      return;
    }

    // Get the current playback time before pausing
    const { currentTime } = useAudioStore.getState();

    pauseBackingTrack();

    // Save the current time so we can resume from this position
    setQueueTime(currentTime);

    realtimeRef.current?.broadcastPause(freshCurrentTrack.id, currentTime);
    setQueuePlaying(false);
  }, [pauseBackingTrack]);

  const seek = useCallback(async (time: number) => {
    // Get ALL fresh state to avoid stale closure issues
    const { isMaster: freshIsMaster, currentTrack: freshCurrentTrack } = useRoomStore.getState();

    if (!freshIsMaster || !freshCurrentTrack) {
      console.log('Seek aborted: not master or no current track');
      return;
    }

    const syncTime = Date.now() + 100;
    seekTo(time, syncTime);
    realtimeRef.current?.broadcastSeek(freshCurrentTrack.id, time, syncTime);
  }, [seekTo]);

  // Queue management
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

  const skipToNext = useCallback(async () => {
    // Get ALL fresh state to avoid stale closure issues
    const { queue: freshQueue, isMaster: freshIsMaster, nextTrack, setQueuePlaying } = useRoomStore.getState();

    console.log('skipToNext called:', { isMaster: freshIsMaster, currentIndex: freshQueue.currentIndex });

    if (!freshIsMaster) {
      console.log('skipToNext: Not master, ignoring');
      return;
    }

    const nextIndex = freshQueue.currentIndex + 1;

    // Check if there's a next track
    if (nextIndex >= freshQueue.tracks.length) {
      console.log('skipToNext: Already at last track');
      return;
    }

    // Get the target track DIRECTLY
    const targetTrack = freshQueue.tracks[nextIndex];
    if (!targetTrack) {
      console.error('skipToNext: Target track is null');
      return;
    }

    const wasPlaying = useAudioStore.getState().isPlaying;

    console.log('skipToNext: Moving to', targetTrack.name, 'at index', nextIndex);

    // Stop current playback and reset audio state
    pauseBackingTrack();
    useAudioStore.getState().setCurrentTime(0);
    useAudioStore.getState().setDuration(targetTrack.duration || 0);
    useRoomStore.getState().setWaveformData(null);

    nextTrack();
    realtimeRef.current?.broadcastNextTrack(nextIndex);

    // Auto-play if was playing before
    if (wasPlaying) {
      if (targetTrack.youtubeId) {
        realtimeRef.current?.broadcastPlay(targetTrack.id, 0, Date.now() + 100);
        setQueuePlaying(true);
        return;
      }

      try {
        await initialize();
        const loadSuccess = await loadBackingTrack(targetTrack);
        if (loadSuccess) {
          const syncTime = Date.now() + 100;
          playBackingTrack(syncTime, 0);
          realtimeRef.current?.broadcastPlay(targetTrack.id, 0, syncTime);
          setQueuePlaying(true);
        }
      } catch (err) {
        console.error('skipToNext: Error during playback:', err);
      }
    }
  }, [pauseBackingTrack, initialize, loadBackingTrack, playBackingTrack]);

  const skipToPrevious = useCallback(async () => {
    // Get ALL fresh state to avoid stale closure issues
    const { queue: freshQueue, isMaster: freshIsMaster, previousTrack, setQueuePlaying } = useRoomStore.getState();

    console.log('skipToPrevious called:', { isMaster: freshIsMaster, currentIndex: freshQueue.currentIndex });

    if (!freshIsMaster) {
      console.log('skipToPrevious: Not master, ignoring');
      return;
    }

    const prevIndex = freshQueue.currentIndex - 1;

    // Check if there's a previous track
    if (prevIndex < 0) {
      console.log('skipToPrevious: Already at first track');
      return;
    }

    // Get the target track DIRECTLY
    const targetTrack = freshQueue.tracks[prevIndex];
    if (!targetTrack) {
      console.error('skipToPrevious: Target track is null');
      return;
    }

    const wasPlaying = useAudioStore.getState().isPlaying;

    console.log('skipToPrevious: Moving to', targetTrack.name, 'at index', prevIndex);

    // Stop current playback and reset audio state
    pauseBackingTrack();
    useAudioStore.getState().setCurrentTime(0);
    useAudioStore.getState().setDuration(targetTrack.duration || 0);
    useRoomStore.getState().setWaveformData(null);

    previousTrack();
    realtimeRef.current?.broadcastNextTrack(prevIndex);

    // Auto-play if was playing before
    if (wasPlaying) {
      if (targetTrack.youtubeId) {
        realtimeRef.current?.broadcastPlay(targetTrack.id, 0, Date.now() + 100);
        setQueuePlaying(true);
        return;
      }

      try {
        await initialize();
        const loadSuccess = await loadBackingTrack(targetTrack);
        if (loadSuccess) {
          const syncTime = Date.now() + 100;
          playBackingTrack(syncTime, 0);
          realtimeRef.current?.broadcastPlay(targetTrack.id, 0, syncTime);
          setQueuePlaying(true);
        }
      } catch (err) {
        console.error('skipToPrevious: Error during playback:', err);
      }
    }
  }, [pauseBackingTrack, initialize, loadBackingTrack, playBackingTrack]);

  const skipToTrack = useCallback(async (trackIndex: number) => {
    // Get ALL fresh state to avoid stale closure issues
    const { queue: freshQueue, isMaster: freshIsMaster, jumpToTrack, setQueuePlaying } = useRoomStore.getState();

    console.log('skipToTrack called:', {
      requestedIndex: trackIndex,
      currentIndex: freshQueue.currentIndex,
      isMaster: freshIsMaster,
      queueLength: freshQueue.tracks.length,
    });

    if (!freshIsMaster) {
      console.log('skipToTrack: Not master, ignoring');
      return;
    }

    // Validate track index
    if (trackIndex < 0 || trackIndex >= freshQueue.tracks.length) {
      console.warn('skipToTrack: Invalid track index', trackIndex);
      return;
    }

    // Get the ACTUAL track we're switching to - don't rely on store state later
    const targetTrack = freshQueue.tracks[trackIndex];
    if (!targetTrack) {
      console.error('skipToTrack: Target track is null at index', trackIndex);
      return;
    }

    const isSameTrack = trackIndex === freshQueue.currentIndex;
    const wasPlaying = useAudioStore.getState().isPlaying;

    console.log('skipToTrack: Switching to', targetTrack.name, 'at index', trackIndex, 'isSameTrack:', isSameTrack);

    // 1. Stop current playback completely
    pauseBackingTrack();
    useAudioStore.getState().setCurrentTime(0);
    useAudioStore.getState().setDuration(targetTrack.duration || 0);
    useRoomStore.getState().setWaveformData(null);

    // 2. Update store state
    jumpToTrack(trackIndex);
    realtimeRef.current?.broadcastNextTrack(trackIndex);

    // 3. Auto-play if needed - DO THIS DIRECTLY, not via setTimeout
    if (wasPlaying || !isSameTrack) {
      // For YouTube tracks, just update state - the player handles it
      if (targetTrack.youtubeId) {
        console.log('skipToTrack: YouTube track, broadcasting play');
        realtimeRef.current?.broadcastPlay(targetTrack.id, 0, Date.now() + 100);
        setQueuePlaying(true);
        return;
      }

      // For regular tracks, load and play directly with the target track
      console.log('skipToTrack: Loading and playing track directly:', targetTrack.name, targetTrack.url);

      try {
        await initialize();
        const loadSuccess = await loadBackingTrack(targetTrack);
        if (!loadSuccess) {
          console.error('skipToTrack: Failed to load track');
          return;
        }

        const syncTime = Date.now() + 100;
        playBackingTrack(syncTime, 0);
        realtimeRef.current?.broadcastPlay(targetTrack.id, 0, syncTime);
        setQueuePlaying(true);
        console.log('skipToTrack: Playback started for', targetTrack.name);
      } catch (err) {
        console.error('skipToTrack: Error during playback setup:', err);
      }
    }
  }, [pauseBackingTrack, initialize, loadBackingTrack, playBackingTrack]);

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

  const getCloudflareRef = useCallback(() => cloudflareRef.current, []);

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
    queue,
    currentTrack,
    isConnected,
    isJoining,
    error,
    join,
    leave,
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
    // Loop track controls
    addLoopTrack,
    removeLoopTrack,
    updateLoopTrack,
    playLoopTrack,
    stopLoopTrack,
    // Quality/Latency settings
    setQualityPreset,
    getCloudflareRef,
    // Permission management
    updateUserRole,
    updateUserPermissions,
    kickUser,
    banUser,
    // Real-time broadcast functions
    broadcastUserTrackAdd,
    broadcastUserTrackUpdate,
    broadcastTempoUpdate,
    broadcastTempoSource,
    broadcastTimeSignature,
    broadcastKeyUpdate,
    // Song playback broadcasts
    broadcastSongPlay,
    broadcastSongPause,
    broadcastSongSeek,
    broadcastSongSelect,
  };
}
