-- ============================================
-- GAMIFICATION DATABASE FUNCTIONS
-- ============================================

-- Function to atomically increment a stat
CREATE OR REPLACE FUNCTION increment_stat(
  p_user_id UUID,
  p_stat TEXT,
  p_amount INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  EXECUTE format(
    'UPDATE user_stats SET %I = COALESCE(%I, 0) + $1 WHERE user_id = $2',
    p_stat, p_stat
  ) USING p_amount, p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add XP and handle level-ups
CREATE OR REPLACE FUNCTION add_user_xp(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_source_type TEXT DEFAULT NULL,
  p_source_id TEXT DEFAULT NULL
)
RETURNS TABLE(new_xp INTEGER, new_level INTEGER, leveled_up BOOLEAN) AS $$
DECLARE
  v_current_xp INTEGER;
  v_current_level INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_leveled_up BOOLEAN := FALSE;
BEGIN
  -- Get current XP and level
  SELECT total_xp, level INTO v_current_xp, v_current_level
  FROM user_profiles
  WHERE id = p_user_id;

  IF v_current_xp IS NULL THEN
    v_current_xp := 0;
    v_current_level := 1;
  END IF;

  -- Calculate new XP
  v_new_xp := v_current_xp + p_amount;

  -- Calculate new level: level = floor(sqrt(xp / 100))
  v_new_level := GREATEST(1, FLOOR(SQRT(v_new_xp / 100.0))::INTEGER);

  -- Check if leveled up
  v_leveled_up := v_new_level > v_current_level;

  -- Update user profile
  UPDATE user_profiles
  SET total_xp = v_new_xp, level = v_new_level
  WHERE id = p_user_id;

  -- Log XP transaction
  INSERT INTO user_xp_transactions (user_id, amount, reason, source_type, source_id, balance_after)
  VALUES (p_user_id, p_amount, p_reason, p_source_type, p_source_id, v_new_xp);

  -- If leveled up, create activity feed item
  IF v_leveled_up THEN
    INSERT INTO activity_feed (user_id, type, data)
    VALUES (p_user_id, 'level_up', jsonb_build_object(
      'old_level', v_current_level,
      'new_level', v_new_level
    ));
  END IF;

  RETURN QUERY SELECT v_new_xp, v_new_level, v_leveled_up;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update daily streak
CREATE OR REPLACE FUNCTION update_user_streak(p_user_id UUID)
RETURNS TABLE(new_streak INTEGER, streak_continued BOOLEAN) AS $$
DECLARE
  v_last_active DATE;
  v_current_streak INTEGER;
  v_longest_streak INTEGER;
  v_today DATE := CURRENT_DATE;
  v_new_streak INTEGER;
  v_continued BOOLEAN := FALSE;
BEGIN
  -- Get current streak info
  SELECT
    last_active_date::DATE,
    current_daily_streak,
    longest_daily_streak
  INTO v_last_active, v_current_streak, v_longest_streak
  FROM user_profiles
  WHERE id = p_user_id;

  IF v_current_streak IS NULL THEN
    v_current_streak := 0;
    v_longest_streak := 0;
  END IF;

  -- Determine new streak
  IF v_last_active IS NULL THEN
    -- First activity ever
    v_new_streak := 1;
  ELSIF v_last_active = v_today THEN
    -- Already active today, keep streak
    v_new_streak := v_current_streak;
    v_continued := TRUE;
  ELSIF v_last_active = v_today - INTERVAL '1 day' THEN
    -- Active yesterday, increment streak
    v_new_streak := v_current_streak + 1;
    v_continued := TRUE;
  ELSE
    -- Streak broken, reset to 1
    v_new_streak := 1;
  END IF;

  -- Update longest streak if needed
  IF v_new_streak > v_longest_streak THEN
    v_longest_streak := v_new_streak;
  END IF;

  -- Update user profile
  UPDATE user_profiles
  SET
    current_daily_streak = v_new_streak,
    longest_daily_streak = v_longest_streak,
    last_active_date = v_today,
    last_online_at = NOW()
  WHERE id = p_user_id;

  RETURN QUERY SELECT v_new_streak, v_continued;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create user_xp_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source_type TEXT,
  source_id TEXT,
  balance_after INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for XP transactions
CREATE INDEX IF NOT EXISTS idx_user_xp_transactions_user_id ON user_xp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_xp_transactions_created_at ON user_xp_transactions(created_at);

-- Enable RLS on user_xp_transactions
ALTER TABLE user_xp_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policy for user_xp_transactions
CREATE POLICY "Users can view their own XP transactions"
  ON user_xp_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- Ensure user_stats table has all required columns
DO $$
BEGIN
  -- Add missing columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_stats' AND column_name = 'tracks_uploaded') THEN
    ALTER TABLE user_stats ADD COLUMN tracks_uploaded INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_stats' AND column_name = 'tracks_generated') THEN
    ALTER TABLE user_stats ADD COLUMN tracks_generated INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_stats' AND column_name = 'stems_separated') THEN
    ALTER TABLE user_stats ADD COLUMN stems_separated INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_stats' AND column_name = 'reactions_received') THEN
    ALTER TABLE user_stats ADD COLUMN reactions_received INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_stats' AND column_name = 'reactions_given') THEN
    ALTER TABLE user_stats ADD COLUMN reactions_given INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_stats' AND column_name = 'activity_by_hour') THEN
    ALTER TABLE user_stats ADD COLUMN activity_by_hour INTEGER[] DEFAULT ARRAY_FILL(0, ARRAY[24]);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_stats' AND column_name = 'activity_by_day') THEN
    ALTER TABLE user_stats ADD COLUMN activity_by_day INTEGER[] DEFAULT ARRAY_FILL(0, ARRAY[7]);
  END IF;
END $$;

-- Ensure user_profiles has streak columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'current_daily_streak') THEN
    ALTER TABLE user_profiles ADD COLUMN current_daily_streak INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'longest_daily_streak') THEN
    ALTER TABLE user_profiles ADD COLUMN longest_daily_streak INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'last_active_date') THEN
    ALTER TABLE user_profiles ADD COLUMN last_active_date DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'streak_freezes') THEN
    ALTER TABLE user_profiles ADD COLUMN streak_freezes INTEGER DEFAULT 0;
  END IF;
END $$;

-- Create activity_feed table if it doesn't exist
CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('achievement', 'level_up', 'friend', 'session', 'room_created')),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for activity_feed
CREATE INDEX IF NOT EXISTS idx_activity_feed_user_id ON activity_feed(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created_at ON activity_feed(created_at);

-- Enable RLS on activity_feed
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;

-- RLS policies for activity_feed
CREATE POLICY "Users can view activity from friends"
  ON activity_feed FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM friendships
      WHERE friendships.user_id = auth.uid()
      AND friendships.friend_id = activity_feed.user_id
      AND friendships.status = 'accepted'
    )
  );

CREATE POLICY "Users can insert their own activity"
  ON activity_feed FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION increment_stat(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION add_user_xp(UUID, INTEGER, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_streak(UUID) TO authenticated;
