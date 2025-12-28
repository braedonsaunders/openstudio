import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { UserMusicTags } from '@/types/user';

// Lobby user presence
export interface LobbyUser {
  id: string;
  name: string;
  username?: string;
  avatar?: string;
  level?: number;
  instrument?: string;
  musicTags?: UserMusicTags;
  joinedAt: string;
  isOnline: boolean;
}

// Lobby chat message
export interface LobbyMessage {
  id: string;
  userId: string;
  userName: string;
  userLevel?: number;
  content: string;
  timestamp: string;
  type: 'chat' | 'system' | 'join' | 'leave';
}

// Room presence info
export interface RoomPresence {
  roomId: string;
  userCount: number;
  users: Array<{
    id: string;
    name: string;
  }>;
}

interface LobbyState {
  // Presence state
  users: Map<string, LobbyUser>;
  roomPresence: Map<string, RoomPresence>;
  totalOnline: number;

  // Chat state
  messages: LobbyMessage[];

  // Connection state
  isConnected: boolean;
  channel: RealtimeChannel | null;
  roomChannels: Map<string, RealtimeChannel>;

  // Actions
  connect: (user: LobbyUser) => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (content: string) => void;
  subscribeToRoom: (roomId: string) => void;
  unsubscribeFromRoom: (roomId: string) => void;
  getRoomUserCount: (roomId: string) => number;
}

const MAX_MESSAGES = 100;
const LOBBY_CHANNEL = 'lobby:presence';

export const useLobbyStore = create<LobbyState>((set, get) => ({
  users: new Map(),
  roomPresence: new Map(),
  totalOnline: 0,
  messages: [],
  isConnected: false,
  channel: null,
  roomChannels: new Map(),

  connect: async (user: LobbyUser) => {
    const state = get();
    if (state.isConnected || state.channel) return;

    try {
      const channel = supabase.channel(LOBBY_CHANNEL, {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      // Handle presence sync
      channel.on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const users = new Map<string, LobbyUser>();

        Object.values(presenceState).forEach((presences) => {
          presences.forEach((presence: unknown) => {
            const p = presence as LobbyUser;
            if (p.id) {
              users.set(p.id, { ...p, isOnline: true });
            }
          });
        });

        set({ users, totalOnline: users.size });
      });

      // Handle user join
      channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const { users, messages } = get();
        const newUsers = new Map(users);

        newPresences.forEach((presence: unknown) => {
          const p = presence as LobbyUser;
          if (p.id) {
            newUsers.set(p.id, { ...p, isOnline: true });

            // Add system message for join
            if (p.id !== user.id) {
              const joinMessage: LobbyMessage = {
                id: `join-${p.id}-${Date.now()}`,
                userId: p.id,
                userName: p.name,
                content: `${p.name} joined the lobby`,
                timestamp: new Date().toISOString(),
                type: 'join',
              };
              set({
                messages: [...messages.slice(-MAX_MESSAGES + 1), joinMessage],
              });
            }
          }
        });

        set({ users: newUsers, totalOnline: newUsers.size });
      });

      // Handle user leave
      channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        const { users, messages } = get();
        const newUsers = new Map(users);

        leftPresences.forEach((presence: unknown) => {
          const p = presence as LobbyUser;
          if (p.id) {
            newUsers.delete(p.id);

            // Add system message for leave
            const leaveMessage: LobbyMessage = {
              id: `leave-${p.id}-${Date.now()}`,
              userId: p.id,
              userName: p.name,
              content: `${p.name} left the lobby`,
              timestamp: new Date().toISOString(),
              type: 'leave',
            };
            set({
              messages: [...messages.slice(-MAX_MESSAGES + 1), leaveMessage],
            });
          }
        });

        set({ users: newUsers, totalOnline: newUsers.size });
      });

      // Handle chat messages
      channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
        const { messages } = get();
        const message = payload as LobbyMessage;
        set({
          messages: [...messages.slice(-MAX_MESSAGES + 1), message],
        });
      });

      await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(user);
          set({ isConnected: true, channel });
        }
      });
    } catch (error) {
      console.error('Failed to connect to lobby:', error);
    }
  },

  disconnect: async () => {
    const { channel, roomChannels } = get();

    // Disconnect from lobby
    if (channel) {
      await channel.untrack();
      await supabase.removeChannel(channel);
    }

    // Disconnect from all room channels
    for (const [, roomChannel] of roomChannels) {
      await supabase.removeChannel(roomChannel);
    }

    set({
      isConnected: false,
      channel: null,
      users: new Map(),
      roomChannels: new Map(),
      roomPresence: new Map(),
      totalOnline: 0,
    });
  },

  sendMessage: (content: string) => {
    const { channel } = get();
    if (!channel || !content.trim()) return;

    // Get current user from presence
    const presenceState = channel.presenceState();
    let currentUser: LobbyUser | undefined = undefined;

    for (const presences of Object.values(presenceState)) {
      for (const presence of presences) {
        const p = presence as unknown as LobbyUser;
        if (p.id) {
          currentUser = p;
          break;
        }
      }
      if (currentUser) break;
    }

    if (!currentUser) return;

    const message: LobbyMessage = {
      id: `msg-${currentUser.id}-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userLevel: currentUser.level,
      content: content.trim(),
      timestamp: new Date().toISOString(),
      type: 'chat',
    };

    channel.send({
      type: 'broadcast',
      event: 'chat',
      payload: message,
    });
  },

  subscribeToRoom: (roomId: string) => {
    const { roomChannels, roomPresence } = get();

    if (roomChannels.has(roomId)) return;

    const channel = supabase.channel(`room:${roomId}:presence`);

    channel.on('presence', { event: 'sync' }, () => {
      const presenceState = channel.presenceState();
      const users: Array<{ id: string; name: string }> = [];

      Object.values(presenceState).forEach((presences) => {
        presences.forEach((presence: unknown) => {
          const p = presence as { id: string; name: string };
          if (p.id) {
            users.push({ id: p.id, name: p.name });
          }
        });
      });

      const newRoomPresence = new Map(get().roomPresence);
      newRoomPresence.set(roomId, {
        roomId,
        userCount: users.length,
        users,
      });
      set({ roomPresence: newRoomPresence });
    });

    channel.subscribe();

    const newRoomChannels = new Map(roomChannels);
    newRoomChannels.set(roomId, channel);
    set({ roomChannels: newRoomChannels });
  },

  unsubscribeFromRoom: (roomId: string) => {
    const { roomChannels, roomPresence } = get();

    const channel = roomChannels.get(roomId);
    if (channel) {
      supabase.removeChannel(channel);
    }

    const newRoomChannels = new Map(roomChannels);
    newRoomChannels.delete(roomId);

    const newRoomPresence = new Map(roomPresence);
    newRoomPresence.delete(roomId);

    set({ roomChannels: newRoomChannels, roomPresence: newRoomPresence });
  },

  getRoomUserCount: (roomId: string) => {
    const { roomPresence } = get();
    return roomPresence.get(roomId)?.userCount || 0;
  },
}));
