import { supabase, getRealtimeChannel, RealtimeChannel } from './client';
import type { User, BackingTrack, RoomMessage, TrackQueue, TrackAudioSettings, TrackEffectsChain, UserTrack } from '@/types';
import type { LoopTrackState } from '@/types/loops';
import type { RoomRole, RoomPermissions, RoomMember } from '@/types/permissions';
import type { SongTrackReference } from '@/types/songs';

export interface RoomState {
  users: Record<string, User>;
  queue: TrackQueue;
  messages: RoomMessage[];
}

/** Full room state payload for state sync protocol (WS2) */
export interface StateSyncPayload {
  requestId: string;
  queue: BackingTrack[];
  currentTrack: BackingTrack | null;
  currentTrackPosition: number;
  isPlaying: boolean;
  tempo: number;
  tempoSource: string;
  timeSignature: { beatsPerBar: number; beatUnit: number };
  key: string | null;
  keyScale: string | null;
  keySource: string;
  userTracks: UserTrack[];
  loopTracks: LoopTrackState[];
  songs: Array<{ id: string; name: string; [key: string]: unknown }>;
  currentSongId: string | null;
  stemMixState: Record<string, { enabled: boolean; volume: number }>;
  permissions: Record<string, unknown>;
  songTrackStates: Record<string, { muted: boolean; solo: boolean; volume: number }>;
  timestamp: number;
}

// Track active channels by room ID to prevent conflicts
const activeChannels = new Map<string, RealtimeChannel>();

export class RealtimeRoomManager {
  private channel: RealtimeChannel | null = null;
  private roomId: string;
  private userId: string;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private connectionState: 'connected' | 'disconnected' | 'reconnecting' = 'disconnected';
  private seekDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private songSeekDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(roomId: string, userId: string) {
    this.roomId = roomId;
    this.userId = userId;
  }

  /**
   * Clean up any existing channel for a room before creating a new connection.
   * This prevents the CLOSED status error on iPad when retrying after a timeout.
   * MUST be called before creating a new RealtimeRoomManager instance.
   */
  static async cleanupExistingChannel(roomId: string): Promise<void> {
    const existingChannel = activeChannels.get(roomId);
    if (existingChannel) {
      console.log('[Realtime] Cleaning up existing channel for room:', roomId);
      try {
        await existingChannel.untrack();
      } catch (err) {
        // Ignore untrack errors - channel may already be disconnected
        console.log('[Realtime] Untrack during cleanup (expected):', err);
      }
      try {
        await supabase.removeChannel(existingChannel);
      } catch (err) {
        console.log('[Realtime] Remove channel during cleanup (expected):', err);
      }
      activeChannels.delete(roomId);
    }

    // Also remove any orphaned channels with the same room pattern
    // This handles edge cases where the channel wasn't tracked in our Map
    const channels = supabase.getChannels();
    for (const channel of channels) {
      if (channel.topic === `realtime:room:${roomId}`) {
        console.log('[Realtime] Removing orphaned channel:', channel.topic);
        try {
          await supabase.removeChannel(channel);
        } catch (err) {
          console.log('[Realtime] Error removing orphaned channel:', err);
        }
      }
    }

    // Small delay to let Supabase clean up server-side state
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Set up all channel event handlers (presence and broadcast)
   * This is extracted into a helper so it can be called on initial connect AND on retry
   */
  private setupChannelHandlers(): void {
    if (!this.channel) return;

    // Track presence
    this.channel.on('presence', { event: 'sync' }, () => {
      const state = this.channel?.presenceState();
      this.emit('presence:sync', state);
    });

    this.channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      this.emit('presence:join', { key, users: newPresences });
    });

    this.channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      this.emit('presence:leave', { key, users: leftPresences });
    });

    // Broadcast events
    this.channel.on('broadcast', { event: 'track:play' }, ({ payload }) => {
      this.emit('track:play', payload);
    });

    this.channel.on('broadcast', { event: 'track:pause' }, ({ payload }) => {
      this.emit('track:pause', payload);
    });

    this.channel.on('broadcast', { event: 'track:seek' }, ({ payload }) => {
      this.emit('track:seek', payload);
    });

    this.channel.on('broadcast', { event: 'track:queue' }, ({ payload }) => {
      this.emit('track:queue', payload);
    });

    this.channel.on('broadcast', { event: 'track:next' }, ({ payload }) => {
      this.emit('track:next', payload);
    });

    this.channel.on('broadcast', { event: 'user:mute' }, ({ payload }) => {
      this.emit('user:mute', payload);
    });

    this.channel.on('broadcast', { event: 'user:volume' }, ({ payload }) => {
      this.emit('user:volume', payload);
    });

    this.channel.on('broadcast', { event: 'chat:message' }, ({ payload }) => {
      this.emit('chat:message', payload);
    });

    this.channel.on('broadcast', { event: 'stem:toggle' }, ({ payload }) => {
      this.emit('stem:toggle', payload);
    });

    this.channel.on('broadcast', { event: 'stem:volume' }, ({ payload }) => {
      this.emit('stem:volume', payload);
    });

    this.channel.on('broadcast', { event: 'ai:generate' }, ({ payload }) => {
      this.emit('ai:generate', payload);
    });

    // User track events
    this.channel.on('broadcast', { event: 'usertrack:add' }, ({ payload }) => {
      this.emit('usertrack:add', payload);
    });

    this.channel.on('broadcast', { event: 'usertrack:remove' }, ({ payload }) => {
      this.emit('usertrack:remove', payload);
    });

    this.channel.on('broadcast', { event: 'usertrack:update' }, ({ payload }) => {
      this.emit('usertrack:update', payload);
    });

    this.channel.on('broadcast', { event: 'usertrack:effects' }, ({ payload }) => {
      this.emit('usertrack:effects', payload);
    });

    this.channel.on('broadcast', { event: 'usertrack:settings' }, ({ payload }) => {
      this.emit('usertrack:settings', payload);
    });

    // Loop track events
    this.channel.on('broadcast', { event: 'looptrack:add' }, ({ payload }) => {
      this.emit('looptrack:add', payload);
    });

    this.channel.on('broadcast', { event: 'looptrack:remove' }, ({ payload }) => {
      this.emit('looptrack:remove', payload);
    });

    this.channel.on('broadcast', { event: 'looptrack:update' }, ({ payload }) => {
      this.emit('looptrack:update', payload);
    });

    this.channel.on('broadcast', { event: 'looptrack:play' }, ({ payload }) => {
      this.emit('looptrack:play', payload);
    });

    this.channel.on('broadcast', { event: 'looptrack:stop' }, ({ payload }) => {
      this.emit('looptrack:stop', payload);
    });

    this.channel.on('broadcast', { event: 'looptrack:sync' }, ({ payload }) => {
      this.emit('looptrack:sync', payload);
    });

    // Tempo/Session state events
    this.channel.on('broadcast', { event: 'tempo:update' }, ({ payload }) => {
      this.emit('tempo:update', payload);
    });

    this.channel.on('broadcast', { event: 'tempo:source' }, ({ payload }) => {
      this.emit('tempo:source', payload);
    });

    this.channel.on('broadcast', { event: 'tempo:timesig' }, ({ payload }) => {
      this.emit('tempo:timesig', payload);
    });

    this.channel.on('broadcast', { event: 'key:update' }, ({ payload }) => {
      this.emit('key:update', payload);
    });

    // World position events (for synced avatar movement)
    this.channel.on('broadcast', { event: 'world:position' }, ({ payload }) => {
      this.emit('world:position', payload);
    });

    this.channel.on('broadcast', { event: 'world:scene' }, ({ payload }) => {
      this.emit('world:scene', payload);
    });

    // Permission events
    this.channel.on('broadcast', { event: 'permissions:role_update' }, ({ payload }) => {
      this.emit('permissions:role_update', payload);
    });

    this.channel.on('broadcast', { event: 'permissions:custom_update' }, ({ payload }) => {
      this.emit('permissions:custom_update', payload);
    });

    this.channel.on('broadcast', { event: 'permissions:member_kick' }, ({ payload }) => {
      this.emit('permissions:member_kick', payload);
    });

    this.channel.on('broadcast', { event: 'permissions:member_ban' }, ({ payload }) => {
      this.emit('permissions:member_ban', payload);
    });

    this.channel.on('broadcast', { event: 'permissions:sync' }, ({ payload }) => {
      this.emit('permissions:sync', payload);
    });

    // Song playback events (multi-track timeline sync)
    this.channel.on('broadcast', { event: 'song:play' }, ({ payload }) => {
      this.emit('song:play', payload);
    });

    this.channel.on('broadcast', { event: 'song:pause' }, ({ payload }) => {
      this.emit('song:pause', payload);
    });

    this.channel.on('broadcast', { event: 'song:seek' }, ({ payload }) => {
      this.emit('song:seek', payload);
    });

    this.channel.on('broadcast', { event: 'song:select' }, ({ payload }) => {
      this.emit('song:select', payload);
    });

    // Songs CRUD sync events
    this.channel.on('broadcast', { event: 'songs:sync' }, ({ payload }) => {
      this.emit('songs:sync', payload);
    });

    this.channel.on('broadcast', { event: 'songs:create' }, ({ payload }) => {
      this.emit('songs:create', payload);
    });

    this.channel.on('broadcast', { event: 'songs:update' }, ({ payload }) => {
      this.emit('songs:update', payload);
    });

    this.channel.on('broadcast', { event: 'songs:delete' }, ({ payload }) => {
      this.emit('songs:delete', payload);
    });

    // Song track state changes during playback (mute/solo/volume)
    this.channel.on('broadcast', { event: 'song:trackStates' }, ({ payload }) => {
      this.emit('song:trackStates', payload);
    });

    // State sync events (WS2: request/response state sync protocol)
    this.channel.on('broadcast', { event: 'state:request' }, ({ payload }) => {
      this.emit('state:request', payload);
    });

    this.channel.on('broadcast', { event: 'state:sync' }, ({ payload }) => {
      this.emit('state:sync', payload);
    });

    // Transport position sync events (WS6)
    this.channel.on('broadcast', { event: 'track:position' }, ({ payload }) => {
      this.emit('track:position', payload);
    });

    this.channel.on('broadcast', { event: 'song:position' }, ({ payload }) => {
      this.emit('song:position', payload);
    });
  }

  async connect(user: User): Promise<void> {
    // Clean up any existing channel first to prevent CLOSED status on retry
    await RealtimeRoomManager.cleanupExistingChannel(this.roomId);

    this.channel = getRealtimeChannel(this.roomId);
    // Track this channel so it can be cleaned up on retry
    activeChannels.set(this.roomId, this.channel);

    // Set up all event handlers (presence and broadcast)
    this.setupChannelHandlers();

    // Subscription with retry logic for mobile reliability (especially iPad)
    // Mobile devices often need multiple attempts due to network transitions
    const MAX_RETRIES = 3;
    const BASE_TIMEOUT = 20000; // 20 seconds base timeout (increased for mobile)
    const RETRY_DELAYS = [0, 1000, 2000]; // Exponential backoff delays

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        console.log(`[Realtime] Retry attempt ${attempt + 1}/${MAX_RETRIES} after ${RETRY_DELAYS[attempt]}ms`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));

        // Recreate channel on retry to get fresh connection
        await RealtimeRoomManager.cleanupExistingChannel(this.roomId);
        this.channel = getRealtimeChannel(this.roomId);
        activeChannels.set(this.roomId, this.channel);

        // CRITICAL: Re-attach ALL event handlers (presence AND broadcast) for the new channel
        // The previous channel object is gone, so we must set up handlers on the new one
        this.setupChannelHandlers();
      }

      try {
        await new Promise<void>((resolve, reject) => {
          let resolved = false;
          const timeoutId = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              reject(new Error(`Realtime subscription timed out after ${BASE_TIMEOUT}ms`));
            }
          }, BASE_TIMEOUT);

          this.channel!.subscribe(async (status) => {
            console.log('[Realtime] Subscription status:', status);

            if (!resolved) {
              // Initial connection phase
              if (status === 'SUBSCRIBED') {
                resolved = true;
                clearTimeout(timeoutId);
                this.connectionState = 'connected';
                try {
                  await this.channel?.track(user);
                  this.emit('connected', { roomId: this.roomId });
                  resolve();
                } catch (err) {
                  reject(err);
                }
              } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
                resolved = true;
                clearTimeout(timeoutId);
                this.connectionState = 'disconnected';
                reject(new Error(`Realtime subscription failed with status: ${status}`));
              }
              // SUBSCRIBING status is transitional, just wait
            } else {
              // Post-connection: detect reconnection (WS2)
              if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                const previousState = this.connectionState;
                this.connectionState = 'disconnected';
                if (previousState === 'connected') {
                  console.log('[Realtime] Connection lost, waiting for reconnection');
                  this.emit('disconnected', { roomId: this.roomId });
                }
              } else if (status === 'SUBSCRIBED') {
                const previousState = this.connectionState;
                this.connectionState = 'connected';
                if (previousState === 'disconnected' || previousState === 'reconnecting') {
                  console.log('[Realtime] Reconnected to room:', this.roomId);
                  this.emit('reconnected', { roomId: this.roomId });
                  // Auto-request state sync on reconnection
                  this.broadcastStateRequest().catch((err) => {
                    console.warn('[Realtime] Failed to request state sync on reconnect:', err);
                  });
                }
              }
            }
          });
        });

        // Success - exit retry loop
        return;
      } catch (err) {
        lastError = err as Error;
        console.warn(`[Realtime] Attempt ${attempt + 1} failed:`, lastError.message);

        // On CLOSED status (conflict), cleanup aggressively before retry
        if (lastError.message.includes('CLOSED')) {
          console.log('[Realtime] CLOSED status detected, aggressive cleanup before retry');
          await RealtimeRoomManager.cleanupExistingChannel(this.roomId);
          await new Promise(resolve => setTimeout(resolve, 500)); // Extra delay for CLOSED
        }
      }
    }

    // All retries exhausted
    throw lastError || new Error('Realtime subscription failed after all retries');
  }

  async disconnect(): Promise<void> {
    // Clear debounce timers to prevent stale broadcasts after disconnect
    if (this.seekDebounceTimer !== null) {
      clearTimeout(this.seekDebounceTimer);
      this.seekDebounceTimer = null;
    }
    if (this.songSeekDebounceTimer !== null) {
      clearTimeout(this.songSeekDebounceTimer);
      this.songSeekDebounceTimer = null;
    }
    this.connectionState = 'disconnected';

    if (this.channel) {
      const channelToRemove = this.channel;
      const roomIdToCleanup = this.roomId;

      // Immediately clear references so we don't block
      activeChannels.delete(this.roomId);
      this.channel = null;
      this.listeners.clear();

      // Fire-and-forget cleanup with timeout to prevent hanging
      // This runs in the background so the UI doesn't wait
      const cleanupWithTimeout = async () => {
        const CLEANUP_TIMEOUT = 2000; // 2 seconds max

        try {
          await Promise.race([
            (async () => {
              try {
                await channelToRemove.untrack();
              } catch (err) {
                // Expected if channel is already closed
              }
              try {
                await supabase.removeChannel(channelToRemove);
              } catch (err) {
                // Expected if channel is already removed or in bad state
              }
            })(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Cleanup timeout')), CLEANUP_TIMEOUT)
            ),
          ]);
        } catch (err) {
          // Cleanup timed out or failed - this is fine, just log it
          console.log('[Realtime] Channel cleanup completed (may have timed out):', roomIdToCleanup);
        }
      };

      // Don't await - let it run in the background
      cleanupWithTimeout();
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Reliable broadcast wrapper (WS3).
   * Awaits the broadcast result and retries once after 500ms on failure.
   * Returns true on success, false after exhausting the single retry.
   */
  private async reliableBroadcast(event: string, payload: Record<string, unknown>): Promise<boolean> {
    if (!this.channel) {
      console.warn('[Realtime] reliableBroadcast: no channel available for event:', event);
      return false;
    }

    try {
      const result = await this.channel.send({
        type: 'broadcast',
        event,
        payload,
      });
      if (result === 'ok') {
        return true;
      }
      console.warn('[Realtime] Broadcast returned non-ok for event:', event, 'result:', result);
    } catch (err) {
      console.warn('[Realtime] Broadcast failed for event:', event, err);
    }

    // Retry once after 500ms
    await new Promise<void>((resolve) => setTimeout(resolve, 500));

    if (!this.channel) {
      console.warn('[Realtime] reliableBroadcast: channel lost during retry for event:', event);
      return false;
    }

    try {
      const retryResult = await this.channel.send({
        type: 'broadcast',
        event,
        payload,
      });
      if (retryResult === 'ok') {
        return true;
      }
      console.warn('[Realtime] Broadcast retry returned non-ok for event:', event, 'result:', retryResult);
      return false;
    } catch (retryErr) {
      console.warn('[Realtime] Broadcast retry failed for event:', event, retryErr);
      return false;
    }
  }

  // Broadcast events to all users
  async broadcastPlay(trackId: string, timestamp: number, syncTime: number): Promise<void> {
    await this.reliableBroadcast('track:play', { trackId, timestamp, syncTime, userId: this.userId });
  }

  async broadcastPause(trackId: string, timestamp: number): Promise<void> {
    await this.reliableBroadcast('track:pause', { trackId, timestamp, userId: this.userId });
  }

  async broadcastSeek(trackId: string, timestamp: number, syncTime: number): Promise<void> {
    // Debounce seek broadcasts (WS6) - only the final seek position gets sent
    if (this.seekDebounceTimer !== null) {
      clearTimeout(this.seekDebounceTimer);
    }
    this.seekDebounceTimer = setTimeout(() => {
      this.seekDebounceTimer = null;
      this.reliableBroadcast('track:seek', { trackId, timestamp, syncTime, userId: this.userId });
    }, 100);
  }

  async broadcastQueueUpdate(queue: TrackQueue): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'track:queue',
      payload: { queue, userId: this.userId },
    });
  }

  async broadcastNextTrack(index: number): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'track:next',
      payload: { index, userId: this.userId },
    });
  }

  async broadcastMute(targetUserId: string, isMuted: boolean): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'user:mute',
      payload: { targetUserId, isMuted, userId: this.userId },
    });
  }

  async broadcastVolume(targetUserId: string, volume: number): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'user:volume',
      payload: { targetUserId, volume, userId: this.userId },
    });
  }

  async broadcastChat(message: string): Promise<void> {
    // Prevent blank messages from being broadcast
    const trimmedMessage = message?.trim();
    if (!trimmedMessage) return;

    await this.channel?.send({
      type: 'broadcast',
      event: 'chat:message',
      payload: { message: trimmedMessage, userId: this.userId, timestamp: Date.now() },
    });
  }

  async broadcastStemToggle(trackId: string, stem: string, enabled: boolean): Promise<void> {
    await this.reliableBroadcast('stem:toggle', { trackId, stem, enabled, userId: this.userId });
  }

  async broadcastStemVolume(trackId: string, stem: string, volume: number): Promise<void> {
    await this.reliableBroadcast('stem:volume', { trackId, stem, volume, userId: this.userId });
  }

  async broadcastAIGeneration(request: { prompt: string; status: string; trackId?: string }): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'ai:generate',
      payload: { ...request, userId: this.userId },
    });
  }

  // User track broadcasts
  async broadcastUserTrackAdd(track: UserTrack): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'usertrack:add',
      payload: { track, userId: this.userId },
    });
  }

  async broadcastUserTrackRemove(trackId: string): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'usertrack:remove',
      payload: { trackId, userId: this.userId },
    });
  }

  async broadcastUserTrackUpdate(trackId: string, updates: Partial<UserTrack>): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'usertrack:update',
      payload: { trackId, updates, userId: this.userId },
    });
  }

  async broadcastUserTrackEffects(trackId: string, effects: Partial<TrackEffectsChain>): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'usertrack:effects',
      payload: { trackId, effects, userId: this.userId },
    });
  }

  async broadcastUserTrackSettings(trackId: string, settings: Partial<TrackAudioSettings>): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'usertrack:settings',
      payload: { trackId, settings, userId: this.userId },
    });
  }

  // Loop track broadcasts
  async broadcastLoopTrackAdd(track: LoopTrackState): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'looptrack:add',
      payload: { track, userId: this.userId },
    });
  }

  async broadcastLoopTrackRemove(trackId: string): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'looptrack:remove',
      payload: { trackId, userId: this.userId },
    });
  }

  async broadcastLoopTrackUpdate(trackId: string, updates: Partial<LoopTrackState>): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'looptrack:update',
      payload: { trackId, updates, userId: this.userId },
    });
  }

  async broadcastLoopTrackPlay(trackId: string, syncTimestamp: number, loopStartBeat: number = 0): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'looptrack:play',
      payload: { trackId, syncTimestamp, loopStartBeat, userId: this.userId },
    });
  }

  async broadcastLoopTrackStop(trackId: string): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'looptrack:stop',
      payload: { trackId, userId: this.userId },
    });
  }

  async broadcastLoopTrackSync(tracks: LoopTrackState[]): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'looptrack:sync',
      payload: { tracks, userId: this.userId },
    });
  }

  // Tempo broadcasts
  async broadcastTempoUpdate(tempo: number, source: string): Promise<void> {
    await this.reliableBroadcast('tempo:update', { tempo, source, userId: this.userId });
  }

  async broadcastTempoSource(source: string): Promise<void> {
    await this.reliableBroadcast('tempo:source', { source, userId: this.userId });
  }

  async broadcastTimeSignature(beatsPerBar: number, beatUnit: number): Promise<void> {
    await this.reliableBroadcast('tempo:timesig', { beatsPerBar, beatUnit, userId: this.userId });
  }

  async broadcastKeyUpdate(key: string | null, keyScale: 'major' | 'minor' | null, keySource: string): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'key:update',
      payload: { key, keyScale, keySource, userId: this.userId },
    });
  }

  // Permission broadcasts
  async broadcastRoleUpdate(targetUserId: string, role: RoomRole): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'permissions:role_update',
      payload: { targetUserId, role, userId: this.userId },
    });
  }

  async broadcastCustomPermissionsUpdate(
    targetUserId: string,
    customPermissions: Partial<RoomPermissions> | null
  ): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'permissions:custom_update',
      payload: { targetUserId, customPermissions, userId: this.userId },
    });
  }

  async broadcastMemberKick(targetUserId: string): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'permissions:member_kick',
      payload: { targetUserId, userId: this.userId },
    });
  }

  async broadcastMemberBan(targetUserId: string, reason?: string): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'permissions:member_ban',
      payload: { targetUserId, reason, userId: this.userId },
    });
  }

  async broadcastPermissionsSync(members: RoomMember[], defaultRole: RoomRole): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'permissions:sync',
      payload: { members, defaultRole, userId: this.userId },
    });
  }

  // World position broadcasts (for synced avatar movement)
  async broadcastWorldPosition(position: {
    x: number;
    y: number;
    facingRight: boolean;
    isWalking: boolean;
    targetX?: number;
    targetY?: number;
  }): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'world:position',
      payload: { ...position, userId: this.userId, timestamp: Date.now() },
    });
  }

  async broadcastWorldScene(scene: string): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'world:scene',
      payload: { scene, userId: this.userId },
    });
  }

  // Song playback broadcasts (multi-track timeline sync)
  async broadcastSongPlay(
    songId: string,
    currentTime: number,
    syncTime: number,
    trackStates: Array<{ trackRefId: string; muted: boolean; solo: boolean; volume: number }>
  ): Promise<void> {
    await this.reliableBroadcast('song:play', { songId, currentTime, syncTime, trackStates, userId: this.userId });
  }

  async broadcastSongPause(songId: string, currentTime: number): Promise<void> {
    await this.reliableBroadcast('song:pause', { songId, currentTime, userId: this.userId });
  }

  async broadcastSongSeek(songId: string, seekTime: number, syncTime: number): Promise<void> {
    // Debounce song seek broadcasts (WS6) - only the final seek position gets sent
    if (this.songSeekDebounceTimer !== null) {
      clearTimeout(this.songSeekDebounceTimer);
    }
    this.songSeekDebounceTimer = setTimeout(() => {
      this.songSeekDebounceTimer = null;
      this.reliableBroadcast('song:seek', { songId, seekTime, syncTime, userId: this.userId });
    }, 100);
  }

  async broadcastSongSelect(songId: string): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'song:select',
      payload: { songId, userId: this.userId },
    });
  }

  // Songs CRUD broadcasts
  async broadcastSongsSync(songs: Array<{ id: string; name: string; [key: string]: unknown }>, currentSongId: string | null): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'songs:sync',
      payload: { songs, currentSongId, userId: this.userId },
    });
  }

  async broadcastSongCreate(song: { id: string; name: string; [key: string]: unknown }): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'songs:create',
      payload: { song, userId: this.userId },
    });
  }

  async broadcastSongUpdate(songId: string, changes: Record<string, unknown>): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'songs:update',
      payload: { songId, changes, userId: this.userId },
    });
  }

  async broadcastSongDelete(songId: string): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'songs:delete',
      payload: { songId, userId: this.userId },
    });
  }

  async broadcastSongTrackStates(
    songId: string,
    trackStates: Array<{ trackRefId: string; muted: boolean; solo: boolean; volume: number }>
  ): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'song:trackStates',
      payload: { songId, trackStates, userId: this.userId },
    });
  }

  // State sync broadcasts (WS2: reliable state sync protocol)
  async broadcastStateRequest(): Promise<void> {
    const requestId = `${this.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await this.reliableBroadcast('state:request', { userId: this.userId, requestId });
  }

  async broadcastStateSync(state: StateSyncPayload): Promise<void> {
    await this.reliableBroadcast('state:sync', { ...state, userId: this.userId });
  }

  // Transport position sync broadcasts (WS6: periodic position updates)
  async broadcastTrackPosition(
    trackId: string,
    currentTime: number,
    syncTimestamp: number,
    isPlaying: boolean
  ): Promise<void> {
    try {
      await this.channel?.send({
        type: 'broadcast',
        event: 'track:position',
        payload: { trackId, currentTime, syncTimestamp, isPlaying, userId: this.userId },
      });
    } catch (err) {
      // Position syncs are periodic and non-critical; log but do not retry
      console.warn('[Realtime] Failed to broadcast track position:', err);
    }
  }

  async broadcastSongPosition(
    songId: string,
    currentTime: number,
    syncTimestamp: number,
    isPlaying: boolean
  ): Promise<void> {
    try {
      await this.channel?.send({
        type: 'broadcast',
        event: 'song:position',
        payload: { songId, currentTime, syncTimestamp, isPlaying, userId: this.userId },
      });
    } catch (err) {
      // Position syncs are periodic and non-critical; log but do not retry
      console.warn('[Realtime] Failed to broadcast song position:', err);
    }
  }

  async updatePresence(data: Partial<User>): Promise<void> {
    await this.channel?.track({ ...data, id: this.userId });
  }

  getPresenceState(): Record<string, User[]> | undefined {
    return this.channel?.presenceState() as Record<string, User[]> | undefined;
  }

  getUserCount(): number {
    const state = this.getPresenceState();
    if (!state) return 0;
    return Object.values(state).flat().length;
  }

  /**
   * Get count of OTHER users in the room (excluding the current user).
   * This is more reliable for determining if we're the last user, because
   * if our own presence has already been removed (e.g., network disconnect),
   * we won't incorrectly think we're the last user.
   */
  getOtherUsersCount(): number {
    const state = this.getPresenceState();
    if (!state) return 0;

    let count = 0;
    for (const users of Object.values(state)) {
      for (const user of users) {
        if (user.id !== this.userId) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Get count of OTHER connections in the room (excluding ours).
   * This counts presence entries (connections/devices), not unique users.
   * Handles the case where the same user is on multiple devices.
   * Returns totalConnections - 1 (assuming we're still tracked).
   */
  getOtherConnectionsCount(): number {
    const state = this.getPresenceState();
    if (!state) return 0;

    // Each key in presence state is a unique connection/device
    const totalConnections = Object.keys(state).length;

    // Subtract 1 for our own connection (assuming we're still tracked)
    // If we're already untracked, this might undercount by 1, which is safe
    // (we'd rather NOT delete the room than delete it incorrectly)
    return Math.max(0, totalConnections - 1);
  }

  /**
   * Check if we're still tracked in the presence state.
   * Returns false if our presence has already been removed (e.g., network disconnect).
   */
  isStillTracked(): boolean {
    const state = this.getPresenceState();
    if (!state) return false;

    // Check if any presence entry contains our userId
    for (const users of Object.values(state)) {
      for (const user of users) {
        if (user.id === this.userId) {
          return true;
        }
      }
    }
    return false;
  }

  // Event listener management
  on(event: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((callback) => callback(data));
  }
}
