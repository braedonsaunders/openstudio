import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { UserTrack, TrackAudioSettings, TrackEffectsChain, InputChannelConfig, GuitarEffectsChain, MidiInputSettings, UserTrackType } from '@/types';
import { DEFAULT_EFFECTS_CHAIN, EFFECT_PRESETS } from '@/lib/audio/effects/presets';
import { GUITAR_PRESETS, DEFAULT_GUITAR_EFFECTS } from '@/lib/audio/effects/guitar';

// Track color palette - exported for use in color picker
export const TRACK_COLORS = [
  '#f472b6', // Pink
  '#fb923c', // Orange
  '#a3e635', // Lime
  '#22d3ee', // Cyan
  '#a78bfa', // Violet
  '#fbbf24', // Yellow
  '#34d399', // Emerald
  '#f87171', // Red
  '#60a5fa', // Blue
  '#c084fc', // Purple
];

// Default channel configuration (stereo)
const DEFAULT_CHANNEL_CONFIG: InputChannelConfig = {
  channelCount: 2,
  leftChannel: 0,
  rightChannel: 1,
};

// Default audio settings with effects chain
const DEFAULT_AUDIO_SETTINGS: TrackAudioSettings = {
  inputMode: 'microphone',
  inputDeviceId: 'default',
  sampleRate: 48000,
  bufferSize: 256,
  noiseSuppression: false,
  echoCancellation: false,
  autoGainControl: false,
  channelConfig: DEFAULT_CHANNEL_CONFIG,
  inputGain: 0,
  effects: DEFAULT_EFFECTS_CHAIN,
  directMonitoring: true,
  monitoringVolume: 1,
};

// Default MIDI settings
const DEFAULT_MIDI_SETTINGS: MidiInputSettings = {
  deviceId: null,
  channel: 'all',
  soundBank: 'keys',
  soundPreset: 'keys/synth-pad',
  velocityCurve: 'linear',
};

// Extended device info with channel count
export interface ExtendedDeviceInfo extends MediaDeviceInfo {
  channelCount?: number;
  maxChannels?: number;
}

interface UserTracksState {
  // All tracks indexed by track ID
  tracks: Map<string, UserTrack>;

  // Track IDs ordered by creation for each user
  userTrackOrder: Map<string, string[]>;

  // Audio levels per track
  trackLevels: Map<string, number>;

  // Available audio devices with extended info
  inputDevices: ExtendedDeviceInfo[];
  outputDevices: ExtendedDeviceInfo[];
  devicesLoaded: boolean;

  // Device channel capabilities (deviceId -> channel count)
  deviceChannels: Map<string, number>;

  // Actions
  addTrack: (userId: string, name?: string, settings?: Partial<TrackAudioSettings>, userName?: string, trackType?: UserTrackType, midiSettings?: Partial<MidiInputSettings>) => UserTrack;
  addMidiTrack: (userId: string, name?: string, midiSettings?: Partial<MidiInputSettings>, userName?: string) => UserTrack;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<UserTrack>) => void;
  updateTrackSettings: (trackId: string, settings: Partial<TrackAudioSettings>) => void;
  updateMidiSettings: (trackId: string, settings: Partial<MidiInputSettings>) => void;
  setActiveMidiNotes: (trackId: string, notes: number[]) => void;
  updateTrackEffects: (trackId: string, effects: Partial<TrackEffectsChain>) => void;
  updateGuitarEffects: (trackId: string, effects: Partial<GuitarEffectsChain>) => void;
  loadGuitarPreset: (trackId: string, presetId: string) => void;
  updateTrackChannelConfig: (trackId: string, channelConfig: InputChannelConfig) => void;
  setTrackInputGain: (trackId: string, gainDb: number) => void;
  setTrackMonitoring: (trackId: string, enabled: boolean, volume?: number) => void;
  loadPreset: (trackId: string, presetId: string) => void;

  // Track state actions
  setTrackMuted: (trackId: string, muted: boolean) => void;
  setTrackSolo: (trackId: string, solo: boolean) => void;
  setTrackVolume: (trackId: string, volume: number) => void;
  setTrackArmed: (trackId: string, armed: boolean) => void;
  setTrackRecording: (trackId: string, recording: boolean) => void;
  setTrackStream: (trackId: string, stream: MediaStream | undefined) => void;

  // Level actions
  setTrackLevel: (trackId: string, level: number) => void;

  // Device actions
  loadDevices: () => Promise<void>;
  loadDevicesWithChannels: () => Promise<void>;
  setInputDevices: (devices: ExtendedDeviceInfo[]) => void;
  setOutputDevices: (devices: ExtendedDeviceInfo[]) => void;
  getDeviceChannelCount: (deviceId: string) => number;

  // Query helpers
  getTracksByUser: (userId: string) => UserTrack[];
  getMidiTracksByUser: (userId: string) => UserTrack[];
  getAudioTracksByUser: (userId: string) => UserTrack[];
  getTrack: (trackId: string) => UserTrack | undefined;
  getAllTracks: () => UserTrack[];
  getAllMidiTracks: () => UserTrack[];
  getInactiveTracks: () => UserTrack[];
  getTracksByOwner: (ownerUserId: string) => UserTrack[];

  // Ownership and persistence actions
  setUserTracksActive: (userId: string, active: boolean) => void;
  assignTrackToUser: (trackId: string, newUserId: string, newUserName?: string) => void;
  restoreUserTracks: (tracks: UserTrack[]) => void;
  loadPersistedTracks: (tracks: UserTrack[]) => void;

  // Reset
  reset: () => void;
  removeUserTracks: (userId: string) => void;
}

let colorIndex = 0;
const getNextColor = () => {
  const color = TRACK_COLORS[colorIndex % TRACK_COLORS.length];
  colorIndex++;
  return color;
};

export const useUserTracksStore = create<UserTracksState>()(
  subscribeWithSelector((set, get) => ({
    tracks: new Map(),
    userTrackOrder: new Map(),
    trackLevels: new Map(),
    inputDevices: [],
    outputDevices: [],
    devicesLoaded: false,
    deviceChannels: new Map(),

    addTrack: (userId, name, settings, userName, trackType = 'audio', midiSettings) => {
      const state = get();
      const userTracks = state.userTrackOrder.get(userId) || [];
      const trackNumber = userTracks.length + 1;

      const track: UserTrack = {
        id: `${userId}-track-${Date.now()}`,
        userId,
        name: name || `Track ${trackNumber}`,
        color: getNextColor(),
        type: trackType,
        audioSettings: { ...DEFAULT_AUDIO_SETTINGS, ...settings },
        midiSettings: trackType === 'midi' ? { ...DEFAULT_MIDI_SETTINGS, ...midiSettings } : undefined,
        isMuted: false,
        isSolo: false,
        volume: 1,
        isArmed: true, // New tracks are armed by default
        isRecording: false,
        createdAt: Date.now(),
        // Ownership fields
        ownerUserId: userId,
        ownerUserName: userName,
        isActive: true,
        // MIDI-specific
        activeMidiNotes: trackType === 'midi' ? [] : undefined,
      };

      set((state) => {
        const tracks = new Map(state.tracks);
        tracks.set(track.id, track);

        const userTrackOrder = new Map(state.userTrackOrder);
        const order = userTrackOrder.get(userId) || [];
        userTrackOrder.set(userId, [...order, track.id]);

        return { tracks, userTrackOrder };
      });

      return track;
    },

    addMidiTrack: (userId, name, midiSettings, userName) => {
      const state = get();
      const userTracks = state.userTrackOrder.get(userId) || [];
      const trackNumber = userTracks.length + 1;

      const track: UserTrack = {
        id: `${userId}-midi-${Date.now()}`,
        userId,
        name: name || `MIDI ${trackNumber}`,
        color: getNextColor(),
        type: 'midi',
        audioSettings: DEFAULT_AUDIO_SETTINGS, // Required but not used for MIDI
        midiSettings: { ...DEFAULT_MIDI_SETTINGS, ...midiSettings },
        isMuted: false,
        isSolo: false,
        volume: 1,
        isArmed: true,
        isRecording: false,
        createdAt: Date.now(),
        ownerUserId: userId,
        ownerUserName: userName,
        isActive: true,
        activeMidiNotes: [],
      };

      set((state) => {
        const tracks = new Map(state.tracks);
        tracks.set(track.id, track);

        const userTrackOrder = new Map(state.userTrackOrder);
        const order = userTrackOrder.get(userId) || [];
        userTrackOrder.set(userId, [...order, track.id]);

        return { tracks, userTrackOrder };
      });

      return track;
    },

    removeTrack: (trackId) =>
      set((state) => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const tracks = new Map(state.tracks);
        tracks.delete(trackId);

        const userTrackOrder = new Map(state.userTrackOrder);
        const order = userTrackOrder.get(track.userId) || [];
        userTrackOrder.set(
          track.userId,
          order.filter((id) => id !== trackId)
        );

        const trackLevels = new Map(state.trackLevels);
        trackLevels.delete(trackId);

        return { tracks, userTrackOrder, trackLevels };
      }),

    updateTrack: (trackId, updates) =>
      set((state) => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const tracks = new Map(state.tracks);
        tracks.set(trackId, { ...track, ...updates });
        return { tracks };
      }),

    updateTrackSettings: (trackId, settings) =>
      set((state) => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const tracks = new Map(state.tracks);
        tracks.set(trackId, {
          ...track,
          audioSettings: { ...track.audioSettings, ...settings },
        });
        return { tracks };
      }),

    updateMidiSettings: (trackId, settings) =>
      set((state) => {
        const track = state.tracks.get(trackId);
        if (!track || track.type !== 'midi') return state;

        const tracks = new Map(state.tracks);
        tracks.set(trackId, {
          ...track,
          midiSettings: { ...DEFAULT_MIDI_SETTINGS, ...track.midiSettings, ...settings },
        });
        return { tracks };
      }),

    setActiveMidiNotes: (trackId, notes) =>
      set((state) => {
        const track = state.tracks.get(trackId);
        if (!track || track.type !== 'midi') return state;

        const tracks = new Map(state.tracks);
        tracks.set(trackId, {
          ...track,
          activeMidiNotes: notes,
        });
        return { tracks };
      }),

    updateTrackEffects: (trackId, effects) =>
      set((state) => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const tracks = new Map(state.tracks);
        const currentEffects = track.audioSettings.effects || DEFAULT_EFFECTS_CHAIN;
        const newEffects: TrackEffectsChain = {
          noiseGate: effects.noiseGate ? { ...currentEffects.noiseGate, ...effects.noiseGate } : currentEffects.noiseGate,
          eq: effects.eq ? {
            enabled: effects.eq.enabled ?? currentEffects.eq.enabled,
            bands: effects.eq.bands ?? currentEffects.eq.bands,
          } : currentEffects.eq,
          compressor: effects.compressor ? { ...currentEffects.compressor, ...effects.compressor } : currentEffects.compressor,
          reverb: effects.reverb ? { ...currentEffects.reverb, ...effects.reverb } : currentEffects.reverb,
          limiter: effects.limiter ? { ...currentEffects.limiter, ...effects.limiter } : currentEffects.limiter,
        };

        tracks.set(trackId, {
          ...track,
          audioSettings: {
            ...track.audioSettings,
            effects: newEffects,
            activePreset: undefined, // Clear preset when manually editing
          },
        });
        return { tracks };
      }),

    updateTrackChannelConfig: (trackId, channelConfig) =>
      set((state) => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const tracks = new Map(state.tracks);
        tracks.set(trackId, {
          ...track,
          audioSettings: {
            ...track.audioSettings,
            channelConfig,
          },
        });
        return { tracks };
      }),

    setTrackInputGain: (trackId, gainDb) =>
      set((state) => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const tracks = new Map(state.tracks);
        tracks.set(trackId, {
          ...track,
          audioSettings: {
            ...track.audioSettings,
            inputGain: Math.max(-24, Math.min(24, gainDb)),
          },
        });
        return { tracks };
      }),

    setTrackMonitoring: (trackId, enabled, volume) =>
      set((state) => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const tracks = new Map(state.tracks);
        tracks.set(trackId, {
          ...track,
          audioSettings: {
            ...track.audioSettings,
            directMonitoring: enabled,
            ...(volume !== undefined && { monitoringVolume: volume }),
          },
        });
        return { tracks };
      }),

    loadPreset: (trackId, presetId) =>
      set((state) => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const preset = EFFECT_PRESETS.find((p) => p.id === presetId);
        if (!preset) return state;

        const tracks = new Map(state.tracks);
        tracks.set(trackId, {
          ...track,
          audioSettings: {
            ...track.audioSettings,
            effects: JSON.parse(JSON.stringify(preset.effects)), // Deep clone
            activePreset: presetId,
          },
        });
        return { tracks };
      }),

    updateGuitarEffects: (trackId, effects) =>
      set((state) => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const tracks = new Map(state.tracks);
        const currentGuitarEffects = (track.audioSettings as { guitarEffects?: GuitarEffectsChain }).guitarEffects || DEFAULT_GUITAR_EFFECTS;

        // Merge the new effects with existing ones
        const newGuitarEffects: GuitarEffectsChain = {
          wah: effects.wah ? { ...currentGuitarEffects.wah, ...effects.wah } : currentGuitarEffects.wah,
          overdrive: effects.overdrive ? { ...currentGuitarEffects.overdrive, ...effects.overdrive } : currentGuitarEffects.overdrive,
          distortion: effects.distortion ? { ...currentGuitarEffects.distortion, ...effects.distortion } : currentGuitarEffects.distortion,
          ampSimulator: effects.ampSimulator ? { ...currentGuitarEffects.ampSimulator, ...effects.ampSimulator } : currentGuitarEffects.ampSimulator,
          cabinet: effects.cabinet ? { ...currentGuitarEffects.cabinet, ...effects.cabinet } : currentGuitarEffects.cabinet,
          chorus: effects.chorus ? { ...currentGuitarEffects.chorus, ...effects.chorus } : currentGuitarEffects.chorus,
          flanger: effects.flanger ? { ...currentGuitarEffects.flanger, ...effects.flanger } : currentGuitarEffects.flanger,
          phaser: effects.phaser ? { ...currentGuitarEffects.phaser, ...effects.phaser } : currentGuitarEffects.phaser,
          delay: effects.delay ? { ...currentGuitarEffects.delay, ...effects.delay } : currentGuitarEffects.delay,
          tremolo: effects.tremolo ? { ...currentGuitarEffects.tremolo, ...effects.tremolo } : currentGuitarEffects.tremolo,
        };

        tracks.set(trackId, {
          ...track,
          audioSettings: {
            ...track.audioSettings,
            guitarEffects: newGuitarEffects,
            guitarPreset: undefined, // Clear preset when manually editing
          } as TrackAudioSettings & { guitarEffects: GuitarEffectsChain; guitarPreset?: string },
        });
        return { tracks };
      }),

    loadGuitarPreset: (trackId, presetId) =>
      set((state) => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const preset = GUITAR_PRESETS.find((p) => p.id === presetId);
        if (!preset) return state;

        const tracks = new Map(state.tracks);
        tracks.set(trackId, {
          ...track,
          audioSettings: {
            ...track.audioSettings,
            guitarEffects: JSON.parse(JSON.stringify(preset.effects)), // Deep clone
            guitarPreset: presetId,
          } as TrackAudioSettings & { guitarEffects: GuitarEffectsChain; guitarPreset: string },
        });
        return { tracks };
      }),

    setTrackMuted: (trackId, muted) => get().updateTrack(trackId, { isMuted: muted }),
    setTrackSolo: (trackId, solo) => get().updateTrack(trackId, { isSolo: solo }),
    setTrackVolume: (trackId, volume) => get().updateTrack(trackId, { volume }),
    setTrackArmed: (trackId, armed) => get().updateTrack(trackId, { isArmed: armed }),
    setTrackRecording: (trackId, recording) => get().updateTrack(trackId, { isRecording: recording }),
    setTrackStream: (trackId, stream) => get().updateTrack(trackId, { stream }),

    setTrackLevel: (trackId, level) =>
      set((state) => {
        const trackLevels = new Map(state.trackLevels);
        trackLevels.set(trackId, level);
        return { trackLevels };
      }),

    loadDevices: async () => {
      try {
        // Request permission first to get device labels
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tempStream.getTracks().forEach((t) => t.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();

        const inputs = devices.filter((d) => d.kind === 'audioinput');
        const outputs = devices.filter((d) => d.kind === 'audiooutput');

        set({ inputDevices: inputs, outputDevices: outputs, devicesLoaded: true });
      } catch {
        set({ devicesLoaded: true });
      }
    },

    loadDevicesWithChannels: async () => {
      try {
        // Request permission first
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tempStream.getTracks().forEach((t) => t.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices.filter((d) => d.kind === 'audioinput');
        const outputs = devices.filter((d) => d.kind === 'audiooutput');

        // Probe each input device for channel count
        const deviceChannels = new Map<string, number>();
        const extendedInputs: ExtendedDeviceInfo[] = [];

        for (const device of inputs) {
          let channelCount = 2; // Default to stereo

          try {
            // Try to get the actual channel count by opening the device
            const testStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                deviceId: { exact: device.deviceId },
                channelCount: { ideal: 32 }, // Request max channels
              },
            });

            const audioTrack = testStream.getAudioTracks()[0];
            if (audioTrack) {
              const settings = audioTrack.getSettings();
              channelCount = settings.channelCount || 2;
            }
            testStream.getTracks().forEach((t) => t.stop());
          } catch {
            // Device might not support high channel count, that's ok
          }

          deviceChannels.set(device.deviceId, channelCount);
          extendedInputs.push({
            ...device,
            channelCount,
            maxChannels: channelCount,
          } as ExtendedDeviceInfo);
        }

        set({
          inputDevices: extendedInputs,
          outputDevices: outputs,
          deviceChannels,
          devicesLoaded: true,
        });
      } catch {
        set({ devicesLoaded: true });
      }
    },

    setInputDevices: (devices) => set({ inputDevices: devices }),
    setOutputDevices: (devices) => set({ outputDevices: devices }),

    getDeviceChannelCount: (deviceId) => {
      const state = get();
      return state.deviceChannels.get(deviceId) || 2;
    },

    getTracksByUser: (userId) => {
      const state = get();
      const order = state.userTrackOrder.get(userId) || [];
      return order
        .map((id) => state.tracks.get(id))
        .filter((t): t is UserTrack => t !== undefined);
    },

    getMidiTracksByUser: (userId) => {
      const state = get();
      const order = state.userTrackOrder.get(userId) || [];
      return order
        .map((id) => state.tracks.get(id))
        .filter((t): t is UserTrack => t !== undefined && t.type === 'midi');
    },

    getAudioTracksByUser: (userId) => {
      const state = get();
      const order = state.userTrackOrder.get(userId) || [];
      return order
        .map((id) => state.tracks.get(id))
        .filter((t): t is UserTrack => t !== undefined && (t.type === 'audio' || !t.type));
    },

    getTrack: (trackId) => get().tracks.get(trackId),

    getAllTracks: () => {
      const state = get();
      const allTracks: UserTrack[] = [];
      for (const [, order] of state.userTrackOrder) {
        for (const trackId of order) {
          const track = state.tracks.get(trackId);
          if (track) allTracks.push(track);
        }
      }
      return allTracks;
    },

    getAllMidiTracks: () => {
      const state = get();
      const midiTracks: UserTrack[] = [];
      for (const [, order] of state.userTrackOrder) {
        for (const trackId of order) {
          const track = state.tracks.get(trackId);
          if (track && track.type === 'midi') midiTracks.push(track);
        }
      }
      return midiTracks;
    },

    getInactiveTracks: () => {
      const state = get();
      const inactiveTracks: UserTrack[] = [];
      for (const track of state.tracks.values()) {
        if (track.isActive === false) {
          inactiveTracks.push(track);
        }
      }
      return inactiveTracks;
    },

    getTracksByOwner: (ownerUserId) => {
      const state = get();
      const tracks: UserTrack[] = [];
      for (const track of state.tracks.values()) {
        if (track.ownerUserId === ownerUserId) {
          tracks.push(track);
        }
      }
      return tracks;
    },

    setUserTracksActive: (userId, active) =>
      set((state) => {
        const tracks = new Map(state.tracks);
        for (const [id, track] of tracks) {
          if (track.userId === userId) {
            tracks.set(id, { ...track, isActive: active });
          }
        }
        return { tracks };
      }),

    assignTrackToUser: (trackId, newUserId, newUserName) =>
      set((state) => {
        const track = state.tracks.get(trackId);
        if (!track) return state;

        const oldUserId = track.userId;
        const tracks = new Map(state.tracks);
        const userTrackOrder = new Map(state.userTrackOrder);

        // Update track ownership
        tracks.set(trackId, {
          ...track,
          userId: newUserId,
          isActive: true,
        });

        // Remove from old user's order
        const oldOrder = userTrackOrder.get(oldUserId) || [];
        userTrackOrder.set(
          oldUserId,
          oldOrder.filter((id) => id !== trackId)
        );

        // Add to new user's order
        const newOrder = userTrackOrder.get(newUserId) || [];
        userTrackOrder.set(newUserId, [...newOrder, trackId]);

        return { tracks, userTrackOrder };
      }),

    restoreUserTracks: (tracksToRestore) =>
      set((state) => {
        const tracks = new Map(state.tracks);
        const userTrackOrder = new Map(state.userTrackOrder);

        for (const track of tracksToRestore) {
          // Restore track and mark as active
          tracks.set(track.id, { ...track, isActive: true });

          // Add to user track order if not already there
          const order = userTrackOrder.get(track.userId) || [];
          if (!order.includes(track.id)) {
            userTrackOrder.set(track.userId, [...order, track.id]);
          }
        }

        return { tracks, userTrackOrder };
      }),

    loadPersistedTracks: (persistedTracks) =>
      set((state) => {
        const tracks = new Map(state.tracks);
        const userTrackOrder = new Map(state.userTrackOrder);

        for (const track of persistedTracks) {
          // Don't overwrite existing tracks (already loaded)
          if (!tracks.has(track.id)) {
            tracks.set(track.id, track);

            // Add to user track order
            const order = userTrackOrder.get(track.userId) || [];
            if (!order.includes(track.id)) {
              userTrackOrder.set(track.userId, [...order, track.id]);
            }
          }
        }

        return { tracks, userTrackOrder };
      }),

    removeUserTracks: (userId) =>
      set((state) => {
        const order = state.userTrackOrder.get(userId) || [];
        const tracks = new Map(state.tracks);
        const trackLevels = new Map(state.trackLevels);

        for (const trackId of order) {
          tracks.delete(trackId);
          trackLevels.delete(trackId);
        }

        const userTrackOrder = new Map(state.userTrackOrder);
        userTrackOrder.delete(userId);

        return { tracks, userTrackOrder, trackLevels };
      }),

    reset: () => {
      colorIndex = 0;
      set({
        tracks: new Map(),
        userTrackOrder: new Map(),
        trackLevels: new Map(),
        deviceChannels: new Map(),
      });
    },
  }))
);
