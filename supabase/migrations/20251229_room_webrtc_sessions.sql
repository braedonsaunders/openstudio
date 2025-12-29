-- Room WebRTC Sessions table
-- Stores Cloudflare Calls session IDs for each user in a room
-- This MUST be in a persistent store (not in-memory) to work across server instances

CREATE TABLE IF NOT EXISTS room_webrtc_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  track_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each user can only have one session per room
  UNIQUE(room_id, user_id)
);

-- Index for fast room lookups (the critical query)
CREATE INDEX IF NOT EXISTS idx_room_webrtc_sessions_room_id ON room_webrtc_sessions(room_id);

-- Index for cleanup of old sessions
CREATE INDEX IF NOT EXISTS idx_room_webrtc_sessions_updated_at ON room_webrtc_sessions(updated_at);

-- Enable RLS
ALTER TABLE room_webrtc_sessions ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (sessions are ephemeral)
CREATE POLICY "Allow all operations on room_webrtc_sessions" ON room_webrtc_sessions
  FOR ALL USING (true) WITH CHECK (true);

-- Function to clean up stale sessions (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_stale_webrtc_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM room_webrtc_sessions
  WHERE updated_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;
