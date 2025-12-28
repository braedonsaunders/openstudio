// Room Permission System Types

export interface TransportPermissions {
  play: boolean;
  pause: boolean;
  seek: boolean;
  skipTrack: boolean;
  loopControl: boolean;
}

export interface TempoPermissions {
  setBpm: boolean;
  setSource: boolean;
  setTimeSignature: boolean;
  setKey: boolean;
  setScale: boolean;
  metronomeControl: boolean;
}

export interface TracksPermissions {
  addToQueue: boolean;
  removeFromQueue: boolean;
  reorderQueue: boolean;
  editMetadata: boolean;
  uploadBackingTrack: boolean;
  createSong: boolean;
  editSongArrangement: boolean;
  deleteSong: boolean;
}

export interface MixerPermissions {
  stemControl: boolean;
  stemToggle: boolean;
  masterVolume: boolean;
  ownTrackVolume: boolean;
  otherUserVolume: boolean;
  muteOtherUsers: boolean;
}

export interface EffectsPermissions {
  ownEffects: boolean;
  masterEffects: boolean;
  applyPresets: boolean;
  savePresets: boolean;
}

export interface RecordingPermissions {
  record: boolean;
  createLoop: boolean;
  editLoops: boolean;
  deleteLoops: boolean;
}

export interface AIPermissions {
  stemSeparation: boolean;
  generateMusic: boolean;
  generateLyrics: boolean;
  useAssistant: boolean;
}

export interface ChatPermissions {
  sendMessages: boolean;
  sendReactions: boolean;
  shareLinks: boolean;
  voiceChat: boolean;
  videoChat: boolean;
  screenShare: boolean;
}

export interface RoomManagementPermissions {
  editSettings: boolean;
  editName: boolean;
  manageUsers: boolean;
  manageRoles: boolean;
  inviteUsers: boolean;
}

export interface RoomPermissions {
  transport: TransportPermissions;
  tempo: TempoPermissions;
  tracks: TracksPermissions;
  mixer: MixerPermissions;
  effects: EffectsPermissions;
  recording: RecordingPermissions;
  ai: AIPermissions;
  chat: ChatPermissions;
  room: RoomManagementPermissions;
}

export type RoomRole = 'owner' | 'co-host' | 'performer' | 'member' | 'listener';

export interface RoomMember {
  id: string;
  oduserId: string;
  userName: string;
  userAvatar?: string;
  role: RoomRole;
  customPermissions?: Partial<RoomPermissions>;
  joinedAt: string;
  lastActiveAt: string;
  invitedBy?: string;
  isBanned?: boolean;
  banReason?: string;
}

export interface RoleInfo {
  id: RoomRole;
  name: string;
  icon: string;
  description: string;
  color: string;
}

export const ROLE_INFO: Record<RoomRole, RoleInfo> = {
  owner: {
    id: 'owner',
    name: 'Owner',
    icon: '👑',
    description: 'Full control over the room',
    color: 'text-yellow-500',
  },
  'co-host': {
    id: 'co-host',
    name: 'Co-Host',
    icon: '🎤',
    description: 'Can manage room and moderate users',
    color: 'text-purple-500',
  },
  performer: {
    id: 'performer',
    name: 'Performer',
    icon: '🎸',
    description: 'Can record and perform',
    color: 'text-blue-500',
  },
  member: {
    id: 'member',
    name: 'Member',
    icon: '👤',
    description: 'Basic participation',
    color: 'text-green-500',
  },
  listener: {
    id: 'listener',
    name: 'Listener',
    icon: '👁',
    description: 'Listen and watch only',
    color: 'text-gray-500',
  },
};

// Permission category labels for UI
export const PERMISSION_CATEGORIES = {
  transport: {
    label: 'Transport & Playback',
    icon: 'Play',
    permissions: {
      play: 'Play',
      pause: 'Pause',
      seek: 'Seek',
      skipTrack: 'Skip Track',
      loopControl: 'Loop Control',
    },
  },
  tempo: {
    label: 'Tempo & Musical Settings',
    icon: 'Music',
    permissions: {
      setBpm: 'Set BPM',
      setSource: 'Change Tempo Source',
      setTimeSignature: 'Set Time Signature',
      setKey: 'Set Key',
      setScale: 'Set Scale',
      metronomeControl: 'Metronome Control',
    },
  },
  tracks: {
    label: 'Track Management',
    icon: 'ListMusic',
    permissions: {
      addToQueue: 'Add to Queue',
      removeFromQueue: 'Remove from Queue',
      reorderQueue: 'Reorder Queue',
      editMetadata: 'Edit Metadata',
      uploadBackingTrack: 'Upload Backing Track',
      createSong: 'Create Song',
      editSongArrangement: 'Edit Song Arrangement',
      deleteSong: 'Delete Song',
    },
  },
  mixer: {
    label: 'Mixer Controls',
    icon: 'Sliders',
    permissions: {
      stemControl: 'Adjust Stem Volumes',
      stemToggle: 'Toggle Stems',
      masterVolume: 'Master Volume',
      ownTrackVolume: 'Own Track Volume',
      otherUserVolume: 'Other User Volumes',
      muteOtherUsers: 'Mute Other Users',
    },
  },
  effects: {
    label: 'Effects',
    icon: 'Sparkles',
    permissions: {
      ownEffects: 'Own Track Effects',
      masterEffects: 'Master Effects',
      applyPresets: 'Apply Presets',
      savePresets: 'Save Presets',
    },
  },
  recording: {
    label: 'Recording',
    icon: 'Mic',
    permissions: {
      record: 'Record Audio',
      createLoop: 'Create Loops',
      editLoops: 'Edit Loops',
      deleteLoops: 'Delete Loops',
    },
  },
  ai: {
    label: 'AI Features',
    icon: 'Bot',
    permissions: {
      stemSeparation: 'Stem Separation',
      generateMusic: 'Generate Music',
      generateLyrics: 'Generate Lyrics',
      useAssistant: 'AI Assistant',
    },
  },
  chat: {
    label: 'Communication',
    icon: 'MessageSquare',
    permissions: {
      sendMessages: 'Send Messages',
      sendReactions: 'Send Reactions',
      shareLinks: 'Share Links',
      voiceChat: 'Voice Chat',
      videoChat: 'Video Chat',
      screenShare: 'Screen Share',
    },
  },
  room: {
    label: 'Room Management',
    icon: 'Settings',
    permissions: {
      editSettings: 'Edit Settings',
      editName: 'Edit Room Name',
      manageUsers: 'Manage Users',
      manageRoles: 'Manage Roles',
      inviteUsers: 'Invite Users',
    },
  },
} as const;

// Default permission sets for each role
const ALL_TRUE: RoomPermissions = {
  transport: { play: true, pause: true, seek: true, skipTrack: true, loopControl: true },
  tempo: { setBpm: true, setSource: true, setTimeSignature: true, setKey: true, setScale: true, metronomeControl: true },
  tracks: { addToQueue: true, removeFromQueue: true, reorderQueue: true, editMetadata: true, uploadBackingTrack: true, createSong: true, editSongArrangement: true, deleteSong: true },
  mixer: { stemControl: true, stemToggle: true, masterVolume: true, ownTrackVolume: true, otherUserVolume: true, muteOtherUsers: true },
  effects: { ownEffects: true, masterEffects: true, applyPresets: true, savePresets: true },
  recording: { record: true, createLoop: true, editLoops: true, deleteLoops: true },
  ai: { stemSeparation: true, generateMusic: true, generateLyrics: true, useAssistant: true },
  chat: { sendMessages: true, sendReactions: true, shareLinks: true, voiceChat: true, videoChat: true, screenShare: true },
  room: { editSettings: true, editName: true, manageUsers: true, manageRoles: true, inviteUsers: true },
};

const ALL_FALSE: RoomPermissions = {
  transport: { play: false, pause: false, seek: false, skipTrack: false, loopControl: false },
  tempo: { setBpm: false, setSource: false, setTimeSignature: false, setKey: false, setScale: false, metronomeControl: false },
  tracks: { addToQueue: false, removeFromQueue: false, reorderQueue: false, editMetadata: false, uploadBackingTrack: false, createSong: false, editSongArrangement: false, deleteSong: false },
  mixer: { stemControl: false, stemToggle: false, masterVolume: false, ownTrackVolume: false, otherUserVolume: false, muteOtherUsers: false },
  effects: { ownEffects: false, masterEffects: false, applyPresets: false, savePresets: false },
  recording: { record: false, createLoop: false, editLoops: false, deleteLoops: false },
  ai: { stemSeparation: false, generateMusic: false, generateLyrics: false, useAssistant: false },
  chat: { sendMessages: false, sendReactions: false, shareLinks: false, voiceChat: false, videoChat: false, screenShare: false },
  room: { editSettings: false, editName: false, manageUsers: false, manageRoles: false, inviteUsers: false },
};

export const ROLE_PERMISSIONS: Record<RoomRole, RoomPermissions> = {
  owner: ALL_TRUE,

  'co-host': {
    ...ALL_TRUE,
    room: {
      editSettings: true,
      editName: true,
      manageUsers: true,
      manageRoles: true,
      inviteUsers: true,
    },
  },

  performer: {
    transport: { play: false, pause: false, seek: false, skipTrack: false, loopControl: false },
    tempo: { setBpm: false, setSource: false, setTimeSignature: false, setKey: false, setScale: false, metronomeControl: false },
    tracks: { addToQueue: true, removeFromQueue: false, reorderQueue: false, editMetadata: false, uploadBackingTrack: true, createSong: false, editSongArrangement: false, deleteSong: false },
    mixer: { stemControl: false, stemToggle: false, masterVolume: false, ownTrackVolume: true, otherUserVolume: false, muteOtherUsers: false },
    effects: { ownEffects: true, masterEffects: false, applyPresets: true, savePresets: true },
    recording: { record: true, createLoop: true, editLoops: true, deleteLoops: true },
    ai: { stemSeparation: true, generateMusic: false, generateLyrics: false, useAssistant: true },
    chat: { sendMessages: true, sendReactions: true, shareLinks: true, voiceChat: true, videoChat: true, screenShare: false },
    room: { editSettings: false, editName: false, manageUsers: false, manageRoles: false, inviteUsers: false },
  },

  member: {
    transport: { play: false, pause: false, seek: false, skipTrack: false, loopControl: false },
    tempo: { setBpm: false, setSource: false, setTimeSignature: false, setKey: false, setScale: false, metronomeControl: false },
    tracks: { addToQueue: false, removeFromQueue: false, reorderQueue: false, editMetadata: false, uploadBackingTrack: false, createSong: false, editSongArrangement: false, deleteSong: false },
    mixer: { stemControl: false, stemToggle: false, masterVolume: false, ownTrackVolume: true, otherUserVolume: false, muteOtherUsers: false },
    effects: { ownEffects: true, masterEffects: false, applyPresets: true, savePresets: false },
    recording: { record: false, createLoop: false, editLoops: false, deleteLoops: false },
    ai: { stemSeparation: false, generateMusic: false, generateLyrics: false, useAssistant: false },
    chat: { sendMessages: true, sendReactions: true, shareLinks: true, voiceChat: true, videoChat: true, screenShare: false },
    room: { editSettings: false, editName: false, manageUsers: false, manageRoles: false, inviteUsers: false },
  },

  listener: {
    ...ALL_FALSE,
    mixer: { ...ALL_FALSE.mixer, ownTrackVolume: true },
    chat: { sendMessages: true, sendReactions: true, shareLinks: false, voiceChat: false, videoChat: false, screenShare: false },
  },
};

// Utility to merge custom permissions with role defaults
export function getEffectivePermissions(
  role: RoomRole,
  customPermissions?: Partial<RoomPermissions>
): RoomPermissions {
  const basePermissions = ROLE_PERMISSIONS[role];

  if (!customPermissions) {
    return basePermissions;
  }

  // Deep merge custom permissions over base
  const merged = JSON.parse(JSON.stringify(basePermissions)) as RoomPermissions;

  for (const category of Object.keys(customPermissions) as Array<keyof RoomPermissions>) {
    if (customPermissions[category]) {
      (merged as unknown as Record<string, Record<string, boolean>>)[category] = {
        ...(merged[category] as unknown as Record<string, boolean>),
        ...(customPermissions[category] as unknown as Record<string, boolean>),
      };
    }
  }

  return merged;
}

// Check if a specific permission differs from role default
export function isPermissionOverridden(
  role: RoomRole,
  category: keyof RoomPermissions,
  permission: string,
  customPermissions?: Partial<RoomPermissions>
): boolean {
  if (!customPermissions || !customPermissions[category]) {
    return false;
  }

  const baseValue = (ROLE_PERMISSIONS[role][category] as Record<string, boolean>)[permission];
  const customValue = (customPermissions[category] as Record<string, boolean>)[permission];

  return customValue !== undefined && customValue !== baseValue;
}

// Count enabled permissions in a category
export function countCategoryPermissions(
  permissions: RoomPermissions,
  category: keyof RoomPermissions
): { enabled: number; total: number } {
  const categoryPerms = permissions[category] as unknown as Record<string, boolean>;
  const values = Object.values(categoryPerms);
  return {
    enabled: values.filter(v => v).length,
    total: values.length,
  };
}
