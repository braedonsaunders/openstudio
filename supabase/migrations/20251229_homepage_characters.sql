-- Homepage Characters System
-- Pre-built avatar characters for homepage animation

-- Create the homepage characters table
CREATE TABLE IF NOT EXISTS homepage_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  -- Canvas data (same format as user_avatar_canvas)
  canvas_data JSONB NOT NULL DEFAULT '{"version": 1, "layers": [], "background": {"type": "transparent", "value": null}}'::jsonb,
  -- Pre-rendered images
  full_body_url TEXT,
  thumbnail_url TEXT,
  -- Character attributes for animation
  personality VARCHAR(50), -- e.g., 'energetic', 'calm', 'quirky'
  preferred_scenes TEXT[], -- which scenes this character appears in (null = all)
  walk_speed DECIMAL(3,2) DEFAULT 1.0, -- multiplier for walk speed
  idle_animation VARCHAR(50) DEFAULT 'bounce', -- 'bounce', 'sway', 'still'
  -- Metadata
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for active characters
CREATE INDEX IF NOT EXISTS idx_homepage_characters_active ON homepage_characters(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_homepage_characters_sort ON homepage_characters(sort_order);

-- Enable RLS
ALTER TABLE homepage_characters ENABLE ROW LEVEL SECURITY;

-- Public can read active characters (for homepage display)
CREATE POLICY "Public can read active characters"
  ON homepage_characters
  FOR SELECT
  USING (is_active = true);

-- Admins can do everything
CREATE POLICY "Admins can manage characters"
  ON homepage_characters
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_homepage_characters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_homepage_characters_timestamp ON homepage_characters;
CREATE TRIGGER update_homepage_characters_timestamp
  BEFORE UPDATE ON homepage_characters
  FOR EACH ROW
  EXECUTE FUNCTION update_homepage_characters_updated_at();
