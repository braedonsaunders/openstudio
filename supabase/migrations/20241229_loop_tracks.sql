-- Loop Tracks Migration
-- Adds support for MIDI-based loop tracks and MIDI input tracks

-- 1. Create the room_loop_tracks table for storing MIDI loop track instances
CREATE TABLE IF NOT EXISTS room_loop_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,

  -- Creator info
  created_by TEXT,
  created_by_name TEXT,

  -- Loop definition
  loop_id TEXT NOT NULL,
  custom_midi_data JSONB,

  -- Playback state
  is_playing BOOLEAN DEFAULT false,
  start_time TIMESTAMPTZ,
  loop_start_beat REAL DEFAULT 0,

  -- Sound configuration
  sound_preset TEXT NOT NULL DEFAULT 'drums/acoustic-kit',
  sound_settings JSONB DEFAULT '{}'::jsonb,

  -- Musical adaptation
  tempo_locked BOOLEAN DEFAULT false,
  target_bpm REAL,
  key_locked BOOLEAN DEFAULT false,
  target_key TEXT,
  transpose_amount INTEGER DEFAULT 0,

  -- Mixer settings
  volume REAL DEFAULT 0.8 CHECK (volume >= 0 AND volume <= 2),
  pan REAL DEFAULT 0.0 CHECK (pan >= -1 AND pan <= 1),
  muted BOOLEAN DEFAULT false,
  solo BOOLEAN DEFAULT false,

  -- Effects
  effects JSONB DEFAULT '{
    "noiseGate": {"enabled": false, "threshold": -40, "attack": 1, "hold": 50, "release": 100, "range": -80},
    "eq": {"enabled": false, "bands": []},
    "compressor": {"enabled": false, "threshold": -24, "ratio": 4, "attack": 10, "release": 100, "knee": 10, "makeupGain": 0},
    "reverb": {"enabled": false, "type": "room", "mix": 0.2, "decay": 1.5, "preDelay": 20, "highCut": 8000, "lowCut": 200},
    "limiter": {"enabled": false, "threshold": -3, "release": 100, "ceiling": -0.3}
  }'::jsonb,

  -- Humanization
  humanize_enabled BOOLEAN DEFAULT false,
  humanize_timing REAL DEFAULT 0.05 CHECK (humanize_timing >= 0 AND humanize_timing <= 0.2),
  humanize_velocity REAL DEFAULT 0.1 CHECK (humanize_velocity >= 0 AND humanize_velocity <= 0.5),

  -- Display
  color TEXT DEFAULT '#6366f1',
  name TEXT,
  position INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_room_loop_tracks_room ON room_loop_tracks(room_id);
CREATE INDEX IF NOT EXISTS idx_room_loop_tracks_playing ON room_loop_tracks(room_id, is_playing);
CREATE INDEX IF NOT EXISTS idx_room_loop_tracks_position ON room_loop_tracks(room_id, position);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_room_loop_tracks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS room_loop_tracks_updated_at ON room_loop_tracks;
CREATE TRIGGER room_loop_tracks_updated_at
  BEFORE UPDATE ON room_loop_tracks
  FOR EACH ROW
  EXECUTE FUNCTION update_room_loop_tracks_updated_at();

-- RLS
ALTER TABLE room_loop_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on room_loop_tracks" ON room_loop_tracks
  FOR ALL USING (true) WITH CHECK (true);

GRANT ALL ON room_loop_tracks TO anon;
GRANT ALL ON room_loop_tracks TO authenticated;

-- 2. Extend user_tracks for MIDI input
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tracks' AND column_name = 'track_type'
  ) THEN
    ALTER TABLE user_tracks ADD COLUMN track_type TEXT DEFAULT 'audio' CHECK (track_type IN ('audio', 'midi'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_tracks' AND column_name = 'midi_settings'
  ) THEN
    ALTER TABLE user_tracks ADD COLUMN midi_settings JSONB DEFAULT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_tracks_type ON user_tracks(room_id, track_type);
