-- Fix RLS policy for user_avatar_canvas UPDATE
-- The original policy was missing WITH CHECK clause, causing upsert to fail

-- Drop and recreate the update policy with proper WITH CHECK clause
DROP POLICY IF EXISTS "Users can update own avatar canvas" ON user_avatar_canvas;

CREATE POLICY "Users can update own avatar canvas"
  ON user_avatar_canvas
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
