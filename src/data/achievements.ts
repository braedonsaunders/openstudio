// Comprehensive Achievements Data for OpenStudio
// This file contains all achievement definitions

import type { Achievement } from '@/types/user';

export type AchievementCategory =
  | 'getting_started'
  | 'jam_sessions'
  | 'time_investment'
  | 'social'
  | 'room_master'
  | 'instrument_mastery'
  | 'creation'
  | 'streak'
  | 'special'
  | 'hidden';

export interface AchievementDefinition extends Achievement {
  category: AchievementCategory;
  hint?: string; // Shown for hidden achievements
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
}

// ============================================
// GETTING STARTED (Onboarding)
// ============================================
const gettingStartedAchievements: AchievementDefinition[] = [
  {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Complete your profile setup',
    category: 'getting_started',
    icon: '👋',
    xpReward: 50,
    criteria: { type: 'profile_complete' },
    isHidden: false,
    tier: 'bronze',
  },
  {
    id: 'finding_your_voice',
    name: 'Finding Your Voice',
    description: 'Set your primary instrument',
    category: 'getting_started',
    icon: '🎵',
    xpReward: 50,
    criteria: { type: 'instrument_set' },
    isHidden: false,
    tier: 'bronze',
  },
  {
    id: 'room_rookie',
    name: 'Room Rookie',
    description: 'Join your first jam room',
    category: 'getting_started',
    icon: '🚪',
    xpReward: 100,
    criteria: { type: 'rooms_joined', count: 1 },
    isHidden: false,
    tier: 'bronze',
  },
  {
    id: 'avatar_artist',
    name: 'Avatar Artist',
    description: 'Customize your avatar',
    category: 'getting_started',
    icon: '🎨',
    xpReward: 50,
    criteria: { type: 'avatar_customized' },
    isHidden: false,
    tier: 'bronze',
  },
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Add your first friend',
    category: 'getting_started',
    icon: '🦋',
    xpReward: 75,
    criteria: { type: 'friends_count', count: 1 },
    isHidden: false,
    tier: 'bronze',
  },
];

// ============================================
// JAM SESSIONS
// ============================================
const jamSessionAchievements: AchievementDefinition[] = [
  {
    id: 'first_jam',
    name: 'First Jam',
    description: 'Complete your first jam session',
    category: 'jam_sessions',
    icon: '🎸',
    xpReward: 100,
    criteria: { type: 'sessions_completed', count: 1 },
    isHidden: false,
    tier: 'bronze',
  },
  {
    id: 'getting_warmed_up',
    name: 'Getting Warmed Up',
    description: 'Complete 5 jam sessions',
    category: 'jam_sessions',
    icon: '🔥',
    xpReward: 150,
    criteria: { type: 'sessions_completed', count: 5 },
    isHidden: false,
    tier: 'bronze',
  },
  {
    id: 'regular_jammer',
    name: 'Regular Jammer',
    description: 'Complete 25 jam sessions',
    category: 'jam_sessions',
    icon: '🎤',
    xpReward: 300,
    criteria: { type: 'sessions_completed', count: 25 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'jam_enthusiast',
    name: 'Jam Enthusiast',
    description: 'Complete 50 jam sessions',
    category: 'jam_sessions',
    icon: '🎹',
    xpReward: 500,
    criteria: { type: 'sessions_completed', count: 50 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'jam_master',
    name: 'Jam Master',
    description: 'Complete 100 jam sessions',
    category: 'jam_sessions',
    icon: '🏆',
    xpReward: 1000,
    criteria: { type: 'sessions_completed', count: 100 },
    isHidden: false,
    tier: 'gold',
  },
  {
    id: 'jam_legend',
    name: 'Jam Legend',
    description: 'Complete 500 jam sessions',
    category: 'jam_sessions',
    icon: '👑',
    xpReward: 2500,
    criteria: { type: 'sessions_completed', count: 500 },
    isHidden: false,
    tier: 'platinum',
  },
  {
    id: 'collaboration_king',
    name: 'Collaboration King',
    description: 'Jam with 10 different musicians',
    category: 'jam_sessions',
    icon: '🤝',
    xpReward: 250,
    criteria: { type: 'unique_collaborators', count: 10 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'networking_pro',
    name: 'Networking Pro',
    description: 'Jam with 50 different musicians',
    category: 'jam_sessions',
    icon: '🌐',
    xpReward: 750,
    criteria: { type: 'unique_collaborators', count: 50 },
    isHidden: false,
    tier: 'gold',
  },
  {
    id: 'community_pillar',
    name: 'Community Pillar',
    description: 'Jam with 100 different musicians',
    category: 'jam_sessions',
    icon: '🏛️',
    xpReward: 1500,
    criteria: { type: 'unique_collaborators', count: 100 },
    isHidden: false,
    tier: 'platinum',
  },
];

// ============================================
// TIME INVESTMENT
// ============================================
const timeInvestmentAchievements: AchievementDefinition[] = [
  {
    id: 'hour_of_jam',
    name: 'Hour of Jam',
    description: 'Spend 1 hour total jamming',
    category: 'time_investment',
    icon: '⏰',
    xpReward: 100,
    criteria: { type: 'total_jam_hours', count: 1 },
    isHidden: false,
    tier: 'bronze',
  },
  {
    id: 'five_hour_player',
    name: 'Five Hour Player',
    description: 'Spend 5 hours total jamming',
    category: 'time_investment',
    icon: '🕐',
    xpReward: 250,
    criteria: { type: 'total_jam_hours', count: 5 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'ten_hour_tribute',
    name: 'Ten Hour Tribute',
    description: 'Spend 10 hours total jamming',
    category: 'time_investment',
    icon: '🎺',
    xpReward: 400,
    criteria: { type: 'total_jam_hours', count: 10 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'day_of_music',
    name: 'Day of Music',
    description: 'Spend 24 hours total jamming',
    category: 'time_investment',
    icon: '☀️',
    xpReward: 750,
    criteria: { type: 'total_jam_hours', count: 24 },
    isHidden: false,
    tier: 'gold',
  },
  {
    id: 'hundred_hour_hero',
    name: 'Hundred Hour Hero',
    description: 'Spend 100 hours total jamming',
    category: 'time_investment',
    icon: '💯',
    xpReward: 2000,
    criteria: { type: 'total_jam_hours', count: 100 },
    isHidden: false,
    tier: 'platinum',
  },
  {
    id: 'marathon_musician',
    name: 'Marathon Musician',
    description: 'Complete a single session over 2 hours',
    category: 'time_investment',
    icon: '🏃',
    xpReward: 300,
    criteria: { type: 'longest_session_hours', count: 2 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'endurance_expert',
    name: 'Endurance Expert',
    description: 'Complete a single session over 4 hours',
    category: 'time_investment',
    icon: '💪',
    xpReward: 600,
    criteria: { type: 'longest_session_hours', count: 4 },
    isHidden: false,
    tier: 'gold',
  },
];

// ============================================
// SOCIAL
// ============================================
const socialAchievements: AchievementDefinition[] = [
  {
    id: 'first_message',
    name: 'First Message',
    description: 'Send your first chat message',
    category: 'social',
    icon: '💬',
    xpReward: 25,
    criteria: { type: 'messages_sent', count: 1 },
    isHidden: false,
    tier: 'bronze',
  },
  {
    id: 'chatty_musician',
    name: 'Chatty Musician',
    description: 'Send 50 chat messages',
    category: 'social',
    icon: '🗣️',
    xpReward: 100,
    criteria: { type: 'messages_sent', count: 50 },
    isHidden: false,
    tier: 'bronze',
  },
  {
    id: 'conversation_starter',
    name: 'Conversation Starter',
    description: 'Send 200 chat messages',
    category: 'social',
    icon: '📢',
    xpReward: 250,
    criteria: { type: 'messages_sent', count: 200 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'friend_finder',
    name: 'Friend Finder',
    description: 'Have 5 friends',
    category: 'social',
    icon: '👥',
    xpReward: 150,
    criteria: { type: 'friends_count', count: 5 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'popular_player',
    name: 'Popular Player',
    description: 'Have 20 friends',
    category: 'social',
    icon: '⭐',
    xpReward: 400,
    criteria: { type: 'friends_count', count: 20 },
    isHidden: false,
    tier: 'gold',
  },
  {
    id: 'super_star',
    name: 'Super Star',
    description: 'Have 50 friends',
    category: 'social',
    icon: '🌟',
    xpReward: 800,
    criteria: { type: 'friends_count', count: 50 },
    isHidden: false,
    tier: 'platinum',
  },
  {
    id: 'fire_starter',
    name: 'Fire Starter',
    description: 'Receive your first fire reaction',
    category: 'social',
    icon: '🔥',
    xpReward: 50,
    criteria: { type: 'reactions_received', count: 1 },
    isHidden: false,
    tier: 'bronze',
  },
  {
    id: 'crowd_pleaser',
    name: 'Crowd Pleaser',
    description: 'Receive 25 reactions',
    category: 'social',
    icon: '👏',
    xpReward: 200,
    criteria: { type: 'reactions_received', count: 25 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'reaction_magnet',
    name: 'Reaction Magnet',
    description: 'Receive 100 reactions',
    category: 'social',
    icon: '🧲',
    xpReward: 500,
    criteria: { type: 'reactions_received', count: 100 },
    isHidden: false,
    tier: 'gold',
  },
  {
    id: 'generous_giver',
    name: 'Generous Giver',
    description: 'Give 50 reactions to others',
    category: 'social',
    icon: '🎁',
    xpReward: 150,
    criteria: { type: 'reactions_given', count: 50 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'hype_master',
    name: 'Hype Master',
    description: 'Give 200 reactions to others',
    category: 'social',
    icon: '📣',
    xpReward: 400,
    criteria: { type: 'reactions_given', count: 200 },
    isHidden: false,
    tier: 'gold',
  },
];

// ============================================
// ROOM MASTER
// ============================================
const roomMasterAchievements: AchievementDefinition[] = [
  {
    id: 'room_creator',
    name: 'Room Creator',
    description: 'Create your first room',
    category: 'room_master',
    icon: '🏠',
    xpReward: 100,
    criteria: { type: 'rooms_created', count: 1 },
    isHidden: false,
    tier: 'bronze',
  },
  {
    id: 'room_architect',
    name: 'Room Architect',
    description: 'Create 5 rooms',
    category: 'room_master',
    icon: '🏗️',
    xpReward: 250,
    criteria: { type: 'rooms_created', count: 5 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'venue_owner',
    name: 'Venue Owner',
    description: 'Create 10 rooms',
    category: 'room_master',
    icon: '🎪',
    xpReward: 500,
    criteria: { type: 'rooms_created', count: 10 },
    isHidden: false,
    tier: 'gold',
  },
  {
    id: 'explorer',
    name: 'Explorer',
    description: 'Join 10 different rooms',
    category: 'room_master',
    icon: '🧭',
    xpReward: 150,
    criteria: { type: 'rooms_joined', count: 10 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'world_traveler',
    name: 'World Traveler',
    description: 'Join 50 different rooms',
    category: 'room_master',
    icon: '✈️',
    xpReward: 400,
    criteria: { type: 'rooms_joined', count: 50 },
    isHidden: false,
    tier: 'gold',
  },
  {
    id: 'global_jammer',
    name: 'Global Jammer',
    description: 'Join 100 different rooms',
    category: 'room_master',
    icon: '🌍',
    xpReward: 800,
    criteria: { type: 'rooms_joined', count: 100 },
    isHidden: false,
    tier: 'platinum',
  },
];

// ============================================
// INSTRUMENT MASTERY
// ============================================
const instrumentMasteryAchievements: AchievementDefinition[] = [
  {
    id: 'guitar_hero',
    name: 'Guitar Hero',
    description: 'Reach level 5 with Guitar',
    category: 'instrument_mastery',
    icon: '🎸',
    xpReward: 300,
    criteria: { type: 'instrument_level', instrument: 'guitar', level: 5 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'keyboard_wizard',
    name: 'Keyboard Wizard',
    description: 'Reach level 5 with Keyboard',
    category: 'instrument_mastery',
    icon: '🎹',
    xpReward: 300,
    criteria: { type: 'instrument_level', instrument: 'keyboard', level: 5 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'beat_keeper',
    name: 'Beat Keeper',
    description: 'Reach level 5 with Drums',
    category: 'instrument_mastery',
    icon: '🥁',
    xpReward: 300,
    criteria: { type: 'instrument_level', instrument: 'drums', level: 5 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'voice_of_an_angel',
    name: 'Voice of an Angel',
    description: 'Reach level 5 with Vocals',
    category: 'instrument_mastery',
    icon: '🎤',
    xpReward: 300,
    criteria: { type: 'instrument_level', instrument: 'vocals', level: 5 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'bass_boss',
    name: 'Bass Boss',
    description: 'Reach level 5 with Bass',
    category: 'instrument_mastery',
    icon: '🎸',
    xpReward: 300,
    criteria: { type: 'instrument_level', instrument: 'bass', level: 5 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'multi_instrumentalist',
    name: 'Multi-Instrumentalist',
    description: 'Play 3 different instruments',
    category: 'instrument_mastery',
    icon: '🎼',
    xpReward: 400,
    criteria: { type: 'instruments_played', count: 3 },
    isHidden: false,
    tier: 'gold',
  },
  {
    id: 'one_man_band',
    name: 'One Man Band',
    description: 'Play 5 different instruments',
    category: 'instrument_mastery',
    icon: '🎭',
    xpReward: 750,
    criteria: { type: 'instruments_played', count: 5 },
    isHidden: false,
    tier: 'platinum',
  },
];

// ============================================
// CREATION
// ============================================
const creationAchievements: AchievementDefinition[] = [
  {
    id: 'first_upload',
    name: 'First Upload',
    description: 'Upload your first track',
    category: 'creation',
    icon: '📤',
    xpReward: 100,
    criteria: { type: 'tracks_uploaded', count: 1 },
    isHidden: false,
    tier: 'bronze',
  },
  {
    id: 'track_collector',
    name: 'Track Collector',
    description: 'Upload 10 tracks',
    category: 'creation',
    icon: '💿',
    xpReward: 300,
    criteria: { type: 'tracks_uploaded', count: 10 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'library_builder',
    name: 'Library Builder',
    description: 'Upload 25 tracks',
    category: 'creation',
    icon: '📚',
    xpReward: 600,
    criteria: { type: 'tracks_uploaded', count: 25 },
    isHidden: false,
    tier: 'gold',
  },
  {
    id: 'ai_explorer',
    name: 'AI Explorer',
    description: 'Generate your first AI track',
    category: 'creation',
    icon: '🤖',
    xpReward: 75,
    criteria: { type: 'tracks_generated', count: 1 },
    isHidden: false,
    tier: 'bronze',
  },
  {
    id: 'ai_composer',
    name: 'AI Composer',
    description: 'Generate 10 AI tracks',
    category: 'creation',
    icon: '🧠',
    xpReward: 250,
    criteria: { type: 'tracks_generated', count: 10 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'stem_separator',
    name: 'Stem Separator',
    description: 'Separate stems from 5 tracks',
    category: 'creation',
    icon: '🔀',
    xpReward: 200,
    criteria: { type: 'stems_separated', count: 5 },
    isHidden: false,
    tier: 'silver',
  },
];

// ============================================
// STREAK
// ============================================
const streakAchievements: AchievementDefinition[] = [
  {
    id: 'streak_starter',
    name: 'Streak Starter',
    description: 'Maintain a 3-day streak',
    category: 'streak',
    icon: '🔥',
    xpReward: 75,
    criteria: { type: 'daily_streak', count: 3 },
    isHidden: false,
    tier: 'bronze',
  },
  {
    id: 'week_warrior',
    name: 'Week Warrior',
    description: 'Maintain a 7-day streak',
    category: 'streak',
    icon: '📅',
    xpReward: 200,
    criteria: { type: 'daily_streak', count: 7 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'two_week_titan',
    name: 'Two Week Titan',
    description: 'Maintain a 14-day streak',
    category: 'streak',
    icon: '💪',
    xpReward: 400,
    criteria: { type: 'daily_streak', count: 14 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'monthly_master',
    name: 'Monthly Master',
    description: 'Maintain a 30-day streak',
    category: 'streak',
    icon: '🗓️',
    xpReward: 750,
    criteria: { type: 'daily_streak', count: 30 },
    isHidden: false,
    tier: 'gold',
  },
  {
    id: 'dedication_deity',
    name: 'Dedication Deity',
    description: 'Maintain a 100-day streak',
    category: 'streak',
    icon: '💯',
    xpReward: 2000,
    criteria: { type: 'daily_streak', count: 100 },
    isHidden: false,
    tier: 'platinum',
  },
  {
    id: 'yearly_legend',
    name: 'Yearly Legend',
    description: 'Maintain a 365-day streak',
    category: 'streak',
    icon: '🏆',
    xpReward: 5000,
    criteria: { type: 'daily_streak', count: 365 },
    isHidden: false,
    tier: 'diamond',
  },
];

// ============================================
// SPECIAL
// ============================================
const specialAchievements: AchievementDefinition[] = [
  {
    id: 'founding_member_2024',
    name: 'Founding Member 2024',
    description: 'Joined OpenStudio in 2024',
    category: 'special',
    icon: '🏛️',
    xpReward: 500,
    criteria: { type: 'founding_member', years: [2024] },
    isHidden: false,
    tier: 'gold',
  },
  {
    id: 'founding_member_2025',
    name: 'Founding Member 2025',
    description: 'Joined OpenStudio in 2025',
    category: 'special',
    icon: '🌟',
    xpReward: 500,
    criteria: { type: 'founding_member', years: [2025] },
    isHidden: false,
    tier: 'gold',
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Complete a session before 8 AM',
    category: 'special',
    icon: '🌅',
    xpReward: 150,
    criteria: { type: 'session_time', before: 8 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Complete a session after midnight',
    category: 'special',
    icon: '🦉',
    xpReward: 150,
    criteria: { type: 'session_time', after: 0, before: 4 },
    isHidden: false,
    tier: 'silver',
  },
  {
    id: 'weekend_warrior',
    name: 'Weekend Warrior',
    description: 'Complete 10 sessions on weekends',
    category: 'special',
    icon: '🎉',
    xpReward: 250,
    criteria: { type: 'weekend_sessions', count: 10 },
    isHidden: false,
    tier: 'silver',
  },
];

// ============================================
// HIDDEN (Secret achievements)
// ============================================
const hiddenAchievements: AchievementDefinition[] = [
  {
    id: 'solo_artist',
    name: 'Solo Artist',
    description: 'Jam alone for an hour',
    category: 'hidden',
    icon: '🎭',
    xpReward: 100,
    criteria: { type: 'solo_jam_minutes', count: 60 },
    isHidden: true,
    hint: 'Sometimes the best jams are solo...',
    tier: 'silver',
  },
  {
    id: 'quick_draw',
    name: 'Quick Draw',
    description: 'Join a room within 10 seconds of it being created',
    category: 'hidden',
    icon: '⚡',
    xpReward: 200,
    criteria: { type: 'quick_join' },
    isHidden: true,
    hint: 'Speed is everything...',
    tier: 'gold',
  },
  {
    id: 'full_house',
    name: 'Full House',
    description: 'Be in a room with the maximum number of users',
    category: 'hidden',
    icon: '🏠',
    xpReward: 300,
    criteria: { type: 'full_room' },
    isHidden: true,
    hint: 'The more the merrier...',
    tier: 'gold',
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Receive 10 fire reactions in a single session',
    category: 'hidden',
    icon: '✨',
    xpReward: 400,
    criteria: { type: 'session_reactions', count: 10 },
    isHidden: true,
    hint: 'Set the room on fire...',
    tier: 'gold',
  },
  {
    id: 'friendly_giant',
    name: 'Friendly Giant',
    description: 'Be the first to welcome 20 new users',
    category: 'hidden',
    icon: '🤗',
    xpReward: 300,
    criteria: { type: 'first_welcomes', count: 20 },
    isHidden: true,
    hint: 'Be the welcoming committee...',
    tier: 'gold',
  },
  {
    id: 'comeback_kid',
    name: 'Comeback Kid',
    description: 'Return after being away for 30+ days',
    category: 'hidden',
    icon: '🔙',
    xpReward: 200,
    criteria: { type: 'comeback_days', count: 30 },
    isHidden: true,
    hint: 'Absence makes the heart grow fonder...',
    tier: 'silver',
  },
  {
    id: 'midnight_maestro',
    name: 'Midnight Maestro',
    description: 'Jam for 2+ hours crossing midnight',
    category: 'hidden',
    icon: '🌙',
    xpReward: 350,
    criteria: { type: 'midnight_session' },
    isHidden: true,
    hint: 'When one day becomes another...',
    tier: 'gold',
  },
];

// ============================================
// COMBINED EXPORT
// ============================================
export const ALL_ACHIEVEMENTS: AchievementDefinition[] = [
  ...gettingStartedAchievements,
  ...jamSessionAchievements,
  ...timeInvestmentAchievements,
  ...socialAchievements,
  ...roomMasterAchievements,
  ...instrumentMasteryAchievements,
  ...creationAchievements,
  ...streakAchievements,
  ...specialAchievements,
  ...hiddenAchievements,
];

// Category display info
export const ACHIEVEMENT_CATEGORIES: Record<AchievementCategory, { name: string; icon: string; description: string }> = {
  getting_started: { name: 'Getting Started', icon: '🚀', description: 'Begin your musical journey' },
  jam_sessions: { name: 'Jam Sessions', icon: '🎵', description: 'Master the art of jamming' },
  time_investment: { name: 'Time Investment', icon: '⏰', description: 'Dedication to your craft' },
  social: { name: 'Social', icon: '👥', description: 'Connect with fellow musicians' },
  room_master: { name: 'Room Master', icon: '🏠', description: 'Create and explore spaces' },
  instrument_mastery: { name: 'Instrument Mastery', icon: '🎸', description: 'Perfect your instruments' },
  creation: { name: 'Creation', icon: '🎨', description: 'Build your music library' },
  streak: { name: 'Streak', icon: '🔥', description: 'Stay consistent' },
  special: { name: 'Special', icon: '⭐', description: 'Unique achievements' },
  hidden: { name: 'Hidden', icon: '❓', description: 'Secret achievements to discover' },
};

// Tier styling
export const ACHIEVEMENT_TIERS = {
  bronze: { color: '#CD7F32', bgColor: 'bg-amber-900/20', textColor: 'text-amber-600', borderColor: 'border-amber-600/30' },
  silver: { color: '#C0C0C0', bgColor: 'bg-gray-400/20', textColor: 'text-gray-400', borderColor: 'border-gray-400/30' },
  gold: { color: '#FFD700', bgColor: 'bg-yellow-500/20', textColor: 'text-yellow-500', borderColor: 'border-yellow-500/30' },
  platinum: { color: '#E5E4E2', bgColor: 'bg-slate-300/20', textColor: 'text-slate-300', borderColor: 'border-slate-300/30' },
  diamond: { color: '#B9F2FF', bgColor: 'bg-cyan-400/20', textColor: 'text-cyan-400', borderColor: 'border-cyan-400/30' },
};

// Helper to get achievements by category
export function getAchievementsByCategory(category: AchievementCategory): AchievementDefinition[] {
  return ALL_ACHIEVEMENTS.filter(a => a.category === category);
}

// Helper to get total XP possible from all achievements
export function getTotalPossibleXP(): number {
  return ALL_ACHIEVEMENTS.reduce((sum, a) => sum + a.xpReward, 0);
}

// Helper to calculate achievement progress
export function getAchievementProgress(
  achievement: AchievementDefinition,
  stats: {
    totalSessions?: number;
    uniqueCollaborators?: number;
    totalJamSeconds?: number;
    longestSessionSeconds?: number;
    messagesSent?: number;
    friendsCount?: number;
    reactionsReceived?: number;
    reactionsGiven?: number;
    roomsCreated?: number;
    roomsJoined?: number;
    tracksUploaded?: number;
    tracksGenerated?: number;
    stemsSeparated?: number;
    dailyStreak?: number;
    instrumentsPlayed?: number;
  }
): { current: number; target: number; percentage: number } {
  const criteria = achievement.criteria;
  let current = 0;
  let target = criteria.count || 1;

  switch (criteria.type) {
    case 'sessions_completed':
      current = stats.totalSessions || 0;
      break;
    case 'unique_collaborators':
      current = stats.uniqueCollaborators || 0;
      break;
    case 'total_jam_hours':
      current = (stats.totalJamSeconds || 0) / 3600;
      target = criteria.count || 1;
      break;
    case 'longest_session_hours':
      current = (stats.longestSessionSeconds || 0) / 3600;
      target = criteria.count || 1;
      break;
    case 'messages_sent':
      current = stats.messagesSent || 0;
      break;
    case 'friends_count':
      current = stats.friendsCount || 0;
      break;
    case 'reactions_received':
      current = stats.reactionsReceived || 0;
      break;
    case 'reactions_given':
      current = stats.reactionsGiven || 0;
      break;
    case 'rooms_created':
      current = stats.roomsCreated || 0;
      break;
    case 'rooms_joined':
      current = stats.roomsJoined || 0;
      break;
    case 'tracks_uploaded':
      current = stats.tracksUploaded || 0;
      break;
    case 'tracks_generated':
      current = stats.tracksGenerated || 0;
      break;
    case 'stems_separated':
      current = stats.stemsSeparated || 0;
      break;
    case 'daily_streak':
      current = stats.dailyStreak || 0;
      break;
    case 'instruments_played':
      current = stats.instrumentsPlayed || 0;
      break;
    default:
      // For achievements without trackable progress
      return { current: 0, target: 1, percentage: 0 };
  }

  const percentage = Math.min(100, (current / target) * 100);
  return { current, target, percentage };
}
