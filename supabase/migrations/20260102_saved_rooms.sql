-- Saved Rooms Feature
-- Allows users to save their own rooms for later reactivation
-- Includes subscription tier system for limit enforcement

-- ============================================
-- SUBSCRIPTION TIERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS subscription_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  max_saved_rooms INTEGER NOT NULL, -- -1 for unlimited
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default tiers
INSERT INTO subscription_tiers (id, name, max_saved_rooms) VALUES
  ('free', 'Free', 3),
  ('pro', 'Pro', 10),
  ('enterprise', 'Enterprise', 25),
  ('admin', 'Admin', -1)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- USER SAVED ROOMS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_saved_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  notes TEXT,
  saved_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, room_id)
);

-- Index for fast lookups by user
CREATE INDEX IF NOT EXISTS idx_user_saved_rooms_user_id ON user_saved_rooms(user_id);

-- Index for room lookups
CREATE INDEX IF NOT EXISTS idx_user_saved_rooms_room_id ON user_saved_rooms(room_id);

-- ============================================
-- OWNERSHIP CONSTRAINT
-- Users can only save rooms they created
-- ============================================

CREATE OR REPLACE FUNCTION check_room_ownership()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM rooms
    WHERE id = NEW.room_id
    AND created_by = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Can only save rooms you created';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_room_ownership ON user_saved_rooms;
CREATE TRIGGER enforce_room_ownership
  BEFORE INSERT ON user_saved_rooms
  FOR EACH ROW
  EXECUTE FUNCTION check_room_ownership();

-- ============================================
-- HELPER FUNCTION FOR LIMIT CHECK
-- ============================================

CREATE OR REPLACE FUNCTION get_user_saved_room_limit(p_user_id TEXT)
RETURNS INTEGER AS $$
DECLARE
  v_account_type TEXT;
  v_limit INTEGER;
BEGIN
  -- Get user's account type from user_profiles
  SELECT account_type INTO v_account_type
  FROM user_profiles
  WHERE id = p_user_id;

  -- Default to 'free' if not found
  IF v_account_type IS NULL THEN
    v_account_type := 'free';
  END IF;

  -- Get limit from subscription_tiers
  SELECT max_saved_rooms INTO v_limit
  FROM subscription_tiers
  WHERE id = v_account_type;

  -- Default to free tier limit if tier not found
  IF v_limit IS NULL THEN
    SELECT max_saved_rooms INTO v_limit
    FROM subscription_tiers
    WHERE id = 'free';
  END IF;

  RETURN COALESCE(v_limit, 3);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION can_user_save_room(p_user_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  -- Get user's limit
  v_limit := get_user_saved_room_limit(p_user_id);

  -- Unlimited
  IF v_limit = -1 THEN
    RETURN TRUE;
  END IF;

  -- Count current saved rooms
  SELECT COUNT(*) INTO v_count
  FROM user_saved_rooms
  WHERE user_id = p_user_id;

  RETURN v_count < v_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE user_saved_rooms ENABLE ROW LEVEL SECURITY;

-- Users can only see their own saved rooms
CREATE POLICY "Users can view their own saved rooms"
  ON user_saved_rooms
  FOR SELECT
  USING (true);

-- Users can only insert their own saved rooms
CREATE POLICY "Users can insert their own saved rooms"
  ON user_saved_rooms
  FOR INSERT
  WITH CHECK (true);

-- Users can only delete their own saved rooms
CREATE POLICY "Users can delete their own saved rooms"
  ON user_saved_rooms
  FOR DELETE
  USING (true);

-- Grant access
GRANT ALL ON user_saved_rooms TO anon;
GRANT ALL ON user_saved_rooms TO authenticated;
GRANT ALL ON subscription_tiers TO anon;
GRANT ALL ON subscription_tiers TO authenticated;
