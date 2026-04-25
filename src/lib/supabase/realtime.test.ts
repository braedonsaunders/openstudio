import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RealtimeRoomManager } from './realtime';

vi.mock('./client', () => ({
  supabase: {
    getChannels: () => [],
    removeChannel: vi.fn(),
  },
  getRealtimeChannel: vi.fn(),
}));

function attachFakeChannel(manager: RealtimeRoomManager) {
  const channel = {
    send: vi.fn().mockResolvedValue('ok'),
  };
  (manager as unknown as { channel: typeof channel }).channel = channel;
  return channel;
}

function attachRoutableFakeChannel(manager: RealtimeRoomManager) {
  type Handler = {
    type: string;
    event: string;
    callback: (data: unknown) => void;
  };
  const handlers: Handler[] = [];
  const channel = {
    on: vi.fn((type: string, filter: { event: string }, callback: (data: unknown) => void) => {
      handlers.push({ type, event: filter.event, callback });
      return channel;
    }),
    send: vi.fn().mockResolvedValue('ok'),
    presenceState: vi.fn(() => ({})),
  };
  const managerWithInternals = manager as unknown as {
    channel: typeof channel;
    setupChannelHandlers: () => void;
  };
  managerWithInternals.channel = channel;
  managerWithInternals.setupChannelHandlers();

  return {
    channel,
    triggerBroadcast(event: string, payload: unknown) {
      const handler = handlers.find((item) => item.type === 'broadcast' && item.event === event);
      if (!handler) {
        throw new Error(`Missing broadcast handler for ${event}`);
      }
      handler.callback({ payload });
    },
  };
}

describe('RealtimeRoomManager song sync broadcasts', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('broadcasts song play, pause, track state, position, and state sync payloads', async () => {
    const manager = new RealtimeRoomManager('room-1', 'user-a');
    const channel = attachFakeChannel(manager);

    await manager.broadcastSongPlay('song-1', 12.5, 123456, [
      { trackRefId: 'track-ref-1', muted: false, solo: true, volume: 0.75 },
    ]);
    await manager.broadcastSongPause('song-1', 14.25);
    await manager.broadcastSongTrackStates('song-1', [
      { trackRefId: 'track-ref-1', muted: true, solo: false, volume: 0.2 },
    ]);
    await manager.broadcastSongPosition('song-1', 15, 123999, true);
    await manager.broadcastStateSync({
      requestId: 'request-1',
      queue: [],
      currentTrack: null,
      currentTrackPosition: 0,
      isPlaying: true,
      tempo: 120,
      tempoSource: 'manual',
      timeSignature: { beatsPerBar: 4, beatUnit: 4 },
      key: 'C',
      keyScale: 'major',
      keySource: 'manual',
      userTracks: [],
      loopTracks: [],
      songs: [],
      currentSongId: 'song-1',
      stemMixState: {},
      permissions: {},
      songTrackStates: {
        'track-ref-1': { muted: true, solo: false, volume: 0.2 },
      },
      currentSongIsPlaying: true,
      currentSongPosition: 15,
      timestamp: 124000,
    });

    expect(channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'song:play',
      payload: {
        songId: 'song-1',
        currentTime: 12.5,
        syncTime: 123456,
        trackStates: [{ trackRefId: 'track-ref-1', muted: false, solo: true, volume: 0.75 }],
        userId: 'user-a',
      },
    });
    expect(channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'song:pause',
      payload: { songId: 'song-1', currentTime: 14.25, userId: 'user-a' },
    });
    expect(channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'song:trackStates',
      payload: {
        songId: 'song-1',
        trackStates: [{ trackRefId: 'track-ref-1', muted: true, solo: false, volume: 0.2 }],
        userId: 'user-a',
      },
    });
    expect(channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'song:position',
      payload: { songId: 'song-1', currentTime: 15, syncTimestamp: 123999, isPlaying: true, userId: 'user-a' },
    });
    expect(channel.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'broadcast',
        event: 'state:sync',
        payload: expect.objectContaining({
          requestId: 'request-1',
          currentSongId: 'song-1',
          currentSongIsPlaying: true,
          currentSongPosition: 15,
          songTrackStates: {
            'track-ref-1': { muted: true, solo: false, volume: 0.2 },
          },
          userId: 'user-a',
        }),
      })
    );
  });

  it('debounces song seek broadcasts to the final playhead position', async () => {
    vi.useFakeTimers();
    const manager = new RealtimeRoomManager('room-1', 'user-a');
    const channel = attachFakeChannel(manager);

    await manager.broadcastSongSeek('song-1', 1, 1001);
    await manager.broadcastSongSeek('song-1', 2, 1002);
    await manager.broadcastSongSeek('song-1', 3, 1003);

    expect(channel.send).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);

    expect(channel.send).toHaveBeenCalledTimes(1);
    expect(channel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'song:seek',
      payload: { songId: 'song-1', seekTime: 3, syncTime: 1003, userId: 'user-a' },
    });
  });

  it('broadcasts collaboration events for DAW views, mixer controls, permissions, and native endpoints', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(987654321);
    const manager = new RealtimeRoomManager('room-1', 'user-a');
    const channel = attachFakeChannel(manager);

    const userTrack = { id: 'user-track-1', ownerUserId: 'user-a', name: 'Guitar' };
    const loopTrack = { id: 'loop-track-1', name: 'Drum Loop', isPlaying: false };
    const canvas = { version: 1, elements: [] };
    const layout = {
      activePanel: 'chat',
      isPanelDockVisible: true,
      isBottomDockVisible: true,
      mainView: 'mixer',
      leftPanelWidth: 320,
      rightPanelWidth: 360,
      sharedSplitPosition: 50,
    };

    await manager.broadcastQueueUpdate({ tracks: [], currentIndex: -1, isPlaying: false, currentTime: 0, syncTimestamp: 0 });
    await manager.broadcastMute('user-b', true);
    await manager.broadcastVolume('user-b', 0.6);
    await manager.broadcastChat('  ready to record  ');
    await manager.broadcastStemToggle('track-1', 'vocals', false);
    await manager.broadcastStemVolume('track-1', 'drums', 0.45);
    await manager.broadcastBackingTrackVolume(0.7);
    await manager.broadcastUserTrackAdd(userTrack as never);
    await manager.broadcastUserTrackUpdate('user-track-1', { volume: 0.5 } as never);
    await manager.broadcastUserTrackRemove('user-track-1');
    await manager.broadcastLoopTrackAdd(loopTrack as never);
    await manager.broadcastLoopTrackUpdate('loop-track-1', { isPlaying: true } as never);
    await manager.broadcastLoopTrackPlay('loop-track-1', 1234, 2);
    await manager.broadcastLoopTrackStop('loop-track-1');
    await manager.broadcastLoopTrackRemove('loop-track-1');
    await manager.broadcastTempoUpdate(128, 'manual');
    await manager.broadcastTempoSource('tap');
    await manager.broadcastTimeSignature(7, 8);
    await manager.broadcastKeyUpdate('D', 'minor', 'manual');
    await manager.broadcastRoleUpdate('user-b', 'performer');
    await manager.broadcastCustomPermissionsUpdate('user-b', { mixer: { manage: true } } as never);
    await manager.broadcastMemberKick('user-c');
    await manager.broadcastMemberBan('user-d', 'feedback loop');
    await manager.broadcastWorldPosition({ x: 12, y: 34, facingRight: true, isWalking: false });
    await manager.broadcastLayoutState(layout);
    await manager.broadcastCanvasSync(canvas as never);
    await manager.broadcastSongSelect('song-1');
    await manager.broadcastSongCreate({ id: 'song-1', name: 'Launch Jam' });
    await manager.broadcastSongUpdate('song-1', { name: 'Launch Jam v2' });
    await manager.broadcastSongDelete('song-1');
    await manager.broadcastStateRequest();
    await manager.broadcastNativeBridgeEndpoint({ userName: 'Mac Performer', localEndpoint: '0.0.0.0:41001', publicEndpoint: '64.118.235.53:41001' });

    const calls = channel.send.mock.calls.map(([message]) => message);
    expect(calls.map((message) => message.event)).toEqual(expect.arrayContaining([
      'track:queue',
      'user:mute',
      'user:volume',
      'chat:message',
      'stem:toggle',
      'stem:volume',
      'backingtrack:volume',
      'usertrack:add',
      'usertrack:update',
      'usertrack:remove',
      'looptrack:add',
      'looptrack:update',
      'looptrack:play',
      'looptrack:stop',
      'looptrack:remove',
      'tempo:update',
      'tempo:source',
      'tempo:timesig',
      'key:update',
      'permissions:role_update',
      'permissions:custom_update',
      'permissions:member_kick',
      'permissions:member_ban',
      'world:position',
      'layout:update',
      'canvas:sync',
      'song:select',
      'songs:create',
      'songs:update',
      'songs:delete',
      'state:request',
      'nativebridge:endpoint',
    ]));
    expect(calls).toContainEqual({
      type: 'broadcast',
      event: 'layout:update',
      payload: { ...layout, updatedBy: 'user-a', timestamp: 987654321 },
    });
    expect(calls).toContainEqual({
      type: 'broadcast',
      event: 'canvas:sync',
      payload: { canvas, updatedBy: 'user-a', timestamp: 987654321 },
    });
    expect(calls).toContainEqual({
      type: 'broadcast',
      event: 'nativebridge:endpoint',
      payload: {
        userName: 'Mac Performer',
        localEndpoint: '0.0.0.0:41001',
        publicEndpoint: '64.118.235.53:41001',
        userId: 'user-a',
        timestamp: 987654321,
      },
    });
  });

  it('routes incoming collaboration broadcasts to room listeners', () => {
    const manager = new RealtimeRoomManager('room-1', 'user-a');
    const { triggerBroadcast } = attachRoutableFakeChannel(manager);
    const seen: Record<string, unknown> = {};
    const events = [
      'track:queue',
      'user:mute',
      'user:volume',
      'chat:message',
      'stem:toggle',
      'stem:volume',
      'backingtrack:volume',
      'usertrack:add',
      'usertrack:update',
      'usertrack:remove',
      'looptrack:add',
      'looptrack:update',
      'looptrack:play',
      'looptrack:stop',
      'looptrack:remove',
      'tempo:update',
      'tempo:source',
      'tempo:timesig',
      'key:update',
      'world:position',
      'layout:update',
      'canvas:sync',
      'permissions:role_update',
      'permissions:custom_update',
      'permissions:member_kick',
      'permissions:member_ban',
      'song:play',
      'song:pause',
      'song:seek',
      'song:select',
      'songs:create',
      'songs:update',
      'songs:delete',
      'song:trackStates',
      'state:request',
      'state:sync',
      'song:position',
      'nativebridge:endpoint',
    ];

    for (const event of events) {
      manager.on(event, (payload) => {
        seen[event] = payload;
      });
      triggerBroadcast(event, { event, marker: `${event}:payload` });
    }

    for (const event of events) {
      expect(seen[event]).toEqual({ event, marker: `${event}:payload` });
    }
  });
});
