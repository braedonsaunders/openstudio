-- Avatar Canvas System
-- Replaces fixed-position rendering with free-form canvas editing

-- Create the user avatar canvas table
CREATE TABLE IF NOT EXISTS user_avatar_canvas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  canvas_data JSONB NOT NULL DEFAULT '{"version": 1, "layers": [], "background": {"type": "transparent", "value": null}}'::jsonb,
  full_body_url TEXT,
  headshot_url TEXT,
  thumbnail_urls JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_avatar_canvas_user_id ON user_avatar_canvas(user_id);

-- Enable RLS
ALTER TABLE user_avatar_canvas ENABLE ROW LEVEL SECURITY;

-- Users can read their own canvas
CREATE POLICY "Users can read own avatar canvas"
  ON user_avatar_canvas
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own canvas
CREATE POLICY "Users can insert own avatar canvas"
  ON user_avatar_canvas
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own canvas
CREATE POLICY "Users can update own avatar canvas"
  ON user_avatar_canvas
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own canvas (reset)
CREATE POLICY "Users can delete own avatar canvas"
  ON user_avatar_canvas
  FOR DELETE
  USING (auth.uid() = user_id);

-- Public can read avatar URLs for display (not full canvas data)
CREATE POLICY "Public can read avatar URLs"
  ON user_avatar_canvas
  FOR SELECT
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_avatar_canvas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_avatar_canvas_timestamp ON user_avatar_canvas;
CREATE TRIGGER update_avatar_canvas_timestamp
  BEFORE UPDATE ON user_avatar_canvas
  FOR EACH ROW
  EXECUTE FUNCTION update_avatar_canvas_updated_at();
