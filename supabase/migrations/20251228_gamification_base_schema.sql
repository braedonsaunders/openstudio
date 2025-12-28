-- ============================================
-- BASE GAMIFICATION SCHEMA
-- Run this before gamification_functions.sql
-- ============================================

-- User Profiles Extension (adds gamification columns if not exists)
-- Note: user_profiles table should already exist from auth setup
DO $$
BEGIN
  -- Add total_xp column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'total_xp') THEN
    ALTER TABLE user_profiles ADD COLUMN total_xp INTEGER DEFAULT 0;
  END IF;

  -- Add level column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'level') THEN
    ALTER TABLE user_profiles ADD COLUMN level INTEGER DEFAULT 1;
  END IF;
END $$;

-- ============================================
-- USER STATS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_jam_seconds INTEGER DEFAULT 0,
  average_session_seconds INTEGER DEFAULT 0,
  longest_session_seconds INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  sessions_this_week INTEGER DEFAULT 0,
  sessions_this_month INTEGER DEFAULT 0,
  unique_collaborators INTEGER DEFAULT 0,
  reactions_received INTEGER DEFAULT 0,
  reactions_given INTEGER DEFAULT 0,
  messages_sent INTEGER DEFAULT 0,
  rooms_created INTEGER DEFAULT 0,
  rooms_joined INTEGER DEFAULT 0,
  tracks_uploaded INTEGER DEFAULT 0,
  tracks_generated INTEGER DEFAULT 0,
  stems_separated INTEGER DEFAULT 0,
  activity_by_hour INTEGER[] DEFAULT ARRAY_FILL(0, ARRAY[24]),
  activity_by_day INTEGER[] DEFAULT ARRAY_FILL(0, ARRAY[7]),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_stats automatically when user signs up
CREATE OR REPLACE FUNCTION create_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create stats
DROP TRIGGER IF EXISTS on_auth_user_created_stats ON auth.users;
CREATE TRIGGER on_auth_user_created_stats
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_stats();

-- ============================================
-- ACHIEVEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  icon TEXT NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 100,
  criteria JSONB NOT NULL DEFAULT '{}',
  is_hidden BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  tier TEXT DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER ACHIEVEMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON user_achievements(achievement_id);

-- ============================================
-- USER INSTRUMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_instruments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instrument_id TEXT NOT NULL,
  category TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  variant TEXT,
  finish TEXT,
  total_hours NUMERIC(10,2) DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  last_played_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, instrument_id)
);

CREATE INDEX IF NOT EXISTS idx_user_instruments_user_id ON user_instruments(user_id);

-- ============================================
-- SESSION HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS session_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id TEXT NOT NULL,
  instrument TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  collaborator_ids UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_history_user_id ON session_history(user_id);
CREATE INDEX IF NOT EXISTS idx_session_history_room_id ON session_history(room_id);
CREATE INDEX IF NOT EXISTS idx_session_history_joined_at ON session_history(joined_at);

-- ============================================
-- FRIENDSHIPS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  jams_together INTEGER DEFAULT 0,
  total_time_together_seconds INTEGER DEFAULT 0,
  UNIQUE(user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status ON friendships(status);

-- ============================================
-- FOLLOWS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link_type TEXT,
  link_id TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- user_stats policies
DROP POLICY IF EXISTS "Users can view their own stats" ON user_stats;
CREATE POLICY "Users can view their own stats" ON user_stats FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own stats" ON user_stats;
CREATE POLICY "Users can update their own stats" ON user_stats FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own stats" ON user_stats;
CREATE POLICY "Users can insert their own stats" ON user_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Public can view stats" ON user_stats;
CREATE POLICY "Public can view stats" ON user_stats FOR SELECT USING (true);

-- achievements policies (read-only for everyone)
DROP POLICY IF EXISTS "Anyone can view achievements" ON achievements;
CREATE POLICY "Anyone can view achievements" ON achievements FOR SELECT USING (true);

-- user_achievements policies
DROP POLICY IF EXISTS "Users can view their own achievements" ON user_achievements;
CREATE POLICY "Users can view their own achievements" ON user_achievements FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own achievements" ON user_achievements;
CREATE POLICY "Users can insert their own achievements" ON user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Public can view achievements" ON user_achievements;
CREATE POLICY "Public can view achievements" ON user_achievements FOR SELECT USING (true);

-- user_instruments policies
DROP POLICY IF EXISTS "Users can view their own instruments" ON user_instruments;
CREATE POLICY "Users can view their own instruments" ON user_instruments FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can manage their own instruments" ON user_instruments;
CREATE POLICY "Users can manage their own instruments" ON user_instruments FOR ALL USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Public can view instruments" ON user_instruments;
CREATE POLICY "Public can view instruments" ON user_instruments FOR SELECT USING (true);

-- session_history policies
DROP POLICY IF EXISTS "Users can view their own sessions" ON session_history;
CREATE POLICY "Users can view their own sessions" ON session_history FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can manage their own sessions" ON session_history;
CREATE POLICY "Users can manage their own sessions" ON session_history FOR ALL USING (auth.uid() = user_id);

-- friendships policies
DROP POLICY IF EXISTS "Users can view their friendships" ON friendships;
CREATE POLICY "Users can view their friendships" ON friendships FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);
DROP POLICY IF EXISTS "Users can manage their friendships" ON friendships;
CREATE POLICY "Users can manage their friendships" ON friendships FOR ALL USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- follows policies
DROP POLICY IF EXISTS "Users can view follows" ON follows;
CREATE POLICY "Users can view follows" ON follows FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage their follows" ON follows;
CREATE POLICY "Users can manage their follows" ON follows FOR ALL USING (auth.uid() = follower_id);

-- notifications policies
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
CREATE POLICY "Users can view their notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;
CREATE POLICY "Users can update their notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
CREATE POLICY "Users can insert notifications" ON notifications FOR INSERT WITH CHECK (true);

-- ============================================
-- SEED ACHIEVEMENTS DATA
-- ============================================
INSERT INTO achievements (id, name, description, category, icon, xp_reward, criteria, is_hidden, sort_order, tier) VALUES
-- Getting Started
('first_steps', 'First Steps', 'Complete your profile setup', 'getting_started', '👋', 50, '{"type": "profile_complete"}', false, 1, 'bronze'),
('finding_your_voice', 'Finding Your Voice', 'Set your primary instrument', 'getting_started', '🎵', 50, '{"type": "instrument_set"}', false, 2, 'bronze'),
('room_rookie', 'Room Rookie', 'Join your first jam room', 'getting_started', '🚪', 100, '{"type": "rooms_joined", "count": 1}', false, 3, 'bronze'),
('avatar_artist', 'Avatar Artist', 'Customize your avatar', 'getting_started', '🎨', 50, '{"type": "avatar_customized"}', false, 4, 'bronze'),
('social_butterfly', 'Social Butterfly', 'Add your first friend', 'getting_started', '🦋', 75, '{"type": "friends_count", "count": 1}', false, 5, 'bronze'),

-- Jam Sessions
('first_jam', 'First Jam', 'Complete your first jam session', 'jam_sessions', '🎸', 100, '{"type": "sessions_completed", "count": 1}', false, 10, 'bronze'),
('getting_warmed_up', 'Getting Warmed Up', 'Complete 5 jam sessions', 'jam_sessions', '🔥', 150, '{"type": "sessions_completed", "count": 5}', false, 11, 'bronze'),
('regular_jammer', 'Regular Jammer', 'Complete 25 jam sessions', 'jam_sessions', '🎤', 300, '{"type": "sessions_completed", "count": 25}', false, 12, 'silver'),
('jam_enthusiast', 'Jam Enthusiast', 'Complete 50 jam sessions', 'jam_sessions', '🎹', 500, '{"type": "sessions_completed", "count": 50}', false, 13, 'silver'),
('jam_master', 'Jam Master', 'Complete 100 jam sessions', 'jam_sessions', '🏆', 1000, '{"type": "sessions_completed", "count": 100}', false, 14, 'gold'),
('collaboration_king', 'Collaboration King', 'Jam with 10 different musicians', 'jam_sessions', '🤝', 250, '{"type": "unique_collaborators", "count": 10}', false, 15, 'silver'),
('networking_pro', 'Networking Pro', 'Jam with 50 different musicians', 'jam_sessions', '🌐', 750, '{"type": "unique_collaborators", "count": 50}', false, 16, 'gold'),

-- Time Investment
('hour_of_jam', 'Hour of Jam', 'Spend 1 hour total jamming', 'time_investment', '⏰', 100, '{"type": "total_jam_hours", "count": 1}', false, 20, 'bronze'),
('five_hour_player', 'Five Hour Player', 'Spend 5 hours total jamming', 'time_investment', '🕐', 250, '{"type": "total_jam_hours", "count": 5}', false, 21, 'silver'),
('day_of_music', 'Day of Music', 'Spend 24 hours total jamming', 'time_investment', '☀️', 750, '{"type": "total_jam_hours", "count": 24}', false, 22, 'gold'),
('hundred_hour_hero', 'Hundred Hour Hero', 'Spend 100 hours total jamming', 'time_investment', '💯', 2000, '{"type": "total_jam_hours", "count": 100}', false, 23, 'platinum'),
('marathon_musician', 'Marathon Musician', 'Complete a single session over 2 hours', 'time_investment', '🏃', 300, '{"type": "longest_session_hours", "count": 2}', false, 24, 'silver'),

-- Social
('first_message', 'First Message', 'Send your first chat message', 'social', '💬', 25, '{"type": "messages_sent", "count": 1}', false, 30, 'bronze'),
('chatty_musician', 'Chatty Musician', 'Send 50 chat messages', 'social', '🗣️', 100, '{"type": "messages_sent", "count": 50}', false, 31, 'bronze'),
('friend_finder', 'Friend Finder', 'Have 5 friends', 'social', '👥', 150, '{"type": "friends_count", "count": 5}', false, 32, 'silver'),
('popular_player', 'Popular Player', 'Have 20 friends', 'social', '⭐', 400, '{"type": "friends_count", "count": 20}', false, 33, 'gold'),
('fire_starter', 'Fire Starter', 'Receive your first fire reaction', 'social', '🔥', 50, '{"type": "reactions_received", "count": 1}', false, 34, 'bronze'),
('crowd_pleaser', 'Crowd Pleaser', 'Receive 25 reactions', 'social', '👏', 200, '{"type": "reactions_received", "count": 25}', false, 35, 'silver'),
('generous_giver', 'Generous Giver', 'Give 50 reactions to others', 'social', '🎁', 150, '{"type": "reactions_given", "count": 50}', false, 36, 'silver'),

-- Room Master
('room_creator', 'Room Creator', 'Create your first room', 'room_master', '🏠', 100, '{"type": "rooms_created", "count": 1}', false, 40, 'bronze'),
('room_architect', 'Room Architect', 'Create 5 rooms', 'room_master', '🏗️', 250, '{"type": "rooms_created", "count": 5}', false, 41, 'silver'),
('venue_owner', 'Venue Owner', 'Create 10 rooms', 'room_master', '🎪', 500, '{"type": "rooms_created", "count": 10}', false, 42, 'gold'),
('explorer', 'Explorer', 'Join 10 different rooms', 'room_master', '🧭', 150, '{"type": "rooms_joined", "count": 10}', false, 43, 'silver'),
('world_traveler', 'World Traveler', 'Join 50 different rooms', 'room_master', '✈️', 400, '{"type": "rooms_joined", "count": 50}', false, 44, 'gold'),

-- Creation
('first_upload', 'First Upload', 'Upload your first track', 'creation', '📤', 100, '{"type": "tracks_uploaded", "count": 1}', false, 50, 'bronze'),
('track_collector', 'Track Collector', 'Upload 10 tracks', 'creation', '💿', 300, '{"type": "tracks_uploaded", "count": 10}', false, 51, 'silver'),
('ai_explorer', 'AI Explorer', 'Generate your first AI track', 'creation', '🤖', 75, '{"type": "tracks_generated", "count": 1}', false, 52, 'bronze'),
('ai_composer', 'AI Composer', 'Generate 10 AI tracks', 'creation', '🧠', 250, '{"type": "tracks_generated", "count": 10}', false, 53, 'silver'),
('stem_separator', 'Stem Separator', 'Separate stems from 5 tracks', 'creation', '🔀', 200, '{"type": "stems_separated", "count": 5}', false, 54, 'silver'),

-- Streak
('streak_starter', 'Streak Starter', 'Maintain a 3-day streak', 'streak', '🔥', 75, '{"type": "daily_streak", "count": 3}', false, 60, 'bronze'),
('week_warrior', 'Week Warrior', 'Maintain a 7-day streak', 'streak', '📅', 200, '{"type": "daily_streak", "count": 7}', false, 61, 'silver'),
('monthly_master', 'Monthly Master', 'Maintain a 30-day streak', 'streak', '🗓️', 750, '{"type": "daily_streak", "count": 30}', false, 62, 'gold'),
('dedication_deity', 'Dedication Deity', 'Maintain a 100-day streak', 'streak', '💯', 2000, '{"type": "daily_streak", "count": 100}', false, 63, 'platinum'),

-- Special
('founding_member_2024', 'Founding Member 2024', 'Joined OpenStudio in 2024', 'special', '🏛️', 500, '{"type": "founding_member", "years": [2024]}', false, 70, 'gold'),
('founding_member_2025', 'Founding Member 2025', 'Joined OpenStudio in 2025', 'special', '🌟', 500, '{"type": "founding_member", "years": [2025]}', false, 71, 'gold'),

-- Instrument Mastery
('multi_instrumentalist', 'Multi-Instrumentalist', 'Play 3 different instruments', 'instrument_mastery', '🎼', 400, '{"type": "instruments_played", "count": 3}', false, 80, 'gold'),
('one_man_band', 'One Man Band', 'Play 5 different instruments', 'instrument_mastery', '🎭', 750, '{"type": "instruments_played", "count": 5}', false, 81, 'platinum')

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  xp_reward = EXCLUDED.xp_reward,
  criteria = EXCLUDED.criteria,
  is_hidden = EXCLUDED.is_hidden,
  sort_order = EXCLUDED.sort_order,
  tier = EXCLUDED.tier;
