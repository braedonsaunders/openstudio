'use client';

import { useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { RealtimeRoomManager } from '@/lib/supabase/realtime';
import { CloudflareCalls } from '@/lib/cloudflare/calls';
import { useRoomStore } from '@/stores/room-store';
import { useAudioStore } from '@/stores/audio-store';
import { useAudioEngine } from './useAudioEngine';
import type { User, Room, BackingTrack, TrackQueue } from '@/types';

interface UseRoomOptions {
  onUserJoined?: (user: User) => void;
  onUserLeft?: (userId: string) => void;
  onTrackChanged?: (track: BackingTrack | null) => void;
  onError?: (error: Error) => void;
}

export function useRoom(roomId: string, options: UseRoomOptions = {}) {
  const realtimeRef = useRef<RealtimeRoomManager | null>(null);
  const cloudflareRef = useRef<CloudflareCalls | null>(null);
  const userIdRef = useRef<string>(uuidv4());

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
    setRoom,
    setCurrentUser,
    addUser,
    removeUser,
    updateUser,
    setIsMaster,
    setQueue,
    addToQueue,
    removeFromQueue,
    setCurrentTrack,
    setQueuePlaying,
    setQueueTime,
    nextTrack,
    addMessage,
    setConnected,
    setJoining,
    setError,
    reset,
  } = useRoomStore();

  const { setWebRTCStats } = useAudioStore();

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
  } = useAudioEngine();

  // Join room
  const join = useCallback(async (userName: string, instrument?: string) => {
    if (isJoining || isConnected) return;

    setJoining(true);
    setError(null);

    try {
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

      // Start audio capture
      const stream = await startCapture();

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
        setWebRTCStats(stats);
        updateFromStats({
          jitter: stats.jitter,
          packetLoss: stats.packetsLost,
          roundTripTime: stats.roundTripTime,
        });
      });

      await cloudflare.joinRoom(stream);
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
        leftUsers.forEach((u) => {
          removeUser(u.id);
          removeRemoteStream(u.id);
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
        addMessage({
          type: 'chat',
          userId: payload.userId,
          content: payload.message,
          timestamp: new Date(payload.timestamp).toISOString(),
        });
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
    } catch (err) {
      setError((err as Error).message);
      setJoining(false);
      options.onError?.(err as Error);
    }
  }, [roomId, isJoining, isConnected, setJoining, setError, setCurrentUser, initialize, startCapture, addRemoteStream, removeRemoteStream, setWebRTCStats, updateFromStats, setConnected, addUser, setIsMaster, updateUser, removeUser, queue.tracks, loadBackingTrack, playBackingTrack, setQueuePlaying, pauseBackingTrack, seekTo, setQueue, nextTrack, addMessage, setRoom, options, users]);

  // Leave room
  const leave = useCallback(async () => {
    // Check if we're the last user before disconnecting
    const userCount = realtimeRef.current?.getUserCount() ?? 0;
    const isLastUser = userCount <= 1;

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

    reset();
  }, [reset, roomId]);

  // Master controls
  const play = useCallback(async () => {
    console.log('Play called, isMaster:', isMaster, 'currentTrack:', currentTrack?.id);
    if (!isMaster || !currentTrack) {
      console.log('Play aborted: not master or no current track');
      return;
    }

    // Skip audio engine for YouTube tracks - they use the YouTube player
    if (currentTrack.youtubeId) {
      console.log('YouTube track, delegating to YouTube player');
      // YouTube playback is handled by YouTubePlayer component
      // Just update state and broadcast
      realtimeRef.current?.broadcastPlay(currentTrack.id, queue.currentTime, Date.now() + 100);
      setQueuePlaying(true);
      return;
    }

    console.log('Playing uploaded track:', currentTrack.name, 'URL:', currentTrack.url);

    // Ensure audio engine is initialized before attempting playback
    try {
      await initialize();
    } catch (err) {
      console.error('Failed to initialize audio engine:', err);
      return;
    }

    const syncTime = Date.now() + 100; // 100ms in future for sync
    console.log('Loading backing track...');
    const loadSuccess = await loadBackingTrack(currentTrack);

    if (!loadSuccess) {
      console.error('Failed to load backing track, cannot play');
      return;
    }

    console.log('Playing backing track at offset:', queue.currentTime);
    playBackingTrack(syncTime, queue.currentTime);

    realtimeRef.current?.broadcastPlay(currentTrack.id, queue.currentTime, syncTime);
    setQueuePlaying(true);
  }, [isMaster, currentTrack, initialize, loadBackingTrack, playBackingTrack, queue.currentTime, setQueuePlaying]);

  const pause = useCallback(async () => {
    if (!isMaster || !currentTrack) return;

    pauseBackingTrack();
    realtimeRef.current?.broadcastPause(currentTrack.id, queue.currentTime);
    setQueuePlaying(false);
  }, [isMaster, currentTrack, pauseBackingTrack, queue.currentTime, setQueuePlaying]);

  const seek = useCallback(async (time: number) => {
    if (!isMaster || !currentTrack) return;

    const syncTime = Date.now() + 100;
    seekTo(time, syncTime);
    realtimeRef.current?.broadcastSeek(currentTrack.id, time, syncTime);
  }, [isMaster, currentTrack, seekTo]);

  // Queue management
  const addTrack = useCallback(async (track: BackingTrack) => {
    console.log('addTrack called with:', { id: track.id, name: track.name, url: track.url, youtubeId: track.youtubeId });
    addToQueue(track);

    const updatedQueue = {
      ...queue,
      tracks: [...queue.tracks, track],
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
    if (queue.tracks.length === 0) {
      console.log('Setting as current track (first in queue)');
      setCurrentTrack(track);
      setQueue({ ...updatedQueue, currentIndex: 0 });
    }
  }, [roomId, queue, addToQueue, setCurrentTrack, setQueue]);

  const removeTrack = useCallback(async (trackId: string) => {
    removeFromQueue(trackId);

    const updatedQueue = {
      ...queue,
      tracks: queue.tracks.filter((t) => t.id !== trackId),
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
  }, [roomId, queue, removeFromQueue]);

  const skipToNext = useCallback(() => {
    if (!isMaster) return;

    nextTrack();
    realtimeRef.current?.broadcastNextTrack(queue.currentIndex + 1);
  }, [isMaster, nextTrack, queue.currentIndex]);

  const skipToPrevious = useCallback(() => {
    if (!isMaster) return;

    const { previousTrack } = useRoomStore.getState();
    previousTrack();
    realtimeRef.current?.broadcastNextTrack(Math.max(0, queue.currentIndex - 1));
  }, [isMaster, queue.currentIndex]);

  // Chat
  const sendMessage = useCallback((message: string) => {
    realtimeRef.current?.broadcastChat(message);
    addMessage({
      type: 'chat',
      userId: userIdRef.current,
      content: message,
      timestamp: new Date().toISOString(),
    });
  }, [addMessage]);

  // Mute user
  const muteUser = useCallback((userId: string, muted: boolean) => {
    updateUser(userId, { isMuted: muted });
    realtimeRef.current?.broadcastMute(userId, muted);
  }, [updateUser]);

  // Set user volume
  const setUserVolume = useCallback((userId: string, volume: number) => {
    updateUser(userId, { volume });
    realtimeRef.current?.broadcastVolume(userId, volume);
  }, [updateUser]);

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
    sendMessage,
    muteUser,
    setUserVolume,
  };
}
