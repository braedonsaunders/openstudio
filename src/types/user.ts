// User Account System Types

// ============================================
// USER PROFILE
// ============================================

// Music tags that users can add to their profile
export const MUSIC_TAGS = {
  genres: [
    'Rock', 'Jazz', 'Blues', 'Metal', 'Pop', 'Hip Hop', 'R&B', 'Electronic',
    'Classical', 'Folk', 'Country', 'Funk', 'Soul', 'Reggae', 'Punk',
    'Indie', 'Alternative', 'Ambient', 'Lo-Fi', 'Experimental'
  ],
  skills: [
    'Beginner', 'Intermediate', 'Advanced', 'Pro', 'Session Musician',
    'Producer', 'Songwriter', 'Composer', 'Arranger', 'Teacher'
  ],
  lookingFor: [
    'Jam Sessions', 'Band Members', 'Collaboration', 'Feedback',
    'Learning', 'Teaching', 'Recording', 'Live Performance', 'Fun'
  ],
  vibes: [
    'Chill', 'High Energy', 'Experimental', 'Traditional', 'Creative',
    'Technical', 'Improvisation', 'Structured', 'Laid Back', 'Competitive'
  ]
} as const;

export type MusicTagCategory = keyof typeof MUSIC_TAGS;

export interface UserMusicTags {
  genres: string[];
  instruments: string[];
  skills: string[];
  lookingFor: string[];
  vibes: string[];
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  bio: string;

  // Type & Status
  accountType: 'free' | 'pro' | 'admin';
  isVerified: boolean;
  isBanned: boolean;
  banReason?: string;
  banExpiresAt?: string;

  // Progression
  totalXp: number;
  level: number;

  // Streaks
  currentDailyStreak: number;
  longestDailyStreak: number;
  lastActiveDate?: string;
  streakFreezes: number;

  // Music Tags - for discovery in the lobby
  musicTags?: UserMusicTags;

  // Social Links
  links: {
    spotify?: string;
    soundcloud?: string;
    youtube?: string;
    instagram?: string;
    website?: string;
  };

  // Privacy Settings
  privacy: {
    profileVisibility: 'public' | 'friends' | 'private';
    showStats: boolean;
    showActivity: boolean;
    allowFriendRequests: boolean;
    allowRoomInvites: boolean;
  };

  // Preferences
  preferences: UserPreferences;

  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastOnlineAt?: string;
}

export interface UserPreferences {
  // Audio Defaults
  defaultSampleRate: 48000 | 44100;
  defaultBufferSize: 32 | 64 | 128 | 256 | 512 | 1024;
  autoJitterBuffer: boolean;
  inputDevice?: string;
  outputDevice?: string;

  // UI Preferences
  theme: 'dark' | 'light' | 'system';
  accentColor: string;
  compactMode: boolean;
  showTutorialTips: boolean;

  // Notifications
  emailNotifications: boolean;
  soundNotifications: boolean;
}

// ============================================
// AVATAR
// ============================================

export interface Avatar {
  // Base
  baseStyle: 'human' | 'robot' | 'creature' | 'abstract';
  skinTone: string;

  // Head
  head: {
    shape: string;
    hair: HairStyle;
    eyes: EyeStyle;
    eyebrows: string;
    nose: string;
    mouth: string;
    facialHair?: string;
    accessories: string[];
  };

  // Body
  body: {
    type: string;
    outfit: Outfit;
  };

  // Expression
  expression: 'neutral' | 'happy' | 'focused' | 'excited' | 'chill';

  // Effects
  effects: {
    aura?: string;
    particles?: string;
    animation?: string;
  };

  // Frame
  frame?: string;

  // Background
  background: {
    type: 'solid' | 'gradient' | 'pattern' | 'animated';
    colors: string[];
    pattern?: string;
  };
}

export interface HairStyle {
  style: string;
  color: string;
}

export interface EyeStyle {
  style: string;
  color: string;
}

export interface Outfit {
  top: string;
  topColor: string;
  bottom: string;
  bottomColor: string;
}

export interface AvatarItem {
  id: string;
  category: 'hair' | 'eyes' | 'outfit' | 'accessory' | 'effect' | 'frame' | 'background';
  name: string;
  itemData: Record<string, unknown>;
  unlockType: 'free' | 'level' | 'achievement' | 'purchase' | 'special';
  unlockRequirement?: {
    level?: number;
    achievement?: string;
  };
  previewUrl?: string;
  isPremium: boolean;
}

// ============================================
// INSTRUMENTS
// ============================================

export type InstrumentCategory =
  | 'guitar'
  | 'keyboard'
  | 'drums'
  | 'vocals'
  | 'strings'
  | 'wind'
  | 'electronic'
  | 'other';

export interface UserInstrument {
  id: string;
  instrumentId: string;
  category: InstrumentCategory;
  isPrimary: boolean;
  variant?: string;
  finish?: string;
  totalHours: number;
  totalSessions: number;
  level: number;
  xp: number;
  lastPlayedAt?: string;
}

export const INSTRUMENTS: Record<string, { name: string; category: InstrumentCategory; icon: string }> = {
  'electric-guitar': { name: 'Electric Guitar', category: 'guitar', icon: '🎸' },
  'acoustic-guitar': { name: 'Acoustic Guitar', category: 'guitar', icon: '🎸' },
  'bass-guitar': { name: 'Bass Guitar', category: 'guitar', icon: '🎸' },
  'classical-guitar': { name: 'Classical Guitar', category: 'guitar', icon: '🎸' },
  'piano': { name: 'Piano', category: 'keyboard', icon: '🎹' },
  'synth': { name: 'Synthesizer', category: 'keyboard', icon: '🎹' },
  'organ': { name: 'Organ', category: 'keyboard', icon: '🎹' },
  'midi-controller': { name: 'MIDI Controller', category: 'keyboard', icon: '🎹' },
  'drums': { name: 'Drums', category: 'drums', icon: '🥁' },
  'electronic-drums': { name: 'Electronic Drums', category: 'drums', icon: '🥁' },
  'percussion': { name: 'Percussion', category: 'drums', icon: '🥁' },
  'lead-vocals': { name: 'Lead Vocals', category: 'vocals', icon: '🎤' },
  'backing-vocals': { name: 'Backing Vocals', category: 'vocals', icon: '🎤' },
  'beatbox': { name: 'Beatbox', category: 'vocals', icon: '🎤' },
  'rap': { name: 'Rap', category: 'vocals', icon: '🎤' },
  'violin': { name: 'Violin', category: 'strings', icon: '🎻' },
  'cello': { name: 'Cello', category: 'strings', icon: '🎻' },
  'viola': { name: 'Viola', category: 'strings', icon: '🎻' },
  'double-bass': { name: 'Double Bass', category: 'strings', icon: '🎻' },
  'saxophone': { name: 'Saxophone', category: 'wind', icon: '🎷' },
  'trumpet': { name: 'Trumpet', category: 'wind', icon: '🎺' },
  'flute': { name: 'Flute', category: 'wind', icon: '🎵' },
  'clarinet': { name: 'Clarinet', category: 'wind', icon: '🎵' },
  'dj': { name: 'DJ', category: 'electronic', icon: '🎧' },
  'producer': { name: 'Producer', category: 'electronic', icon: '🎛️' },
  'sampler': { name: 'Sampler', category: 'electronic', icon: '🎛️' },
  'looper': { name: 'Looper', category: 'electronic', icon: '🔁' },
  'harmonica': { name: 'Harmonica', category: 'other', icon: '🎵' },
  'ukulele': { name: 'Ukulele', category: 'other', icon: '🎸' },
  'banjo': { name: 'Banjo', category: 'other', icon: '🪕' },
  'other': { name: 'Other', category: 'other', icon: '🎵' },
};

// ============================================
// STATS
// ============================================

export interface UserStats {
  // Time Stats
  totalJamSeconds: number;
  averageSessionSeconds: number;
  longestSessionSeconds: number;

  // Session Stats
  totalSessions: number;
  sessionsThisWeek: number;
  sessionsThisMonth: number;

  // Social Stats
  uniqueCollaborators: number;
  reactionsReceived: number;
  reactionsGiven: number;
  messagesSent: number;

  // Room Stats
  roomsCreated: number;
  roomsJoined: number;

  // Contribution Stats
  tracksUploaded: number;
  tracksGenerated: number;
  stemsSeparated: number;

  // Activity Patterns
  activityByHour: number[];
  activityByDay: number[];
}

// ============================================
// ACHIEVEMENTS
// ============================================

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  xpReward: number;
  criteria: {
    type: string;
    count?: number;
    [key: string]: unknown;
  };
  isHidden: boolean;
}

export interface UserAchievement {
  achievementId: string;
  unlockedAt: string;
}

// ============================================
// CHALLENGES
// ============================================

export interface Challenge {
  id: string;
  type: 'daily' | 'weekly';
  name: string;
  description: string;
  xpReward: number;
  criteria: {
    type: string;
    count: number;
  };
  activeFrom: string;
  activeUntil: string;
}

export interface UserChallenge {
  challengeId: string;
  progress: number;
  target: number;
  isCompleted: boolean;
  completedAt?: string;
}

// ============================================
// SOCIAL
// ============================================

export interface Friendship {
  id: string;
  friendId: string;
  friend?: UserProfile;
  status: 'pending' | 'accepted' | 'blocked';
  requestedAt: string;
  acceptedAt?: string;
  jamsTogether: number;
  totalTimeTogetherSeconds: number;
}

export interface Follow {
  followingId: string;
  following?: UserProfile;
  createdAt: string;
}

export interface UserRating {
  id: string;
  raterId: string;
  overall: number;
  skill?: number;
  vibe?: number;
  reliability?: number;
  helpfulness?: number;
  createdAt: string;
}

// ============================================
// SESSIONS
// ============================================

export interface SessionHistory {
  id: string;
  roomId: string;
  joinedAt: string;
  leftAt?: string;
  durationSeconds?: number;
  instrumentId?: string;
  wasRoomMaster: boolean;
  participantIds: string[];
}

// ============================================
// ROOMS
// ============================================

export interface SavedRoom {
  id: string;
  ownerId: string;
  owner?: UserProfile;
  code: string;
  name: string;
  description: string;
  roomType: 'public' | 'private' | 'friends' | 'scheduled' | 'recurring';
  maxUsers: number;
  genre?: string;
  skillLevel?: 'beginner' | 'intermediate' | 'advanced' | 'any';
  minLevel: number;
  minReputation: number;
  theme: string;
  bannerUrl?: string;
  welcomeMessage?: string;
  rules?: string;
  tags: string[];
  settings: RoomAudioSettings;
  totalSessions: number;
  totalUniqueVisitors: number;
  totalJamSeconds: number;
  createdAt: string;
  updatedAt: string;
  lastActiveAt?: string;
}

export interface RoomAudioSettings {
  sampleRate: 48000 | 44100;
  bitDepth: 16 | 24;
  bufferSize: 32 | 64 | 128 | 256 | 512 | 1024;
  autoJitterBuffer: boolean;
  backingTrackVolume: number;
  masterVolume: number;
}

// ============================================
// CHAT
// ============================================

export interface ChatMessage {
  id: string;
  roomId: string;
  userId?: string;
  user?: UserProfile;
  content: string;
  messageType: 'text' | 'system' | 'reaction' | 'join' | 'leave';
  reactionType?: string;
  targetUserId?: string;
  createdAt: string;
  isDeleted: boolean;
}

// ============================================
// NOTIFICATIONS
// ============================================

export interface Notification {
  id: string;
  type: string;
  title: string;
  message?: string;
  linkType?: string;
  linkId?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

// ============================================
// REPORTS
// ============================================

export interface Report {
  id: string;
  reporterId: string;
  targetType: 'user' | 'room' | 'message' | 'content';
  targetId: string;
  reason: string;
  description?: string;
  evidenceUrls: string[];
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  reviewedBy?: string;
  reviewedAt?: string;
  resolution?: string;
  actionTaken?: string;
  createdAt: string;
}

// ============================================
// XP SYSTEM
// ============================================

export interface XPTransaction {
  id: string;
  amount: number;
  reason: string;
  sourceType?: string;
  sourceId?: string;
  balanceAfter: number;
  createdAt: string;
}

export const XP_ACTIVITIES = {
  // Jamming
  JOIN_ROOM: 10,
  JAM_10_MINUTES: 25,
  JAM_30_MINUTES: 50,
  JAM_1_HOUR: 100,
  JAM_WITH_NEW_PERSON: 15,

  // Social
  FIRST_MESSAGE_IN_ROOM: 5,
  RECEIVE_FIRE_REACTION: 10,
  GIVE_REACTION: 2,
  ADD_FRIEND: 20,
  INVITE_FRIEND_TO_ROOM: 15,

  // Creation
  UPLOAD_TRACK: 30,
  GENERATE_AI_TRACK: 20,
  CREATE_ROOM: 10,

  // Mastery
  UNLOCK_ACHIEVEMENT: 50,
  COMPLETE_DAILY_CHALLENGE: 100,
  COMPLETE_WEEKLY_CHALLENGE: 500,

  // Mentorship
  JAM_WITH_NEW_USER: 25,
  INVITED_USER_LEVELS_UP: 50,
} as const;

// Calculate level from XP
export function calculateLevel(xp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(xp / 100)));
}

// Calculate XP needed for a level
export function xpForLevel(level: number): number {
  return level * level * 100;
}

// Calculate XP progress in current level
export function xpProgress(xp: number): { current: number; required: number; percentage: number } {
  const level = calculateLevel(xp);
  const currentLevelXP = xpForLevel(level);
  const nextLevelXP = xpForLevel(level + 1);
  const current = xp - currentLevelXP;
  const required = nextLevelXP - currentLevelXP;
  return {
    current,
    required,
    percentage: Math.min(100, (current / required) * 100),
  };
}

// Level titles
export function getLevelTitle(level: number): string {
  if (level >= 100) return 'Legend';
  if (level >= 91) return 'Grandmaster';
  if (level >= 76) return 'Master';
  if (level >= 61) return 'Elite';
  if (level >= 51) return 'Expert';
  if (level >= 41) return 'Veteran';
  if (level >= 31) return 'Dedicated';
  if (level >= 21) return 'Enthusiast';
  if (level >= 11) return 'Regular';
  if (level >= 6) return 'Rookie';
  return 'Newcomer';
}

// ============================================
// REACTION TYPES
// ============================================

export const REACTION_TYPES = {
  fire: { emoji: '🔥', label: 'Fire' },
  clap: { emoji: '👏', label: 'Clap' },
  shred: { emoji: '🎸', label: 'Shred' },
  love: { emoji: '❤️', label: 'Love' },
  mindblown: { emoji: '🤯', label: 'Mind Blown' },
  magic: { emoji: '✨', label: 'Magic' },
} as const;

export type ReactionType = keyof typeof REACTION_TYPES;
