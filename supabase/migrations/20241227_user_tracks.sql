-- User Tracks table for storing user audio track configurations
-- Each track includes audio settings, effects chain, and channel configuration

CREATE TABLE IF NOT EXISTS user_tracks (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#a78bfa',
  audio_settings JSONB NOT NULL DEFAULT '{
    "inputMode": "microphone",
    "inputDeviceId": "default",
    "sampleRate": 48000,
    "bufferSize": 256,
    "noiseSuppression": false,
    "echoCancellation": false,
    "autoGainControl": false,
    "channelConfig": {
      "channelCount": 2,
      "leftChannel": 0,
      "rightChannel": 1
    },
    "inputGain": 0,
    "effects": {
      "noiseGate": {
        "enabled": false,
        "threshold": -40,
        "attack": 1,
        "hold": 50,
        "release": 100,
        "range": -80
      },
      "eq": {
        "enabled": false,
        "bands": [
          {"frequency": 80, "gain": 0, "q": 0.7, "type": "lowshelf"},
          {"frequency": 400, "gain": 0, "q": 1.0, "type": "peaking"},
          {"frequency": 2500, "gain": 0, "q": 1.0, "type": "peaking"},
          {"frequency": 8000, "gain": 0, "q": 0.7, "type": "highshelf"}
        ]
      },
      "compressor": {
        "enabled": false,
        "threshold": -24,
        "ratio": 4,
        "attack": 10,
        "release": 100,
        "knee": 10,
        "makeupGain": 0
      },
      "reverb": {
        "enabled": false,
        "type": "room",
        "mix": 0.2,
        "decay": 1.5,
        "preDelay": 20,
        "highCut": 8000,
        "lowCut": 200
      },
      "limiter": {
        "enabled": false,
        "threshold": -3,
        "release": 100,
        "ceiling": -0.3
      }
    },
    "directMonitoring": true,
    "monitoringVolume": 1
  }'::jsonb,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  is_solo BOOLEAN NOT NULL DEFAULT false,
  volume REAL NOT NULL DEFAULT 1.0,
  is_armed BOOLEAN NOT NULL DEFAULT true,
  is_recording BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on room_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_tracks_room_id ON user_tracks(room_id);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_tracks_user_id ON user_tracks(user_id);

-- Create composite index for room + user queries
CREATE INDEX IF NOT EXISTS idx_user_tracks_room_user ON user_tracks(room_id, user_id);

-- Trigger to update updated_at on changes
CREATE OR REPLACE FUNCTION update_user_tracks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_tracks_updated_at ON user_tracks;
CREATE TRIGGER user_tracks_updated_at
  BEFORE UPDATE ON user_tracks
  FOR EACH ROW
  EXECUTE FUNCTION update_user_tracks_updated_at();

-- Enable RLS (Row Level Security)
ALTER TABLE user_tracks ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations (for now, can be restricted later)
CREATE POLICY "Allow all operations on user_tracks" ON user_tracks
  FOR ALL USING (true) WITH CHECK (true);

-- Grant access
GRANT ALL ON user_tracks TO anon;
GRANT ALL ON user_tracks TO authenticated;
