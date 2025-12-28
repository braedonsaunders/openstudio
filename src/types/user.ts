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

// Instrument icon type for Lucide icons
export type InstrumentIconName =
  | 'Guitar'
  | 'Music'
  | 'Piano'
  | 'Drum'
  | 'Mic'
  | 'Mic2'
  | 'Music2'
  | 'Music3'
  | 'Music4'
  | 'Headphones'
  | 'Radio'
  | 'Volume2'
  | 'Waves'
  | 'Zap'
  | 'Wind'
  | 'Sparkles'
  | 'AudioWaveform'
  | 'CircleDot'
  | 'Disc'
  | 'Disc2'
  | 'Disc3';

export interface InstrumentDefinition {
  name: string;
  category: InstrumentCategory;
  icon: InstrumentIconName;
  emoji: string;
  color: string; // Tailwind color class for theming
}

// Exhaustive instrument types with icons
export const INSTRUMENTS: Record<string, InstrumentDefinition> = {
  // Guitar family
  'electric-guitar': { name: 'Electric Guitar', category: 'guitar', icon: 'Guitar', emoji: '🎸', color: 'red' },
  'acoustic-guitar': { name: 'Acoustic Guitar', category: 'guitar', icon: 'Guitar', emoji: '🎸', color: 'amber' },
  'bass-guitar': { name: 'Bass Guitar', category: 'guitar', icon: 'Guitar', emoji: '🎸', color: 'purple' },
  'classical-guitar': { name: 'Classical Guitar', category: 'guitar', icon: 'Guitar', emoji: '🎸', color: 'orange' },
  '12-string-guitar': { name: '12-String Guitar', category: 'guitar', icon: 'Guitar', emoji: '🎸', color: 'yellow' },
  'steel-guitar': { name: 'Steel Guitar', category: 'guitar', icon: 'Guitar', emoji: '🎸', color: 'slate' },
  'resonator-guitar': { name: 'Resonator Guitar', category: 'guitar', icon: 'Guitar', emoji: '🎸', color: 'zinc' },
  'fretless-bass': { name: 'Fretless Bass', category: 'guitar', icon: 'Guitar', emoji: '🎸', color: 'violet' },
  '7-string-guitar': { name: '7-String Guitar', category: 'guitar', icon: 'Guitar', emoji: '🎸', color: 'rose' },
  '8-string-guitar': { name: '8-String Guitar', category: 'guitar', icon: 'Guitar', emoji: '🎸', color: 'fuchsia' },
  'baritone-guitar': { name: 'Baritone Guitar', category: 'guitar', icon: 'Guitar', emoji: '🎸', color: 'indigo' },

  // Keyboard family
  'piano': { name: 'Piano', category: 'keyboard', icon: 'Piano', emoji: '🎹', color: 'slate' },
  'synth': { name: 'Synthesizer', category: 'keyboard', icon: 'Piano', emoji: '🎹', color: 'cyan' },
  'organ': { name: 'Organ', category: 'keyboard', icon: 'Piano', emoji: '🎹', color: 'amber' },
  'midi-controller': { name: 'MIDI Controller', category: 'keyboard', icon: 'Piano', emoji: '🎹', color: 'blue' },
  'electric-piano': { name: 'Electric Piano', category: 'keyboard', icon: 'Piano', emoji: '🎹', color: 'teal' },
  'rhodes': { name: 'Rhodes', category: 'keyboard', icon: 'Piano', emoji: '🎹', color: 'emerald' },
  'wurlitzer': { name: 'Wurlitzer', category: 'keyboard', icon: 'Piano', emoji: '🎹', color: 'orange' },
  'clavinet': { name: 'Clavinet', category: 'keyboard', icon: 'Piano', emoji: '🎹', color: 'lime' },
  'harpsichord': { name: 'Harpsichord', category: 'keyboard', icon: 'Piano', emoji: '🎹', color: 'yellow' },
  'accordion': { name: 'Accordion', category: 'keyboard', icon: 'Piano', emoji: '🪗', color: 'red' },
  'melodica': { name: 'Melodica', category: 'keyboard', icon: 'Piano', emoji: '🎹', color: 'pink' },
  'keytar': { name: 'Keytar', category: 'keyboard', icon: 'Piano', emoji: '🎹', color: 'purple' },
  'modular-synth': { name: 'Modular Synth', category: 'keyboard', icon: 'Waves', emoji: '🎛️', color: 'violet' },
  'analog-synth': { name: 'Analog Synth', category: 'keyboard', icon: 'Waves', emoji: '🎛️', color: 'fuchsia' },

  // Drums & Percussion
  'drums': { name: 'Drums', category: 'drums', icon: 'Drum', emoji: '🥁', color: 'red' },
  'electronic-drums': { name: 'Electronic Drums', category: 'drums', icon: 'Drum', emoji: '🥁', color: 'blue' },
  'percussion': { name: 'Percussion', category: 'drums', icon: 'Drum', emoji: '🥁', color: 'orange' },
  'congas': { name: 'Congas', category: 'drums', icon: 'Drum', emoji: '🥁', color: 'amber' },
  'bongos': { name: 'Bongos', category: 'drums', icon: 'Drum', emoji: '🥁', color: 'yellow' },
  'djembe': { name: 'Djembe', category: 'drums', icon: 'Drum', emoji: '🥁', color: 'orange' },
  'cajon': { name: 'Cajon', category: 'drums', icon: 'Drum', emoji: '🥁', color: 'amber' },
  'timpani': { name: 'Timpani', category: 'drums', icon: 'Drum', emoji: '🥁', color: 'slate' },
  'vibraphone': { name: 'Vibraphone', category: 'drums', icon: 'Music2', emoji: '🎵', color: 'cyan' },
  'marimba': { name: 'Marimba', category: 'drums', icon: 'Music2', emoji: '🎵', color: 'amber' },
  'xylophone': { name: 'Xylophone', category: 'drums', icon: 'Music2', emoji: '🎵', color: 'yellow' },
  'glockenspiel': { name: 'Glockenspiel', category: 'drums', icon: 'Music2', emoji: '🎵', color: 'sky' },
  'steel-drums': { name: 'Steel Drums', category: 'drums', icon: 'Drum', emoji: '🥁', color: 'teal' },
  'tabla': { name: 'Tabla', category: 'drums', icon: 'Drum', emoji: '🥁', color: 'orange' },
  'tambourine': { name: 'Tambourine', category: 'drums', icon: 'CircleDot', emoji: '🎵', color: 'yellow' },
  'shaker': { name: 'Shaker', category: 'drums', icon: 'Music2', emoji: '🎵', color: 'lime' },
  'hand-pan': { name: 'Hand Pan', category: 'drums', icon: 'Disc', emoji: '🥁', color: 'indigo' },

  // Vocals
  'lead-vocals': { name: 'Lead Vocals', category: 'vocals', icon: 'Mic', emoji: '🎤', color: 'pink' },
  'backing-vocals': { name: 'Backing Vocals', category: 'vocals', icon: 'Mic2', emoji: '🎤', color: 'rose' },
  'beatbox': { name: 'Beatbox', category: 'vocals', icon: 'Mic', emoji: '🎤', color: 'purple' },
  'rap': { name: 'Rap', category: 'vocals', icon: 'Mic', emoji: '🎤', color: 'violet' },
  'soprano': { name: 'Soprano', category: 'vocals', icon: 'Mic', emoji: '🎤', color: 'pink' },
  'alto': { name: 'Alto', category: 'vocals', icon: 'Mic', emoji: '🎤', color: 'rose' },
  'tenor': { name: 'Tenor', category: 'vocals', icon: 'Mic', emoji: '🎤', color: 'blue' },
  'baritone': { name: 'Baritone', category: 'vocals', icon: 'Mic', emoji: '🎤', color: 'indigo' },
  'bass-vocals': { name: 'Bass Vocals', category: 'vocals', icon: 'Mic', emoji: '🎤', color: 'purple' },
  'spoken-word': { name: 'Spoken Word', category: 'vocals', icon: 'Mic', emoji: '🎤', color: 'slate' },
  'screaming-vocals': { name: 'Screaming/Growl', category: 'vocals', icon: 'Mic', emoji: '🎤', color: 'red' },
  'falsetto': { name: 'Falsetto', category: 'vocals', icon: 'Mic', emoji: '🎤', color: 'sky' },

  // Strings
  'violin': { name: 'Violin', category: 'strings', icon: 'Music', emoji: '🎻', color: 'amber' },
  'cello': { name: 'Cello', category: 'strings', icon: 'Music', emoji: '🎻', color: 'orange' },
  'viola': { name: 'Viola', category: 'strings', icon: 'Music', emoji: '🎻', color: 'amber' },
  'double-bass': { name: 'Double Bass', category: 'strings', icon: 'Music', emoji: '🎻', color: 'amber' },
  'electric-violin': { name: 'Electric Violin', category: 'strings', icon: 'Music', emoji: '🎻', color: 'blue' },
  'harp': { name: 'Harp', category: 'strings', icon: 'Music', emoji: '🎵', color: 'yellow' },
  'mandolin': { name: 'Mandolin', category: 'strings', icon: 'Music', emoji: '🎵', color: 'amber' },
  'sitar': { name: 'Sitar', category: 'strings', icon: 'Music', emoji: '🎵', color: 'orange' },
  'oud': { name: 'Oud', category: 'strings', icon: 'Music', emoji: '🎵', color: 'amber' },
  'erhu': { name: 'Erhu', category: 'strings', icon: 'Music', emoji: '🎻', color: 'red' },
  'koto': { name: 'Koto', category: 'strings', icon: 'Music', emoji: '🎵', color: 'pink' },
  'dulcimer': { name: 'Dulcimer', category: 'strings', icon: 'Music', emoji: '🎵', color: 'amber' },
  'lute': { name: 'Lute', category: 'strings', icon: 'Music', emoji: '🎵', color: 'yellow' },
  'zither': { name: 'Zither', category: 'strings', icon: 'Music', emoji: '🎵', color: 'amber' },

  // Wind instruments
  'saxophone': { name: 'Saxophone', category: 'wind', icon: 'Wind', emoji: '🎷', color: 'yellow' },
  'alto-sax': { name: 'Alto Saxophone', category: 'wind', icon: 'Wind', emoji: '🎷', color: 'yellow' },
  'tenor-sax': { name: 'Tenor Saxophone', category: 'wind', icon: 'Wind', emoji: '🎷', color: 'amber' },
  'soprano-sax': { name: 'Soprano Saxophone', category: 'wind', icon: 'Wind', emoji: '🎷', color: 'yellow' },
  'baritone-sax': { name: 'Baritone Saxophone', category: 'wind', icon: 'Wind', emoji: '🎷', color: 'orange' },
  'trumpet': { name: 'Trumpet', category: 'wind', icon: 'Wind', emoji: '🎺', color: 'yellow' },
  'trombone': { name: 'Trombone', category: 'wind', icon: 'Wind', emoji: '🎺', color: 'amber' },
  'french-horn': { name: 'French Horn', category: 'wind', icon: 'Wind', emoji: '🎺', color: 'yellow' },
  'tuba': { name: 'Tuba', category: 'wind', icon: 'Wind', emoji: '🎺', color: 'slate' },
  'cornet': { name: 'Cornet', category: 'wind', icon: 'Wind', emoji: '🎺', color: 'yellow' },
  'flugelhorn': { name: 'Flugelhorn', category: 'wind', icon: 'Wind', emoji: '🎺', color: 'amber' },
  'flute': { name: 'Flute', category: 'wind', icon: 'Wind', emoji: '🎵', color: 'slate' },
  'piccolo': { name: 'Piccolo', category: 'wind', icon: 'Wind', emoji: '🎵', color: 'sky' },
  'clarinet': { name: 'Clarinet', category: 'wind', icon: 'Wind', emoji: '🎵', color: 'slate' },
  'bass-clarinet': { name: 'Bass Clarinet', category: 'wind', icon: 'Wind', emoji: '🎵', color: 'slate' },
  'oboe': { name: 'Oboe', category: 'wind', icon: 'Wind', emoji: '🎵', color: 'amber' },
  'bassoon': { name: 'Bassoon', category: 'wind', icon: 'Wind', emoji: '🎵', color: 'amber' },
  'english-horn': { name: 'English Horn', category: 'wind', icon: 'Wind', emoji: '🎵', color: 'amber' },
  'recorder': { name: 'Recorder', category: 'wind', icon: 'Wind', emoji: '🎵', color: 'lime' },
  'pan-flute': { name: 'Pan Flute', category: 'wind', icon: 'Wind', emoji: '🎵', color: 'amber' },
  'bagpipes': { name: 'Bagpipes', category: 'wind', icon: 'Wind', emoji: '🎵', color: 'green' },
  'didgeridoo': { name: 'Didgeridoo', category: 'wind', icon: 'Wind', emoji: '🎵', color: 'amber' },
  'ocarina': { name: 'Ocarina', category: 'wind', icon: 'Wind', emoji: '🎵', color: 'sky' },
  'shakuhachi': { name: 'Shakuhachi', category: 'wind', icon: 'Wind', emoji: '🎵', color: 'amber' },

  // Electronic
  'dj': { name: 'DJ', category: 'electronic', icon: 'Headphones', emoji: '🎧', color: 'purple' },
  'producer': { name: 'Producer', category: 'electronic', icon: 'AudioWaveform', emoji: '🎛️', color: 'blue' },
  'sampler': { name: 'Sampler', category: 'electronic', icon: 'Disc2', emoji: '🎛️', color: 'cyan' },
  'looper': { name: 'Looper', category: 'electronic', icon: 'Disc3', emoji: '🔁', color: 'green' },
  'turntablist': { name: 'Turntablist', category: 'electronic', icon: 'Disc', emoji: '💿', color: 'slate' },
  'drum-machine': { name: 'Drum Machine', category: 'electronic', icon: 'AudioWaveform', emoji: '🥁', color: 'orange' },
  'vocoder': { name: 'Vocoder', category: 'electronic', icon: 'Mic', emoji: '🎤', color: 'violet' },
  'theremin': { name: 'Theremin', category: 'electronic', icon: 'Waves', emoji: '🎵', color: 'purple' },
  'ableton': { name: 'Ableton Live', category: 'electronic', icon: 'AudioWaveform', emoji: '💻', color: 'yellow' },
  'fl-studio': { name: 'FL Studio', category: 'electronic', icon: 'AudioWaveform', emoji: '💻', color: 'orange' },
  'logic-pro': { name: 'Logic Pro', category: 'electronic', icon: 'AudioWaveform', emoji: '💻', color: 'slate' },
  'eurorack': { name: 'Eurorack', category: 'electronic', icon: 'Waves', emoji: '🎛️', color: 'violet' },
  'groovebox': { name: 'Groovebox', category: 'electronic', icon: 'AudioWaveform', emoji: '🎛️', color: 'pink' },
  'launchpad': { name: 'Launchpad', category: 'electronic', icon: 'Disc2', emoji: '🎛️', color: 'green' },

  // Other instruments
  'harmonica': { name: 'Harmonica', category: 'other', icon: 'Music', emoji: '🎵', color: 'blue' },
  'ukulele': { name: 'Ukulele', category: 'other', icon: 'Guitar', emoji: '🎸', color: 'amber' },
  'banjo': { name: 'Banjo', category: 'other', icon: 'Music', emoji: '🪕', color: 'amber' },
  'kalimba': { name: 'Kalimba', category: 'other', icon: 'Music', emoji: '🎵', color: 'cyan' },
  'jaw-harp': { name: 'Jaw Harp', category: 'other', icon: 'Music', emoji: '🎵', color: 'slate' },
  'kazoo': { name: 'Kazoo', category: 'other', icon: 'Music', emoji: '🎵', color: 'yellow' },
  'glass-harmonica': { name: 'Glass Harmonica', category: 'other', icon: 'Music', emoji: '🎵', color: 'sky' },
  'hang-drum': { name: 'Hang Drum', category: 'other', icon: 'Disc', emoji: '🥁', color: 'slate' },
  'tongue-drum': { name: 'Tongue Drum', category: 'other', icon: 'Disc', emoji: '🥁', color: 'amber' },
  'hurdy-gurdy': { name: 'Hurdy-Gurdy', category: 'other', icon: 'Music', emoji: '🎵', color: 'amber' },
  'autoharp': { name: 'Autoharp', category: 'other', icon: 'Music', emoji: '🎵', color: 'teal' },
  'omnichord': { name: 'Omnichord', category: 'other', icon: 'Piano', emoji: '🎹', color: 'pink' },
  'stylophone': { name: 'Stylophone', category: 'other', icon: 'Music', emoji: '🎵', color: 'lime' },
  'otamatone': { name: 'Otamatone', category: 'other', icon: 'Music', emoji: '🎵', color: 'yellow' },
  'musical-saw': { name: 'Musical Saw', category: 'other', icon: 'Waves', emoji: '🎵', color: 'slate' },
  'sound-design': { name: 'Sound Design', category: 'other', icon: 'Sparkles', emoji: '✨', color: 'violet' },
  'foley': { name: 'Foley Artist', category: 'other', icon: 'Volume2', emoji: '🔊', color: 'slate' },
  'field-recording': { name: 'Field Recording', category: 'other', icon: 'Mic', emoji: '🎙️', color: 'green' },
  'other': { name: 'Other', category: 'other', icon: 'Music', emoji: '🎵', color: 'gray' },
};

// Legacy compatibility: get icon as emoji string
export function getInstrumentEmoji(instrumentId: string): string {
  return INSTRUMENTS[instrumentId]?.emoji || '🎵';
}

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

// ============================================
// SAVED TRACK PRESETS
// ============================================

// Track type for saved presets
export type SavedTrackType = 'audio' | 'midi';

// Complete saved track preset with all settings
export interface SavedTrackPreset {
  id: string;
  userId: string;
  name: string;
  description?: string;

  // Track identity
  type: SavedTrackType;
  instrumentId: string; // Reference to INSTRUMENTS
  color: string; // Tailwind color or hex

  // Audio Settings (for audio tracks)
  audioSettings?: {
    inputMode: 'microphone' | 'application';
    inputDeviceId?: string; // Optional - will use default if not set
    sampleRate: 48000 | 44100;
    bufferSize: 32 | 64 | 128 | 256 | 512 | 1024;
    noiseSuppression: boolean;
    echoCancellation: boolean;
    autoGainControl: boolean;
    channelConfig: {
      channelCount: 1 | 2;
      leftChannel: number;
      rightChannel?: number;
    };
    inputGain: number; // dB (-24 to 24)
    directMonitoring: boolean;
    monitoringVolume: number; // 0 to 1
  };

  // MIDI Settings (for MIDI tracks)
  midiSettings?: {
    deviceId?: string; // Optional - will use default if not set
    channel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 'all';
    soundBank: string;
    soundPreset: string;
    velocityCurve: 'linear' | 'soft' | 'hard';
    arpeggiator?: {
      enabled: boolean;
      mode: 'up' | 'down' | 'updown' | 'random' | 'order';
      rate: '1/4' | '1/8' | '1/16' | '1/32';
      octaves: 1 | 2 | 3 | 4;
      gate: number;
    };
  };

  // Mixer settings
  volume: number; // 0 to 1
  isMuted: boolean;
  isSolo: boolean;

  // Effects chain (all 15 effects with full settings)
  // This is a JSON blob of UnifiedEffectsChain from types/index.ts
  effects: Record<string, unknown>;

  // Active effect preset reference (if using a preset)
  activeEffectPreset?: string;

  // Metadata
  isDefault: boolean; // User's default track for this instrument
  useCount: number; // Track how often this preset is used
  createdAt: string;
  updatedAt: string;
}

// For the join room modal - track selection
export interface SavedTrackSelection {
  presetId: string;
  selected: boolean;
}

// Default track preset colors based on instrument category
export const TRACK_PRESET_COLORS: Record<InstrumentCategory, string[]> = {
  guitar: ['#ef4444', '#f97316', '#f59e0b', '#dc2626', '#ea580c'],
  keyboard: ['#3b82f6', '#6366f1', '#8b5cf6', '#0ea5e9', '#06b6d4'],
  drums: ['#f97316', '#ef4444', '#eab308', '#f59e0b', '#fbbf24'],
  vocals: ['#ec4899', '#f43f5e', '#d946ef', '#a855f7', '#e879f9'],
  strings: ['#f59e0b', '#d97706', '#b45309', '#ca8a04', '#eab308'],
  wind: ['#eab308', '#fbbf24', '#f59e0b', '#facc15', '#fde047'],
  electronic: ['#8b5cf6', '#a855f7', '#d946ef', '#c026d3', '#e879f9'],
  other: ['#64748b', '#94a3b8', '#6b7280', '#9ca3af', '#78716c'],
};
