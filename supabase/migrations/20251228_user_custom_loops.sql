-- User Custom Loops Migration
-- Stores user-created loops that persist to their account

-- Create the user_custom_loops table
CREATE TABLE IF NOT EXISTS user_custom_loops (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Loop definition (matches LoopDefinition type)
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT DEFAULT 'custom',
  bpm INTEGER NOT NULL DEFAULT 120,
  bars INTEGER NOT NULL DEFAULT 2,
  time_signature JSONB NOT NULL DEFAULT '[4, 4]'::jsonb,
  key TEXT,

  -- MIDI data stored as JSONB array
  midi_data JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Sound configuration
  sound_preset TEXT NOT NULL,

  -- Metadata
  tags JSONB NOT NULL DEFAULT '["custom"]'::jsonb,
  intensity INTEGER NOT NULL DEFAULT 3 CHECK (intensity >= 1 AND intensity <= 5),
  complexity INTEGER NOT NULL DEFAULT 2 CHECK (complexity >= 1 AND complexity <= 5),
  description TEXT,

  -- User preferences
  is_favorite BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_custom_loops_user ON user_custom_loops(user_id);
CREATE INDEX IF NOT EXISTS idx_user_custom_loops_category ON user_custom_loops(user_id, category);
CREATE INDEX IF NOT EXISTS idx_user_custom_loops_favorite ON user_custom_loops(user_id, is_favorite);
CREATE INDEX IF NOT EXISTS idx_user_custom_loops_updated ON user_custom_loops(user_id, updated_at DESC);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_user_custom_loops_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_custom_loops_updated_at ON user_custom_loops;
CREATE TRIGGER user_custom_loops_updated_at
  BEFORE UPDATE ON user_custom_loops
  FOR EACH ROW
  EXECUTE FUNCTION update_user_custom_loops_updated_at();

-- Enable Row Level Security
ALTER TABLE user_custom_loops ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own loops
CREATE POLICY "Users can view their own loops" ON user_custom_loops
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own loops" ON user_custom_loops
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own loops" ON user_custom_loops
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Users can delete their own loops" ON user_custom_loops
  FOR DELETE USING (true);

-- Grant permissions
GRANT ALL ON user_custom_loops TO anon;
GRANT ALL ON user_custom_loops TO authenticated;
