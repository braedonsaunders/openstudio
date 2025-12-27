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

      realtime.on('connected', () => {
        setConnected(true);
        setJoining(false);
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
          await loadBackingTrack(track);
          playBackingTrack(payload.syncTime, payload.timestamp);
          setQueuePlaying(true);
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
          timestamp: payload.timestamp,
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
    await realtimeRef.current?.disconnect();
    await cloudflareRef.current?.leaveRoom();

    realtimeRef.current = null;
    cloudflareRef.current = null;

    reset();
  }, [reset]);

  // Master controls
  const play = useCallback(async () => {
    if (!isMaster || !currentTrack) return;

    const syncTime = Date.now() + 100; // 100ms in future for sync
    await loadBackingTrack(currentTrack);
    playBackingTrack(syncTime, queue.currentTime);

    realtimeRef.current?.broadcastPlay(currentTrack.id, queue.currentTime, syncTime);
    setQueuePlaying(true);
  }, [isMaster, currentTrack, loadBackingTrack, playBackingTrack, queue.currentTime, setQueuePlaying]);

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
    addToQueue(track);

    const updatedQueue = {
      ...queue,
      tracks: [...queue.tracks, track],
    };

    realtimeRef.current?.broadcastQueueUpdate(updatedQueue);

    // If this is the first track, set it as current
    if (queue.tracks.length === 0) {
      setCurrentTrack(track);
      setQueue({ ...updatedQueue, currentIndex: 0 });
    }
  }, [queue, addToQueue, setCurrentTrack, setQueue]);

  const removeTrack = useCallback((trackId: string) => {
    removeFromQueue(trackId);

    const updatedQueue = {
      ...queue,
      tracks: queue.tracks.filter((t) => t.id !== trackId),
    };

    realtimeRef.current?.broadcastQueueUpdate(updatedQueue);
  }, [queue, removeFromQueue]);

  const skipToNext = useCallback(() => {
    if (!isMaster) return;

    nextTrack();
    realtimeRef.current?.broadcastNextTrack(queue.currentIndex + 1);
  }, [isMaster, nextTrack, queue.currentIndex]);

  // Chat
  const sendMessage = useCallback((message: string) => {
    realtimeRef.current?.broadcastChat(message);
    addMessage({
      type: 'chat',
      userId: userIdRef.current,
      content: message,
      timestamp: Date.now(),
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
    sendMessage,
    muteUser,
    setUserVolume,
  };
}
