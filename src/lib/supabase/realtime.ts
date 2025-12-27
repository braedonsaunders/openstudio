import { supabase, getRealtimeChannel, RealtimeChannel } from './client';
import type { User, BackingTrack, RoomMessage, TrackQueue, TrackAudioSettings, TrackEffectsChain, UserTrack } from '@/types';

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
