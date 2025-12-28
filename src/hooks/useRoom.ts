'use client';

import { useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { RealtimeRoomManager } from '@/lib/supabase/realtime';
import { CloudflareCalls } from '@/lib/cloudflare/calls';
import { useRoomStore } from '@/stores/room-store';
import { useAudioStore } from '@/stores/audio-store';
import { useUserTracksStore } from '@/stores/user-tracks-store';
import { useLoopTracksStore } from '@/stores/loop-tracks-store';
import { useAuthStore } from '@/stores/auth-store';
import { useAudioEngine } from './useAudioEngine';
import type { User, Room, BackingTrack, TrackQueue, UserTrack } from '@/types';
import type { LoopTrackState } from '@/types/loops';

interface UseRoomOptions {
  onUserJoined?: (user: User) => void;
  onUserLeft?: (userId: string) => void;
  onTrackChanged?: (track: BackingTrack | null) => void;
  onError?: (error: Error) => void;
}

export function useRoom(roomId: string, options: UseRoomOptions = {}) {
  const realtimeRef = useRef<RealtimeRoomManager | null>(null);
  const cloudflareRef = useRef<CloudflareCalls | null>(null);

  // Use authenticated user ID if available, otherwise generate a random one for anonymous users
  // This is initialized once, but updated in join() if auth state changes
  const initialAuthUser = useAuthStore.getState().user;
  const userIdRef = useRef<string>(initialAuthUser?.id || uuidv4());

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
    loadBackingTrack,
    playBackingTrack,
    pauseBackingTrack,
    seekTo,
    updateFromStats,
    destroyEngine,
    enableBroadcast,
    disableBroadcast,
  } = useAudioEngine();

  // Join room - returns true on success, false on failure
  const join = useCallback(async (userName: string, instrument?: string): Promise<boolean> => {
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

    try {
      // Get fresh auth state in case user logged in after hook initialized
      const authUser = useAuthStore.getState().user;

      // Update userIdRef to use authenticated user ID if available
      if (authUser?.id && userIdRef.current !== authUser.id) {
        userIdRef.current = authUser.id;
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
        const roomResponse = await fetch(`/api/rooms?id=${roomId}`);
        if (!roomResponse.ok) {
          // Room doesn't exist, create it
          await fetch('/api/rooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: roomId,
              name: `Room ${roomId}`,
              createdBy: user.id,
            }),
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
        const tracksResponse = await fetch(`/api/rooms/${roomId}/user-tracks`);
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
              fetch(`/api/rooms/${roomId}/user-tracks`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  trackId: track.id,
                  userId: user.id,
                  ownerUserId: user.id,
                  isActive: true,
                }),
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
        const loopTracksResponse = await fetch(`/api/rooms/${roomId}/loop-tracks`);
        if (loopTracksResponse.ok) {
          const persistedLoopTracks: LoopTrackState[] = await loopTracksResponse.json();
          const loopTracksState = useLoopTracksStore.getState();
          loopTracksState.loadTracks(persistedLoopTracks);
          console.log(`Loaded ${persistedLoopTracks.length} loop tracks from database`);
        }
      } catch (err) {
        console.error('Failed to load loop tracks:', err);
      }

      // Create a default track if user has none
      if (userTracks.length === 0) {
        userTracks = userTracksState.getTracksByUser(user.id);
        if (userTracks.length === 0) {
          const newTrack = userTracksState.addTrack(user.id, 'Track 1', undefined, user.name);
          userTracks = [newTrack];

          // Persist the new track
          fetch(`/api/rooms/${roomId}/user-tracks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTrack),
          }).catch(err => console.error('Failed to persist new track:', err));
        }
      }

      // Use the first track's audio settings for capture
      const firstTrack = userTracks[0];
      const trackSettings = firstTrack?.audioSettings;

      // Start audio capture with track settings (device, channel config, etc.)
      // This sets up local mic → effects → local output
      await startCapture(trackSettings);

      // Enable broadcast to get the unified stream for WebRTC
      // This includes: mic + effects + MIDI/synth audio
      // Much lower latency than raw mic (10ms Opus frames, post-effects audio)
      const broadcastStream = enableBroadcast();
      if (!broadcastStream) {
        throw new Error('Failed to enable audio broadcast');
      }

      console.log('[useRoom] Using broadcast stream for WebRTC (mic + effects + MIDI)');

      // Initialize Cloudflare Calls
      const cloudflare = new CloudflareCalls(roomId, user.id);
      await cloudflare.initialize();

      cloudflare.setOnRemoteStream((userId, remoteStream) => {
        addRemoteStream(userId, remoteStream);
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

      // Join room with the unified broadcast stream (includes mic + effects + MIDI)
      await cloudflare.joinRoom(broadcastStream);
      cloudflareRef.current = cloudflare;

      // Initialize realtime connection
      const realtime = new RealtimeRoomManager(roomId, user.id);

      realtime.on('connected', async () => {
        setConnected(true);
        setJoining(false);

        // First user to connect becomes master by default
        // This ensures playback controls work immediately
        // Will be corrected by presence:sync if needed
        setIsMaster(true);
        updateUser(user.id, { isMaster: true });

        // Load existing tracks from database (includes both file uploads and YouTube tracks)
        try {
          const response = await fetch(`/api/rooms/${roomId}/tracks`);
          if (response.ok) {
            const tracks = await response.json();
            if (tracks.length > 0) {
              console.log('Loaded tracks from database:', tracks.length, 'tracks');
              tracks.forEach((t: BackingTrack) => {
                console.log(`  - ${t.name} (${t.youtubeId ? 'YouTube: ' + t.youtubeId : 'file upload'})`);
              });
              setQueue({
                tracks,
                currentIndex: 0,
                isPlaying: false,
                currentTime: 0,
                syncTimestamp: 0,
              });
              setCurrentTrack(tracks[0]);
            }
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
          }
        });

        // First user becomes master
        const allUsers = Object.values(state).flat();
        if (allUsers.length === 1 && allUsers[0].id === user.id) {
          setIsMaster(true);
          updateUser(user.id, { isMaster: true });
        }
      });

      realtime.on('presence:join', (data) => {
        const { users: newUsers } = data as { users: User[] };
        newUsers.forEach((u) => {
          if (u.id !== user.id) {
            addUser(u);
            options.onUserJoined?.(u);
          }
        });
      });

      realtime.on('presence:leave', (data) => {
        const { users: leftUsers } = data as { users: User[] };
        const userTracksStore = useUserTracksStore.getState();
        leftUsers.forEach((u) => {
          removeUser(u.id);
          removeRemoteStream(u.id);
          // Mark their tracks as inactive (greyed out)
          userTracksStore.setUserTracksActive(u.id, false);
          options.onUserLeft?.(u.id);
        });
      });

      realtime.on('track:play', async (data) => {
        const payload = data as { trackId: string; timestamp: number; syncTime: number };
        const track = queue.tracks.find((t) => t.id === payload.trackId);
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
      });

      realtime.on('track:next', () => {
        nextTrack();
      });

      realtime.on('user:mute', (data) => {
        const payload = data as { targetUserId: string; isMuted: boolean };
        updateUser(payload.targetUserId, { isMuted: payload.isMuted });
      });

      realtime.on('user:volume', (data) => {
        const payload = data as { targetUserId: string; volume: number };
        updateUser(payload.targetUserId, { volume: payload.volume });
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
    } catch (err) {
      setError((err as Error).message);
      setJoining(false);
      options.onError?.(err as Error);
      return false;
    }
  }, [roomId, initialize, startCapture, addRemoteStream, removeRemoteStream, updateFromStats, loadBackingTrack, playBackingTrack, pauseBackingTrack, seekTo, options]);

  // Leave room
  const leave = useCallback(async () => {
    // Get current user before disconnecting
    const currentUserId = userIdRef.current;

    // Check if we're the last user before disconnecting
    const userCount = realtimeRef.current?.getUserCount() ?? 0;
    const isLastUser = userCount <= 1;

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
      fetch(`/api/rooms/${roomId}/user-tracks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId: track.id,
          isActive: false,
        }),
      }).catch(err => console.error('Failed to mark track as inactive:', err));
    }

    await realtimeRef.current?.disconnect();
    await cloudflareRef.current?.leaveRoom();

    // If we were the last user, destroy the room and its tracks
    if (isLastUser && roomId) {
      try {
        await fetch(`/api/rooms?id=${roomId}`, {
          method: 'DELETE',
        });
        console.log('Room destroyed after last user left');
      } catch (err) {
        console.error('Failed to destroy room:', err);
      }
    }

    realtimeRef.current = null;
    cloudflareRef.current = null;

    // Disable broadcast before destroying engine
    disableBroadcast();

    // Clean up the audio engine
    destroyEngine();

    // Use getState() to access reset
    useRoomStore.getState().reset();
  }, [roomId, destroyEngine, disableBroadcast]);

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
      const response = await fetch(`/api/rooms/${roomId}/tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(track),
      });

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
      await fetch(`/api/rooms/${roomId}/tracks?trackId=${trackId}`, {
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
  }, []);

  // Mute user
  const muteUser = useCallback((userId: string, muted: boolean) => {
    useRoomStore.getState().updateUser(userId, { isMuted: muted });
    realtimeRef.current?.broadcastMute(userId, muted);
  }, []);

  // Set user volume
  const setUserVolume = useCallback((userId: string, volume: number) => {
    useRoomStore.getState().updateUser(userId, { volume });
    realtimeRef.current?.broadcastVolume(userId, volume);
  }, []);

  // Loop track management
  const addLoopTrack = useCallback(async (track: LoopTrackState) => {
    const loopTracksStore = useLoopTracksStore.getState();
    loopTracksStore.loadTracks([track]);

    // Persist to database
    try {
      await fetch(`/api/rooms/${roomId}/loop-tracks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(track),
      });
    } catch (err) {
      console.error('Failed to persist loop track:', err);
    }

    // Broadcast to other users
    realtimeRef.current?.broadcastLoopTrackAdd(track);
  }, [roomId]);

  const removeLoopTrack = useCallback(async (trackId: string) => {
    const loopTracksStore = useLoopTracksStore.getState();
    loopTracksStore.removeTrack(trackId);

    // Delete from database
    try {
      await fetch(`/api/rooms/${roomId}/loop-tracks?trackId=${trackId}`, {
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

    // Persist to database
    try {
      await fetch(`/api/rooms/${roomId}/loop-tracks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId, ...updates }),
      });
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
  };
}
