import { create } from 'zustand';

// Participant in voice chat
export interface VoiceChatParticipant {
  id: string;
  name: string;
  isMuted: boolean;        // Are they muted by themselves
  isMutedByMe: boolean;    // Have I muted them locally
  volume: number;          // 0-1, my local volume for them
  isSpeaking: boolean;     // Are they currently speaking
  audioLevel: number;      // Current audio level 0-1
  stream: MediaStream | null;
}

interface AudioChatState {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;

  // Local state
  localStream: MediaStream | null;
  isSelfMuted: boolean;
  isMasterMuted: boolean;  // Mute all incoming audio
  localAudioLevel: number;

  // Participants (remote users in voice chat)
  participants: Map<string, VoiceChatParticipant>;

  // Audio context for playback
  audioContext: AudioContext | null;
  gainNodes: Map<string, GainNode>;

  // Device selection
  selectedInputDevice: string | null;
  selectedInputChannel: number;  // 0 = all/stereo, 1 = left/ch1, 2 = right/ch2, etc.
  availableChannels: number;     // Number of channels on the selected device

  // Actions
  setConnected: (connected: boolean) => void;
  setConnecting: (connecting: boolean) => void;
  setError: (error: string | null) => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setSelfMuted: (muted: boolean) => void;
  setMasterMuted: (muted: boolean) => void;
  setLocalAudioLevel: (level: number) => void;

  // Participant actions
  addParticipant: (participant: VoiceChatParticipant) => void;
  removeParticipant: (id: string) => void;
  updateParticipant: (id: string, updates: Partial<VoiceChatParticipant>) => void;
  setParticipantMutedByMe: (id: string, muted: boolean) => void;
  setParticipantVolume: (id: string, volume: number) => void;
  setParticipantSpeaking: (id: string, speaking: boolean) => void;
  setParticipantAudioLevel: (id: string, level: number) => void;

  // Audio context actions
  setAudioContext: (ctx: AudioContext | null) => void;
  setGainNode: (participantId: string, node: GainNode) => void;
  removeGainNode: (participantId: string) => void;

  // Device actions
  setSelectedInputDevice: (deviceId: string | null) => void;
  setSelectedInputChannel: (channel: number) => void;
  setAvailableChannels: (channels: number) => void;

  // Bulk actions
  muteAllParticipants: () => void;
  unmuteAllParticipants: () => void;

  // Reset
  reset: () => void;
}

export const useAudioChatStore = create<AudioChatState>((set, get) => ({
  isConnected: false,
  isConnecting: false,
  error: null,
  localStream: null,
  isSelfMuted: false,
  isMasterMuted: false,
  localAudioLevel: 0,
  participants: new Map(),
  audioContext: null,
  gainNodes: new Map(),
  selectedInputDevice: null,
  selectedInputChannel: 0,
  availableChannels: 2,

  setConnected: (connected) => set({ isConnected: connected }),
  setConnecting: (connecting) => set({ isConnecting: connecting }),
  setError: (error) => set({ error }),
  setLocalStream: (stream) => set({ localStream: stream }),
  setSelfMuted: (muted) => set({ isSelfMuted: muted }),
  setMasterMuted: (muted) => {
    set({ isMasterMuted: muted });
    // Apply master mute to all gain nodes
    const { gainNodes, audioContext } = get();
    if (audioContext) {
      gainNodes.forEach((node) => {
        node.gain.value = muted ? 0 : 1;
      });
    }
  },
  setLocalAudioLevel: (level) => set({ localAudioLevel: level }),

  addParticipant: (participant) =>
    set((state) => {
      const participants = new Map(state.participants);
      participants.set(participant.id, participant);
      return { participants };
    }),

  removeParticipant: (id) =>
    set((state) => {
      const participants = new Map(state.participants);
      participants.delete(id);
      const gainNodes = new Map(state.gainNodes);
      const node = gainNodes.get(id);
      if (node) {
        node.disconnect();
        gainNodes.delete(id);
      }
      return { participants, gainNodes };
    }),

  updateParticipant: (id, updates) =>
    set((state) => {
      const participants = new Map(state.participants);
      const participant = participants.get(id);
      if (participant) {
        participants.set(id, { ...participant, ...updates });
      }
      return { participants };
    }),

  setParticipantMutedByMe: (id, muted) => {
    const { participants, gainNodes, isMasterMuted } = get();
    const participant = participants.get(id);
    if (participant) {
      const newParticipants = new Map(participants);
      newParticipants.set(id, { ...participant, isMutedByMe: muted });
      set({ participants: newParticipants });

      // Update gain node
      const gainNode = gainNodes.get(id);
      if (gainNode && !isMasterMuted) {
        gainNode.gain.value = muted ? 0 : participant.volume;
      }
    }
  },

  setParticipantVolume: (id, volume) => {
    const { participants, gainNodes, isMasterMuted } = get();
    const participant = participants.get(id);
    if (participant) {
      const newParticipants = new Map(participants);
      newParticipants.set(id, { ...participant, volume });
      set({ participants: newParticipants });

      // Update gain node
      const gainNode = gainNodes.get(id);
      if (gainNode && !isMasterMuted && !participant.isMutedByMe) {
        gainNode.gain.value = volume;
      }
    }
  },

  setParticipantSpeaking: (id, speaking) =>
    set((state) => {
      const participants = new Map(state.participants);
      const participant = participants.get(id);
      if (participant) {
        participants.set(id, { ...participant, isSpeaking: speaking });
      }
      return { participants };
    }),

  setParticipantAudioLevel: (id, level) =>
    set((state) => {
      const participants = new Map(state.participants);
      const participant = participants.get(id);
      if (participant) {
        participants.set(id, { ...participant, audioLevel: level });
      }
      return { participants };
    }),

  setAudioContext: (ctx) => set({ audioContext: ctx }),

  setGainNode: (participantId, node) =>
    set((state) => {
      const gainNodes = new Map(state.gainNodes);
      gainNodes.set(participantId, node);
      return { gainNodes };
    }),

  removeGainNode: (participantId) =>
    set((state) => {
      const gainNodes = new Map(state.gainNodes);
      const node = gainNodes.get(participantId);
      if (node) {
        node.disconnect();
        gainNodes.delete(participantId);
      }
      return { gainNodes };
    }),

  setSelectedInputDevice: (deviceId) => set({ selectedInputDevice: deviceId, selectedInputChannel: 0 }),
  setSelectedInputChannel: (channel) => set({ selectedInputChannel: channel }),
  setAvailableChannels: (channels) => set({ availableChannels: channels }),

  muteAllParticipants: () => {
    const { participants, gainNodes } = get();
    const newParticipants = new Map(participants);
    participants.forEach((p, id) => {
      newParticipants.set(id, { ...p, isMutedByMe: true });
      const gainNode = gainNodes.get(id);
      if (gainNode) {
        gainNode.gain.value = 0;
      }
    });
    set({ participants: newParticipants });
  },

  unmuteAllParticipants: () => {
    const { participants, gainNodes, isMasterMuted } = get();
    const newParticipants = new Map(participants);
    participants.forEach((p, id) => {
      newParticipants.set(id, { ...p, isMutedByMe: false });
      const gainNode = gainNodes.get(id);
      if (gainNode && !isMasterMuted) {
        gainNode.gain.value = p.volume;
      }
    });
    set({ participants: newParticipants });
  },

  reset: () => {
    const { localStream, gainNodes, audioContext } = get();

    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    // Disconnect all gain nodes
    gainNodes.forEach((node) => node.disconnect());

    // Close audio context
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close();
    }

    set({
      isConnected: false,
      isConnecting: false,
      error: null,
      localStream: null,
      isSelfMuted: false,
      isMasterMuted: false,
      localAudioLevel: 0,
      participants: new Map(),
      audioContext: null,
      gainNodes: new Map(),
      selectedInputDevice: null,
      selectedInputChannel: 0,
      availableChannels: 2,
    });
  },
}));
