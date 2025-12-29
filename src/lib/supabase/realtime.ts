import { supabase, getRealtimeChannel, RealtimeChannel } from './client';
import type { User, BackingTrack, RoomMessage, TrackQueue, TrackAudioSettings, TrackEffectsChain, UserTrack } from '@/types';
import type { LoopTrackState } from '@/types/loops';
import type { RoomRole, RoomPermissions, RoomMember } from '@/types/permissions';

export interface RoomState {
  users: Record<string, User>;
  queue: TrackQueue;
  messages: RoomMessage[];
}

// Track active channels by room ID to prevent conflicts
const activeChannels = new Map<string, RealtimeChannel>();

export class RealtimeRoomManager {
  private channel: RealtimeChannel | null = null;
  private roomId: string;
  private userId: string;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

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

  async connect(user: User): Promise<void> {
    // Clean up any existing channel first to prevent CLOSED status on retry
    await RealtimeRoomManager.cleanupExistingChannel(this.roomId);

    this.channel = getRealtimeChannel(this.roomId);
    // Track this channel so it can be cleaned up on retry
    activeChannels.set(this.roomId, this.channel);

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

        // Re-attach event handlers for the new channel
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
        // Note: broadcast handlers are attached before this loop, they persist
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
            if (resolved) return; // Prevent multiple resolutions

            console.log('[Realtime] Subscription status:', status);

            if (status === 'SUBSCRIBED') {
              resolved = true;
              clearTimeout(timeoutId);
              try {
                await this.channel?.track(user);
                this.emit('connected', { roomId: this.roomId });
                resolve();
              } catch (err) {
                reject(err);
              }
            } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeoutId);
                reject(new Error(`Realtime subscription failed with status: ${status}`));
              }
            }
            // SUBSCRIBING status is transitional, just wait
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
    if (this.channel) {
      try {
        await this.channel.untrack();
      } catch (err) {
        console.log('[Realtime] Untrack during disconnect:', err);
      }
      try {
        await supabase.removeChannel(this.channel);
      } catch (err) {
        console.log('[Realtime] Remove channel during disconnect:', err);
      }
      activeChannels.delete(this.roomId);
      this.channel = null;
    }
    this.listeners.clear();
  }

  // Broadcast events to all users
  async broadcastPlay(trackId: string, timestamp: number, syncTime: number): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'track:play',
      payload: { trackId, timestamp, syncTime, userId: this.userId },
    });
  }

  async broadcastPause(trackId: string, timestamp: number): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'track:pause',
      payload: { trackId, timestamp, userId: this.userId },
    });
  }

  async broadcastSeek(trackId: string, timestamp: number, syncTime: number): Promise<void> {
    await this.channel?.send({
      type: 'broadcast',
      event: 'track:seek',
      payload: { trackId, timestamp, syncTime, userId: this.userId },
    });
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
    await this.channel?.send({
      type: 'broadcast',
      event: 'stem:toggle',
      payload: { trackId, stem, enabled, userId: this.userId },
    });
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
