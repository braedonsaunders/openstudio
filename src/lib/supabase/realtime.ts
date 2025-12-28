import { supabase, getRealtimeChannel, RealtimeChannel } from './client';
import type { User, BackingTrack, RoomMessage, TrackQueue, TrackAudioSettings, TrackEffectsChain, UserTrack } from '@/types';
import type { LoopTrackState } from '@/types/loops';
import type { RoomRole, RoomPermissions, RoomMember } from '@/types/permissions';

export interface RoomState {
  users: Record<string, User>;
  queue: TrackQueue;
  messages: RoomMessage[];
}

export class RealtimeRoomManager {
  private channel: RealtimeChannel | null = null;
  private roomId: string;
  private userId: string;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  constructor(roomId: string, userId: string) {
    this.roomId = roomId;
    this.userId = userId;
  }

  async connect(user: User): Promise<void> {
    this.channel = getRealtimeChannel(this.roomId);

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

    await this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.channel?.track(user);
        this.emit('connected', { roomId: this.roomId });
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.channel.untrack();
      await supabase.removeChannel(this.channel);
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
