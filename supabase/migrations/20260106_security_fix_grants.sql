-- ============================================
-- SECURITY FIX: Restrict database grants
-- ============================================
-- This migration fixes overly permissive GRANT ALL TO anon statements
-- that could potentially bypass RLS policies.

-- ============================================
-- 1. Fix user_tracks grants
-- ============================================
-- Revoke ALL first to start fresh
REVOKE ALL ON user_tracks FROM anon;
REVOKE ALL ON user_tracks FROM authenticated;

-- Anon users should only be able to read tracks (for viewing rooms)
GRANT SELECT ON user_tracks TO anon;

-- Authenticated users can manage their own tracks (RLS enforces ownership)
GRANT SELECT, INSERT, UPDATE, DELETE ON user_tracks TO authenticated;

-- ============================================
-- 2. Fix user_custom_loops grants
-- ============================================
REVOKE ALL ON user_custom_loops FROM anon;
REVOKE ALL ON user_custom_loops FROM authenticated;

-- Anon users can view public loops
GRANT SELECT ON user_custom_loops TO anon;

-- Authenticated users can manage their own loops
GRANT SELECT, INSERT, UPDATE, DELETE ON user_custom_loops TO authenticated;

-- ============================================
-- 3. Fix room_loop_tracks grants
-- ============================================
REVOKE ALL ON room_loop_tracks FROM anon;
REVOKE ALL ON room_loop_tracks FROM authenticated;

-- Both can read loop tracks
GRANT SELECT ON room_loop_tracks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON room_loop_tracks TO authenticated;

-- ============================================
-- 4. Fix user_saved_rooms grants
-- ============================================
REVOKE ALL ON user_saved_rooms FROM anon;
REVOKE ALL ON user_saved_rooms FROM authenticated;

-- Anon users can view public saved rooms
GRANT SELECT ON user_saved_rooms TO anon;

-- Authenticated users can manage their saved rooms
GRANT SELECT, INSERT, UPDATE, DELETE ON user_saved_rooms TO authenticated;

-- ============================================
-- 5. Fix subscription_tiers grants (read-only for all)
-- ============================================
REVOKE ALL ON subscription_tiers FROM anon;
REVOKE ALL ON subscription_tiers FROM authenticated;

-- Everyone can read subscription tiers (public data)
GRANT SELECT ON subscription_tiers TO anon;
GRANT SELECT ON subscription_tiers TO authenticated;

-- ============================================
-- 6. Ensure RLS is enabled on all affected tables
-- ============================================
-- These should already be enabled, but let's be explicit
ALTER TABLE user_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_custom_loops ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_loop_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_rooms ENABLE ROW LEVEL SECURITY;

-- subscription_tiers is read-only public data, but enable RLS anyway
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. Add missing RLS policies for anon access
-- ============================================

-- user_tracks: Allow anon to read tracks for rooms they're viewing
DROP POLICY IF EXISTS "Anon users can view room tracks" ON user_tracks;
CREATE POLICY "Anon users can view room tracks" ON user_tracks
  FOR SELECT
  TO anon
  USING (true); -- RLS allows reading any track; room membership checked in API

-- user_custom_loops: Allow anon to view public loops
DROP POLICY IF EXISTS "Anon users can view public loops" ON user_custom_loops;
CREATE POLICY "Anon users can view public loops" ON user_custom_loops
  FOR SELECT
  TO anon
  USING (is_public = true);

-- room_loop_tracks: Allow anon to view room loops
DROP POLICY IF EXISTS "Anon users can view room loop tracks" ON room_loop_tracks;
CREATE POLICY "Anon users can view room loop tracks" ON room_loop_tracks
  FOR SELECT
  TO anon
  USING (true);

-- user_saved_rooms: Allow anon to view public saved rooms
DROP POLICY IF EXISTS "Anon users can view public saved rooms" ON user_saved_rooms;
CREATE POLICY "Anon users can view public saved rooms" ON user_saved_rooms
  FOR SELECT
  TO anon
  USING (EXISTS (
    SELECT 1 FROM saved_rooms sr
    WHERE sr.id = user_saved_rooms.room_id
    AND sr.room_type = 'public'
  ));

-- subscription_tiers: Allow everyone to read
DROP POLICY IF EXISTS "Anyone can view subscription tiers" ON subscription_tiers;
CREATE POLICY "Anyone can view subscription tiers" ON subscription_tiers
  FOR SELECT
  USING (true);

-- ============================================
-- 8. Add index for room_type lookup
-- ============================================
CREATE INDEX IF NOT EXISTS idx_saved_rooms_room_type ON saved_rooms(room_type);

-- ============================================
-- 9. Comments
-- ============================================
COMMENT ON POLICY "Anon users can view room tracks" ON user_tracks IS
  'Security: Allows anonymous users to view tracks. Room access is verified in the API layer.';

COMMENT ON POLICY "Anon users can view public loops" ON user_custom_loops IS
  'Security: Anonymous users can only view loops explicitly marked as public.';
