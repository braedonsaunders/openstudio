-- ============================================
-- FIX XP TRANSACTIONS RLS POLICIES
-- ============================================

-- The add_user_xp function needs to insert into user_xp_transactions
-- but there was no INSERT policy. Adding one now.

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can insert their own XP transactions" ON user_xp_transactions;
DROP POLICY IF EXISTS "Service role can insert XP transactions" ON user_xp_transactions;

-- Allow users to insert their own XP transactions
CREATE POLICY "Users can insert their own XP transactions"
  ON user_xp_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Also ensure the SECURITY DEFINER functions work properly by granting to service role
-- The function owner should be able to bypass RLS, but let's be explicit
GRANT ALL ON user_xp_transactions TO service_role;
GRANT ALL ON user_xp_transactions TO authenticated;

-- Recreate add_user_xp function to ensure it has proper SECURITY DEFINER
CREATE OR REPLACE FUNCTION add_user_xp(
  p_user_id UUID,
  p_amount INTEGER,
  p_reason TEXT,
  p_source_type TEXT DEFAULT NULL,
  p_source_id UUID DEFAULT NULL
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

  -- Calculate new level: level = floor(sqrt(xp / 100)) + 1
  v_new_level := GREATEST(1, FLOOR(SQRT(v_new_xp / 100.0))::INTEGER + 1);

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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION add_user_xp(UUID, INTEGER, TEXT, TEXT, UUID) TO authenticated;

-- Also fix activity_feed if needed
GRANT ALL ON activity_feed TO authenticated;
